import { db } from "@/db";
import { communities, posts, comments, communityMembers, attachments, users, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function runAudit() {
  console.log("====================================================");
  console.log("Iniciando Auditoría Avanzada de Integridad de Datos...");
  console.log("====================================================");

  try {
    // 1. Consultar tablas principales de Neon DB
    const dbUsers = await db.query.users.findMany();
    const dbProfiles = await db.query.profiles.findMany();
    const dbCommunities = await db.query.communities.findMany();
    const dbMemberships = await db.query.communityMembers.findMany();
    const dbPosts = await db.query.posts.findMany();
    const dbComments = await db.query.comments.findMany();
    const dbAttachments = await db.query.attachments.findMany();

    const userIds = new Set(dbUsers.map((u) => u.id));
    const profileUserIds = new Set(dbProfiles.map((p) => p.userId));
    const communityIds = new Set(dbCommunities.map((c) => c.id));
    const postIds = new Set(dbPosts.map((p) => p.id));
    const commentIds = new Set(dbComments.map((c) => c.id));

    console.log(`- Usuarios (Neon): ${dbUsers.length}`);
    console.log(`- Perfiles (Neon): ${dbProfiles.length}`);
    console.log(`- Comunidades: ${dbCommunities.length}`);
    console.log(`- Membresías: ${dbMemberships.length}`);
    console.log(`- Publicaciones: ${dbPosts.length}`);
    console.log(`- Comentarios: ${dbComments.length}`);
    console.log(`- Adjuntos (Attachments): ${dbAttachments.length}`);
    console.log("----------------------------------------------------");

    let issuesCount = 0;

    // A. Detectar posts con id inválido (fake) o links rotos en contenido
    console.log("\n[Auditoría A] Publicaciones (Posts) y enlaces fake:");
    for (const post of dbPosts) {
      if (!uuidRegex.test(post.id)) {
        console.warn(`  [ERROR] Post con ID no válido (no UUID): id="${post.id}", title="${post.title}"`);
        issuesCount++;
      }
      
      // Buscar enlaces fake tipo "post_1", "post_2" en contenido o título
      const contentFake = post.content.includes("post_") || post.content.includes("user_mock");
      const titleFake = post.title.includes("post_") || post.title.includes("user_mock");
      if (contentFake || titleFake) {
        console.warn(`  [ALERTA] Post contiene referencias mock ("post_" o "user_mock"): id="${post.id}", title="${post.title}"`);
        issuesCount++;
      }
    }

    // B. Detectar enlaces mock en comentarios
    console.log("\n[Auditoría B] Comentarios y enlaces fake:");
    for (const comment of dbComments) {
      if (!uuidRegex.test(comment.id)) {
        console.warn(`  [ERROR] Comentario con ID no válido: id="${comment.id}"`);
        issuesCount++;
      }
      if (comment.content.includes("post_") || comment.content.includes("user_mock")) {
        console.warn(`  [ALERTA] Comentario contiene referencias mock: id="${comment.id}", postId="${comment.postId}"`);
        issuesCount++;
      }
    }

    // C. Detectar membresías duplicadas
    console.log("\n[Auditoría C] Membresías duplicadas:");
    const seenMemberships = new Set<string>();
    for (const member of dbMemberships) {
      const key = `${member.userId}-${member.communityId}`;
      if (seenMemberships.has(key)) {
        console.warn(`  [ERROR] Membresía duplicada detectada: userId="${member.userId}", communityId="${member.communityId}"`);
        issuesCount++;
      } else {
        seenMemberships.add(key);
      }
    }

    // D. Usuarios en Clerk que no están registrados en Neon DB (vía fetch nativo)
    console.log("\n[Auditoría D] Sincronización Clerk -> Neon:");
    if (process.env.CLERK_SECRET_KEY) {
      try {
        const response = await fetch("https://api.clerk.com/v1/users?limit=100", {
          headers: {
            "Authorization": `Bearer ${process.env.CLERK_SECRET_KEY}`,
            "Accept": "application/json"
          }
        });
        if (!response.ok) {
          throw new Error(`Clerk API respondió con status ${response.status}`);
        }
        const clerkUsers = await response.json() as any[];
        console.log(`  - Usuarios obtenidos de Clerk API: ${clerkUsers.length}`);

        for (const cu of clerkUsers) {
          if (!userIds.has(cu.id)) {
            console.warn(`  [ERROR] Usuario Clerk no existe en Neon DB: id="${cu.id}", email="${cu.email_addresses?.[0]?.email_address}"`);
            issuesCount++;
          }
        }
      } catch (err: any) {
        console.error("  [ADVERTENCIA] No se pudo consultar Clerk API:", err.message);
      }
    } else {
      console.warn("  [ADVERTENCIA] CLERK_SECRET_KEY no provisto. Saltando validación Clerk.");
    }

    // E. Publicaciones sin autor o perfil
    console.log("\n[Auditoría E] Publicaciones sin autor/perfil en Neon:");
    for (const post of dbPosts) {
      if (!userIds.has(post.authorId)) {
        console.warn(`  [ERROR] Post sin usuario en Neon: postId="${post.id}", authorId="${post.authorId}"`);
        issuesCount++;
      }
      if (!profileUserIds.has(post.authorId)) {
        console.warn(`  [ERROR] Post sin perfil en Neon: postId="${post.id}", authorId="${post.authorId}"`);
        issuesCount++;
      }
    }

    // F. Comentarios con postId inexistente o suspendido
    console.log("\n[Auditoría F] Comentarios huérfanos:");
    for (const comment of dbComments) {
      if (!postIds.has(comment.postId)) {
        console.warn(`  [ERROR] Comentario apunta a postId inexistente: id="${comment.id}", postId="${comment.postId}"`);
        issuesCount++;
      }
    }

    // G. Attachments con targetId inexistente
    console.log("\n[Auditoría G] Adjuntos (Attachments) huérfanos:");
    for (const att of dbAttachments) {
      if (att.targetId) {
        if (att.targetType === "POST" && !postIds.has(att.targetId)) {
          console.warn(`  [ERROR] Adjunto de Post apunta a postId inexistente: id="${att.id}", targetId="${att.targetId}"`);
          issuesCount++;
        }
        if (att.targetType === "COMMENT" && !commentIds.has(att.targetId)) {
          console.warn(`  [ERROR] Adjunto de Comentario apunta a commentId inexistente: id="${att.id}", targetId="${att.targetId}"`);
          issuesCount++;
        }
      }
    }

    console.log("\n========================= RESUMEN =========================");
    if (issuesCount === 0) {
      console.log("✅ ¡Auditoría finalizada con éxito! No se encontraron problemas.");
    } else {
      console.log(`❌ Auditoría finalizada. Se encontraron ${issuesCount} problemas de integridad.`);
    }
    console.log("===========================================================");

    process.exit(issuesCount === 0 ? 0 : 1);
  } catch (error) {
    console.error("Error al ejecutar la auditoría de datos:", error);
    process.exit(1);
  }
}

runAudit();
