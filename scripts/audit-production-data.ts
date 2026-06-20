import { db } from "@/db";
import { communities, posts, comments, communityMembers, attachments, users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function runAudit() {
  console.log("====================================================");
  console.log("Iniciando Auditoría de Integridad de Datos en Neon DB...");
  console.log("====================================================");

  try {
    // 1. Obtener todos los usuarios
    const dbUsers = await db.query.users.findMany();
    const userIds = new Set(dbUsers.map((u) => u.id));
    console.log(`- Usuarios registrados: ${dbUsers.length}`);

    // 2. Obtener todas las comunidades
    const dbCommunities = await db.query.communities.findMany();
    const communityIds = new Set(dbCommunities.map((c) => c.id));
    console.log(`- Comunidades registradas: ${dbCommunities.length}`);

    // Verificar IDs de comunidades
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let invalidCommunityIds = 0;
    for (const comm of dbCommunities) {
      if (!uuidRegex.test(comm.id)) {
        console.warn(`  [ALERTA] Comunidad con ID no UUID: slug="${comm.slug}", id="${comm.id}"`);
        invalidCommunityIds++;
      }
    }

    // 3. Obtener todas las membresías
    const dbMemberships = await db.query.communityMembers.findMany();
    console.log(`- Membresías registradas: ${dbMemberships.length}`);
    let brokenMemberships = 0;
    for (const mem of dbMemberships) {
      if (!communityIds.has(mem.communityId)) {
        console.warn(`  [ALERTA] Membresía huérfana (comunidad inexistente): id="${mem.id}", communityId="${mem.communityId}"`);
        brokenMemberships++;
      }
      if (!userIds.has(mem.userId)) {
        console.warn(`  [ALERTA] Membresía huérfana (usuario inexistente): id="${mem.id}", userId="${mem.userId}"`);
        brokenMemberships++;
      }
    }

    // 4. Obtener todos las publicaciones (posts)
    const dbPosts = await db.query.posts.findMany();
    console.log(`- Publicaciones registradas: ${dbPosts.length}`);
    let brokenPosts = 0;
    let nonUuidPosts = 0;
    for (const post of dbPosts) {
      if (!uuidRegex.test(post.id)) {
        console.warn(`  [ALERTA] Publicación con ID no UUID: title="${post.title}", id="${post.id}"`);
        nonUuidPosts++;
      }
      if (!communityIds.has(post.communityId)) {
        console.warn(`  [ALERTA] Publicación huérfana (comunidad inexistente): id="${post.id}", communityId="${post.communityId}"`);
        brokenPosts++;
      }
      if (!userIds.has(post.authorId)) {
        console.warn(`  [ALERTA] Publicación huérfana (autor inexistente): id="${post.id}", authorId="${post.authorId}"`);
        brokenPosts++;
      }
    }

    // 5. Obtener todos los comentarios
    const dbComments = await db.query.comments.findMany();
    console.log(`- Comentarios registrados: ${dbComments.length}`);
    let brokenComments = 0;
    for (const comment of dbComments) {
      if (!uuidRegex.test(comment.id)) {
        console.warn(`  [ALERTA] Comentario con ID no UUID: id="${comment.id}"`);
      }
      if (!userIds.has(comment.authorId)) {
        console.warn(`  [ALERTA] Comentario huérfano (autor inexistente): id="${comment.id}", authorId="${comment.authorId}"`);
        brokenComments++;
      }
    }

    console.log("\n========================= RESUMEN =========================");
    console.log(`- IDs Comunidad no UUID: ${invalidCommunityIds}`);
    console.log(`- IDs Post no UUID: ${nonUuidPosts}`);
    console.log(`- Membresías rotas: ${brokenMemberships}`);
    console.log(`- Publicaciones rotas/huérfanas: ${brokenPosts}`);
    console.log(`- Comentarios rotos/huérfanos: ${brokenComments}`);
    console.log("===========================================================");
    
    process.exit(0);
  } catch (error) {
    console.error("Error al ejecutar la auditoría de datos:", error);
    process.exit(1);
  }
}

runAudit();
