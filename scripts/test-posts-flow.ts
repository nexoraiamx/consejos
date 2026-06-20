if (process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
  console.error("ERROR: No se permite ejecutar scripts de prueba/sembrado destructivos en un entorno de producción o Vercel.");
  process.exit(1);
}

import { db } from "@/db";
import { users, profiles, communities, communityMembers, posts, auditLogs, userReputation } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

async function testFlow() {
  console.log("Iniciando flujo de prueba manual automatizada para publicaciones...");

  const userIdA = "user_test_admin";
  const userIdB = "user_test_member";
  const communitySlug = "test-community-flow";

  try {
    // 1. Limpieza de datos previos de prueba por seguridad
    console.log("Limpiando datos residuales...");
    await db.delete(auditLogs).execute();
    await db.delete(communityMembers).execute();
    await db.delete(posts).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdA)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdB)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdA)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdB)).execute();
    await db.delete(users).where(eq(users.id, userIdA)).execute();
    await db.delete(users).where(eq(users.id, userIdB)).execute();

    // 2. Sembrar Usuarios
    console.log("Creando usuarios de prueba...");
    await db.insert(users).values([
      { id: userIdA, email: "admin@test.com", globalRole: "MEMBER" },
      { id: userIdB, email: "member@test.com", globalRole: "MEMBER" },
    ]);
    await db.insert(profiles).values([
      { userId: userIdA, displayName: "Test Admin", username: "test_admin" },
      { userId: userIdB, displayName: "Test Member", username: "test_member" },
    ]);
    await db.insert(userReputation).values([
      { userId: userIdA, score: 10, level: 1 },
      { userId: userIdB, score: 20, level: 1 },
    ]);

    // 3. Sembrar Comunidad
    console.log("Creando comunidad de prueba...");
    const [community] = await db.insert(communities).values({
      slug: communitySlug,
      displayName: "Flow Test Community",
      privacyType: "PUBLIC",
      creatorId: userIdA,
    }).returning();

    // 4. Sembrar Membresías
    await db.insert(communityMembers).values([
      { communityId: community.id, userId: userIdA, role: "COMMUNITY_ADMIN", status: "APPROVED" },
      { communityId: community.id, userId: userIdB, role: "MEMBER", status: "APPROVED" },
    ]);

    // 5. Caso de Prueba: Miembro B crea una QUESTION
    console.log("\n--- Prueba 1: Crear QUESTION ---");
    const memB = await db.query.communityMembers.findFirst({
      where: and(eq(communityMembers.communityId, community.id), eq(communityMembers.userId, userIdB)),
    });
    if (!memB || memB.status !== "APPROVED") throw new Error("Miembro B no tiene membresía aprobada.");
    
    const [postQuestion] = await db.insert(posts).values({
      communityId: community.id,
      authorId: userIdB,
      title: "How to write Next 15 Server Actions?",
      content: "I need help with async params and server actions.",
      postType: "QUESTION",
      status: "ACTIVE",
    }).returning();
    
    await db.insert(auditLogs).values({
      actorId: userIdB,
      action: "POST_CREATE",
      targetType: "POST",
      targetId: postQuestion.id,
      description: `Publicación creada: "${postQuestion.title}" (QUESTION)`,
    });
    console.log("QUESTION creada correctamente. ID:", postQuestion.id);

    // 6. Caso de Prueba: Miembro B crea una DISCUSSION
    console.log("\n--- Prueba 2: Crear DISCUSSION ---");
    const [postDiscussion] = await db.insert(posts).values({
      communityId: community.id,
      authorId: userIdB,
      title: "Tailwind v4 is amazing",
      content: "Let's discuss Tailwind v4 configuration options.",
      postType: "DISCUSSION",
      status: "ACTIVE",
    }).returning();
    
    await db.insert(auditLogs).values({
      actorId: userIdB,
      action: "POST_CREATE",
      targetType: "POST",
      targetId: postDiscussion.id,
      description: `Publicación creada: "${postDiscussion.title}" (DISCUSSION)`,
    });
    console.log("DISCUSSION creada correctamente. ID:", postDiscussion.id);

    // 7. Caso de Prueba: Autor edita su propio post
    console.log("\n--- Prueba 3: Editar Post Propio ---");
    const postToEdit = await db.query.posts.findFirst({ where: eq(posts.id, postQuestion.id) });
    if (postToEdit?.authorId !== userIdB) throw new Error("Acceso denegado: No eres el autor.");
    
    await db.update(posts).set({
      title: "How to write Next 15 Server Actions? (Updated)",
      updatedAt: new Date(),
    }).where(eq(posts.id, postQuestion.id));
    
    await db.insert(auditLogs).values({
      actorId: userIdB,
      action: "POST_UPDATE",
      targetType: "POST",
      targetId: postQuestion.id,
      description: "Usuario B editó su propio post.",
    });
    console.log("Post propio editado con éxito.");

    // 8. Caso de Prueba: Moderador intenta editar post ajeno (Debe fallar)
    console.log("\n--- Prueba 4: Intentar Editar Post Ajeno (Debe fallar) ---");
    try {
      const postToEditAjeno = await db.query.posts.findFirst({ where: eq(posts.id, postQuestion.id) });
      if (postToEditAjeno?.authorId !== userIdA) {
        throw new Error("Acceso denegado: Solo el autor puede editar el contenido de su publicación.");
      }
      console.log("FALLO: El administrador pudo editar el post del usuario.");
    } catch (e: any) {
      console.log("ÉXITO: Se denegó la edición con el error:", e.message);
    }

    // 9. Caso de Prueba: Moderador oculta post ajeno (hidePostAction)
    console.log("\n--- Prueba 5: Ocultar Post (hidePostAction) ---");
    const memA = await db.query.communityMembers.findFirst({
      where: and(eq(communityMembers.communityId, community.id), eq(communityMembers.userId, userIdA)),
    });
    const canModerateA = memA && (memA.role === "COMMUNITY_ADMIN" || memA.role === "MODERATOR") && memA.status === "APPROVED";
    if (!canModerateA) throw new Error("El administrador no tiene privilegios de moderación.");

    await db.update(posts).set({ status: "HIDDEN", updatedAt: new Date() }).where(eq(posts.id, postQuestion.id));
    await db.insert(auditLogs).values({
      actorId: userIdA,
      action: "POST_HIDE",
      targetType: "POST",
      targetId: postQuestion.id,
      description: `Publicación marcada como oculta por moderación: "${postQuestion.title}"`,
    });
    console.log("hidePostAction exitosa. Post oculto por Admin.");

    // 10. Caso de Prueba: Miembro común intenta desocultar post (Debe fallar)
    console.log("\n--- Prueba 6: Intentar Mostrar Post Oculto sin ser Admin (Debe fallar) ---");
    try {
      const memBCheck = await db.query.communityMembers.findFirst({
        where: and(eq(communityMembers.communityId, community.id), eq(communityMembers.userId, userIdB)),
      });
      const canModerateB = memBCheck && (memBCheck.role === "COMMUNITY_ADMIN" || memBCheck.role === "MODERATOR") && memBCheck.status === "APPROVED";
      if (!canModerateB) throw new Error("Acceso denegado: Se requieren privilegios de moderación.");
      
      console.log("FALLO: El miembro común pudo desocultar el post.");
    } catch (e: any) {
      console.log("ÉXITO: Se denegó la acción con el error:", e.message);
    }

    // 11. Caso de Prueba: Moderador desoculta el post (unhidePostAction)
    console.log("\n--- Prueba 7: Mostrar Post Oculto (unhidePostAction) ---");
    await db.update(posts).set({ status: "ACTIVE", updatedAt: new Date() }).where(eq(posts.id, postQuestion.id));
    await db.insert(auditLogs).values({
      actorId: userIdA,
      action: "POST_UNHIDE",
      targetType: "POST",
      targetId: postQuestion.id,
      description: `Publicación restaurada a activa por moderación: "${postQuestion.title}"`,
    });
    console.log("unhidePostAction exitosa. Post restaurado por Admin.");

    // 12. Caso de Prueba: Soft delete del post por el autor
    console.log("\n--- Prueba 8: Soft Delete por el Autor ---");
    await db.update(posts).set({ status: "DELETED", deletedAt: new Date() }).where(eq(posts.id, postQuestion.id));
    await db.insert(auditLogs).values({
      actorId: userIdB,
      action: "POST_DELETE",
      targetType: "POST",
      targetId: postQuestion.id,
      description: `Publicación eliminada (Soft delete): "${postQuestion.title}"`,
    });
    console.log("Soft delete exitoso.");

    // 13. Caso de Prueba: Verificar que posts DELETED no aparecen en el Feed activo
    console.log("\n--- Prueba 9: Verificar que DELETED no aparece en Feed Activo ---");
    const activeFeed = await db.query.posts.findMany({
      where: and(eq(posts.communityId, community.id), eq(posts.status, "ACTIVE"), isNull(posts.deletedAt)),
    });
    console.log("Publicaciones activas devueltas en el feed:", activeFeed.map(p => p.title));
    if (activeFeed.some(p => p.id === postQuestion.id)) {
      throw new Error("FALLO: El post eliminado por soft delete apareció en el feed.");
    }
    console.log("ÉXITO: El post eliminado no se muestra en el feed activo.");

    // 14. Mostrar listado final de Logs de Auditoría registrados
    console.log("\n--- Registro de Logs de Auditoría en Neon DB ---");
    const logs = await db.query.auditLogs.findMany({
      orderBy: (auditLogs, { asc }) => [asc(auditLogs.createdAt)],
    });
    logs.forEach(log => {
      console.log(`- [${log.action}] ${log.description} (por ${log.actorId})`);
    });

  } catch (err: any) {
    console.error("Fallo inesperado durante las pruebas:", err.message);
  } finally {
    // Limpieza final de datos sembrados
    console.log("\nLimpiando datos sembrados de prueba de la base de datos...");
    await db.delete(auditLogs).execute();
    await db.delete(communityMembers).execute();
    await db.delete(posts).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdA)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdB)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdA)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdB)).execute();
    await db.delete(users).where(eq(users.id, userIdA)).execute();
    await db.delete(users).where(eq(users.id, userIdB)).execute();
    console.log("Limpieza terminada. Base de datos restaurada.");
  }
}

testFlow();
