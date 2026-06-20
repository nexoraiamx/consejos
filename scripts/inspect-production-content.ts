import { poolDb } from "../src/db";
import { 
  communities, 
  posts, 
  comments, 
  attachments, 
  communityMembers 
} from "../src/db/schema";
import { count, eq, isNull, isNotNull, not } from "drizzle-orm";

async function inspectProductionContent() {
  console.log("====================================================");
  console.log("INSPECCIÓN NO DESTRUCTIVA DE LA BASE DE DATOS");
  console.log("====================================================");

  // 1. Mostrar host/database sin password
  const rawDbUrl = process.env.DATABASE_URL || "";
  let maskedUrl = "No definida";
  if (rawDbUrl) {
    try {
      // Expresión regular para extraer host y nombre de db
      const match = rawDbUrl.match(/@([^/]+)\/([^?]+)/);
      if (match) {
        maskedUrl = `postgresql://***:***@${match[1]}/${match[2]}`;
      } else {
        // Fallback básico
        maskedUrl = rawDbUrl.replace(/:[^:@]+@/, ":***@");
      }
    } catch (e) {
      maskedUrl = "Error al formatear DATABASE_URL";
    }
  }
  console.log(`DATABASE_URL actual: ${maskedUrl}\n`);

  try {
    // 2. Consultar conteos totales
    const [commCount] = await poolDb.select({ value: count() }).from(communities);
    const [deletedCommCount] = await poolDb.select({ value: count() }).from(communities).where(isNotNull(communities.deletedAt));
    const [activeCommCount] = await poolDb.select({ value: count() }).from(communities).where(isNull(communities.deletedAt));

    const [postsCount] = await poolDb.select({ value: count() }).from(posts);
    const [activePostsCount] = await poolDb.select({ value: count() }).from(posts).where(eq(posts.status, "ACTIVE"));
    const [deletedPostsCount] = await poolDb.select({ value: count() }).from(posts).where(eq(posts.status, "DELETED"));
    
    // Contar posts con deletedAt != null
    const [deletedAtPostsCount] = await poolDb.select({ value: count() }).from(posts).where(isNotNull(posts.deletedAt));

    const [commentsCount] = await poolDb.select({ value: count() }).from(comments);
    const [activeCommentsCount] = await poolDb.select({ value: count() }).from(comments).where(eq(comments.status, "ACTIVE"));
    const [deletedCommentsCount] = await poolDb.select({ value: count() }).from(comments).where(eq(comments.status, "DELETED"));

    const [attachmentsCount] = await poolDb.select({ value: count() }).from(attachments);
    const [membersCount] = await poolDb.select({ value: count() }).from(communityMembers);

    console.log("=== CONTEOS GLOBALES ===");
    console.log(`- Total Comunidades: ${commCount.value} (Activas: ${activeCommCount.value}, Eliminadas/deletedAt: ${deletedCommCount.value})`);
    console.log(`- Total Publicaciones (Posts): ${postsCount.value}`);
    console.log(`  * STATUS=ACTIVE: ${activePostsCount.value}`);
    console.log(`  * STATUS=DELETED: ${deletedPostsCount.value}`);
    console.log(`  * Con deletedAt != null: ${deletedAtPostsCount.value}`);
    console.log(`- Total Comentarios: ${commentsCount.value}`);
    console.log(`  * STATUS=ACTIVE: ${activeCommentsCount.value}`);
    console.log(`  * STATUS=DELETED: ${deletedCommentsCount.value}`);
    console.log(`- Total Adjuntos (Attachments): ${attachmentsCount.value}`);
    console.log(`- Total Miembros de Comunidades (Memberships): ${membersCount.value}`);
    console.log("========================\n");

    // 3. Mostrar comunidades activas y sus slugs
    console.log("=== COMUNIDADES ENCONTRADAS ===");
    const allCommunities = await poolDb.select({
      id: communities.id,
      slug: communities.slug,
      displayName: communities.displayName,
      deletedAt: communities.deletedAt,
      privacyType: communities.privacyType,
      creatorId: communities.creatorId
    }).from(communities);

    if (allCommunities.length === 0) {
      console.log("(No hay comunidades en la base de datos)");
    } else {
      allCommunities.forEach(c => {
        console.log(`- [${c.id}] Slug: "${c.slug}" | Nombre: "${c.displayName}" | Privacidad: ${c.privacyType} | Creador: "${c.creatorId}" | Eliminada: ${c.deletedAt ? c.deletedAt.toISOString() : "No"}`);
      });
    }
    console.log("===============================\n");

    // 4. Detalle por comunidad de publicaciones, comentarios y miembros
    console.log("=== DETALLE DE CONTENIDO POR COMUNIDAD ===");
    for (const c of allCommunities) {
      console.log(`\nComunidad: "${c.displayName}" (${c.slug})`);

      // Miembros
      const members = await poolDb.select().from(communityMembers).where(eq(communityMembers.communityId, c.id));
      console.log(`  * Miembros (${members.length}):`);
      members.forEach(m => {
        console.log(`    - Usuario: "${m.userId}" | Rol: ${m.role} | Estado: ${m.status}`);
      });

      // Posts
      const commPosts = await poolDb.select().from(posts).where(eq(posts.communityId, c.id));
      console.log(`  * Publicaciones (${commPosts.length}):`);
      for (const p of commPosts) {
        console.log(`    - Post ID: "${p.id}" | Título: "${p.title}" | Autor: "${p.authorId}" | Status: ${p.status} | deletedAt: ${p.deletedAt ? p.deletedAt.toISOString() : "null"}`);
        
        // Adjuntos del post
        const postAttachments = await poolDb.select().from(attachments).where(eq(attachments.targetId, p.id));
        if (postAttachments.length > 0) {
          console.log(`      Adjuntos del Post (${postAttachments.length}):`);
          postAttachments.forEach(att => {
            console.log(`        - FileKey: "${att.fileKey}" | Tipo: ${att.mimeType} | Uploader: "${att.uploaderId}"`);
          });
        }

        // Comentarios
        const postComments = await poolDb.select().from(comments).where(eq(comments.postId, p.id));
        if (postComments.length > 0) {
          console.log(`      Comentarios (${postComments.length}):`);
          for (const comment of postComments) {
            console.log(`        - Comment ID: "${comment.id}" | Autor: "${comment.authorId}" | Status: ${comment.status} | deletedAt: ${comment.deletedAt ? comment.deletedAt.toISOString() : "null"}`);
            
            // Adjuntos del comentario
            const commentAttachments = await poolDb.select().from(attachments).where(eq(attachments.targetId, comment.id));
            if (commentAttachments.length > 0) {
              console.log(`          Adjuntos del Comentario (${commentAttachments.length}):`);
              commentAttachments.forEach(att => {
                console.log(`            - FileKey: "${att.fileKey}" | Tipo: ${att.mimeType}`);
              });
            }
          }
        }
      }
    }
    console.log("\n====================================================");
    console.log("INSPECCIÓN FINALIZADA");
    console.log("====================================================");
    process.exit(0);
  } catch (error) {
    console.error("Error al ejecutar la inspección:", error);
    process.exit(1);
  }
}

inspectProductionContent();
