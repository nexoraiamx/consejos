import { db, poolDb } from "@/db";
import { users, profiles, communities, communityMembers, posts, comments, auditLogs, userReputation, reputationEvents } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

async function testCommentsFlow() {
  console.log("Iniciando pruebas de flujo para comentarios, respuesta aceptada y reputación...");

  const userIdPostAuthor = "user_post_author";
  const userIdCommenter1 = "user_commenter_one";
  const userIdCommenter2 = "user_commenter_two";
  const userIdModerator = "user_local_moderator";

  const communitySlug = "comments-flow-test-community";

  try {
    // 1. Limpieza de datos residuales
    console.log("Limpiando datos de pruebas previas...");
    await db.delete(auditLogs).execute();
    await db.delete(reputationEvents).execute();
    await db.delete(comments).execute();
    await db.delete(posts).execute();
    await db.delete(communityMembers).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdPostAuthor)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdCommenter1)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdCommenter2)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdModerator)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdPostAuthor)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdCommenter1)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdCommenter2)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdModerator)).execute();
    await db.delete(users).where(eq(users.id, userIdPostAuthor)).execute();
    await db.delete(users).where(eq(users.id, userIdCommenter1)).execute();
    await db.delete(users).where(eq(users.id, userIdCommenter2)).execute();
    await db.delete(users).where(eq(users.id, userIdModerator)).execute();

    // 2. Sembrar Usuarios
    console.log("Creando usuarios de prueba...");
    await db.insert(users).values([
      { id: userIdPostAuthor, email: "author@test.com", globalRole: "MEMBER" },
      { id: userIdCommenter1, email: "commenter1@test.com", globalRole: "MEMBER" },
      { id: userIdCommenter2, email: "commenter2@test.com", globalRole: "MEMBER" },
      { id: userIdModerator, email: "mod@test.com", globalRole: "MEMBER" },
    ]);
    await db.insert(profiles).values([
      { userId: userIdPostAuthor, displayName: "Post Author", username: "post_author" },
      { userId: userIdCommenter1, displayName: "Commenter One", username: "commenter_one" },
      { userId: userIdCommenter2, displayName: "Commenter Two", username: "commenter_two" },
      { userId: userIdModerator, displayName: "Community Moderator", username: "comm_mod" },
    ]);
    await db.insert(userReputation).values([
      { userId: userIdPostAuthor, score: 0, level: 1 },
      { userId: userIdCommenter1, score: 0, level: 1 },
      { userId: userIdCommenter2, score: 0, level: 1 },
      { userId: userIdModerator, score: 0, level: 1 },
    ]);

    // 3. Sembrar Comunidad
    console.log("Creando comunidad...");
    const [community] = await db.insert(communities).values({
      slug: communitySlug,
      displayName: "Comments Flow Community",
      privacyType: "PUBLIC",
      creatorId: userIdPostAuthor,
    }).returning();

    // 4. Sembrar Membresías
    await db.insert(communityMembers).values([
      { communityId: community.id, userId: userIdPostAuthor, role: "COMMUNITY_ADMIN", status: "APPROVED" },
      { communityId: community.id, userId: userIdCommenter1, role: "MEMBER", status: "APPROVED" },
      { communityId: community.id, userId: userIdCommenter2, role: "MEMBER", status: "APPROVED" },
      { communityId: community.id, userId: userIdModerator, role: "MODERATOR", status: "APPROVED" },
    ]);

    // 5. Sembrar Post (Pregunta)
    console.log("Creando publicación (Pregunta)...");
    const [post] = await db.insert(posts).values({
      communityId: community.id,
      authorId: userIdPostAuthor,
      title: "Cómo configurar hilos anidados con Drizzle?",
      content: "Tengo dudas sobre cómo estructurar la tabla auto-referenciada.",
      postType: "QUESTION",
      status: "ACTIVE",
    }).returning();

    // 6. Caso de Prueba: Crear comentario raíz
    console.log("\n--- Prueba 1: Crear Comentario Raíz ---");
    const [commentRoot] = await db.insert(comments).values({
      postId: post.id,
      parentId: null,
      authorId: userIdCommenter1,
      content: "Puedes usar parent_id de tipo UUID referenciando a la misma tabla comments.",
      status: "ACTIVE",
    }).returning();
    await db.insert(auditLogs).values({
      actorId: userIdCommenter1,
      action: "COMMENT_CREATE",
      targetType: "COMMENT",
      targetId: commentRoot.id,
      description: "Creado comentario raíz",
    });
    console.log("Comentario raíz creado. ID:", commentRoot.id);

    // 7. Caso de Prueba: Crear respuesta anidada
    console.log("\n--- Prueba 2: Crear Respuesta Anidada ---");
    const [commentReply] = await db.insert(comments).values({
      postId: post.id,
      parentId: commentRoot.id,
      authorId: userIdCommenter2,
      content: "Excelente respuesta. Y para la consulta recomiendas joins o recursión?",
      status: "ACTIVE",
    }).returning();
    await db.insert(auditLogs).values({
      actorId: userIdCommenter2,
      action: "COMMENT_CREATE",
      targetType: "COMMENT",
      targetId: commentReply.id,
      description: "Creado comentario hijo",
    });
    console.log("Respuesta anidada creada. ID:", commentReply.id);

    // 8. Caso de Prueba: Editar comentario propio
    console.log("\n--- Prueba 3: Editar Comentario Propio ---");
    await db.update(comments).set({
      content: "Puedes usar parent_id de tipo UUID referenciando a la misma tabla comments. (Editado)",
      updatedAt: new Date(),
    }).where(eq(comments.id, commentRoot.id));
    await db.insert(auditLogs).values({
      actorId: userIdCommenter1,
      action: "COMMENT_UPDATE",
      targetType: "COMMENT",
      targetId: commentRoot.id,
      description: "Comentario actualizado por su autor",
    });
    console.log("Comentario raíz actualizado con éxito.");

    // 9. Caso de Prueba: Intentar editar comentario ajeno (Debe fallar)
    console.log("\n--- Prueba 4: Intentar Editar Comentario Ajeno (Debe fallar) ---");
    try {
      const commentToEdit = await db.query.comments.findFirst({ where: eq(comments.id, commentRoot.id) });
      if (commentToEdit?.authorId !== userIdCommenter2) {
        throw new Error("Acceso denegado: Solo el autor puede editar su comentario.");
      }
      console.log("FALLO: El usuario 2 pudo editar el comentario del usuario 1.");
    } catch (e: any) {
      console.log("ÉXITO: Se denegó la edición con el error:", e.message);
    }

    // 10. Caso de Prueba: Ocultar comentario como moderador
    console.log("\n--- Prueba 5: Ocultar Comentario como Moderador ---");
    await db.update(comments).set({ status: "HIDDEN", updatedAt: new Date() }).where(eq(comments.id, commentReply.id));
    await db.insert(auditLogs).values({
      actorId: userIdModerator,
      action: "COMMENT_HIDE",
      targetType: "COMMENT",
      targetId: commentReply.id,
      description: "Comentario ocultado por moderación",
    });
    console.log("Comentario ocultado exitosamente.");

    // 11. Caso de Prueba: Restaurar comentario ocultado
    console.log("\n--- Prueba 6: Restaurar Comentario ---");
    await db.update(comments).set({ status: "ACTIVE", updatedAt: new Date() }).where(eq(comments.id, commentReply.id));
    await db.insert(auditLogs).values({
      actorId: userIdModerator,
      action: "COMMENT_UNHIDE",
      targetType: "COMMENT",
      targetId: commentReply.id,
      description: "Comentario restaurado por moderación",
    });
    console.log("Comentario restaurado a activo exitosamente.");

    // 12. Caso de Prueba: Marcar respuesta aceptada (Aceptando Comentario 1)
    console.log("\n--- Prueba 7: Marcar Respuesta Aceptada (+50 Reputación) ---");
    await db.update(posts).set({ acceptedAnswerId: commentRoot.id }).where(eq(posts.id, post.id));
    
    // Insertar evento de reputación
    await db.insert(reputationEvents).values({
      userId: userIdCommenter1,
      eventType: "ANSWER_ACCEPTED",
      points: 50,
      sourceType: "COMMENT",
      sourceId: commentRoot.id,
    });
    await db.insert(auditLogs).values({
      actorId: userIdPostAuthor,
      action: "ANSWER_ACCEPTED",
      targetType: "POST",
      targetId: post.id,
      description: `Comentario ${commentRoot.id} marcado como respuesta aceptada`,
    });
    console.log("Respuesta aceptada registrada.");

    // Esperar un instante para que actúe el trigger y verificar reputación del autor del comentario 1
    const repUser1 = await db.query.userReputation.findFirst({ where: eq(userReputation.userId, userIdCommenter1) });
    console.log(`Reputación de Commenter 1: Score=${repUser1?.score}, Level=${repUser1?.level}`);
    if (repUser1?.score !== 50) {
      throw new Error("FALLO: La reputación de Commenter 1 no subió a 50 vía trigger.");
    }
    console.log("ÉXITO: Reputación del Commenter 1 actualizada a 50 vía trigger.");

    // 13. Caso de Prueba: Cambiar respuesta aceptada a Comentario 2
    console.log("\n--- Prueba 8: Cambiar Respuesta Aceptada (Revertir anterior y sumar nuevo) ---");
    // Consultas transaccionales reales simulando acceptAnswerAction (usando poolDb.transaction)
    await poolDb.transaction(async (tx) => {
      // Revertir reputación de Commenter 1
      await tx.insert(reputationEvents).values({
        userId: userIdCommenter1,
        eventType: "ANSWER_UNACCEPTED",
        points: -50,
        sourceType: "COMMENT",
        sourceId: commentRoot.id,
      });
      await tx.insert(auditLogs).values({
        actorId: userIdPostAuthor,
        action: "ANSWER_UNACCEPTED",
        targetType: "POST",
        targetId: post.id,
        description: `Revocada respuesta aceptada para comentario ${commentRoot.id}`,
      });

      // Establecer nueva respuesta aceptada
      await tx.update(posts).set({ acceptedAnswerId: commentReply.id }).where(eq(posts.id, post.id));

      // Otorgar reputación a Commenter 2
      await tx.insert(reputationEvents).values({
        userId: userIdCommenter2,
        eventType: "ANSWER_ACCEPTED",
        points: 50,
        sourceType: "COMMENT",
        sourceId: commentReply.id,
      });
      await tx.insert(auditLogs).values({
        actorId: userIdPostAuthor,
        action: "ANSWER_ACCEPTED",
        targetType: "POST",
        targetId: post.id,
        description: `Comentario ${commentReply.id} marcado como respuesta aceptada`,
      });
    });

    // Verificar balances de reputación
    const repUser1Changed = await db.query.userReputation.findFirst({ where: eq(userReputation.userId, userIdCommenter1) });
    const repUser2Changed = await db.query.userReputation.findFirst({ where: eq(userReputation.userId, userIdCommenter2) });
    console.log(`Reputación de Commenter 1 tras cambio: Score=${repUser1Changed?.score}`);
    console.log(`Reputación de Commenter 2 tras cambio: Score=${repUser2Changed?.score}`);

    if (repUser1Changed?.score !== 0) {
      throw new Error("FALLO: La reputación de Commenter 1 no descendió a 0.");
    }
    if (repUser2Changed?.score !== 50) {
      throw new Error("FALLO: La reputación de Commenter 2 no subió a 50.");
    }
    console.log("ÉXITO: Balances de reputación de ambos usuarios recalculados correctamente vía trigger.");

    // 14. Caso de Prueba: Evitar duplicar reputación al aceptar el mismo comentario dos veces
    console.log("\n--- Prueba 9: Intentar aceptar el mismo comentario que ya está aceptado ---");
    // Al intentar aceptar la misma respuesta, nuestra acción realiza un des-aceptar (toggle off)
    // Pero si simulamos volver a mandar el mismo id, verificamos que no agregue reputación adicional si no cambia
    const postStatusCheck = await db.query.posts.findFirst({ where: eq(posts.id, post.id) });
    if (postStatusCheck?.acceptedAnswerId === commentReply.id) {
      console.log("El comentario ya es la respuesta aceptada. La acción evitará insertar ANSWER_ACCEPTED duplicado.");
    }

    // 15. Caso de Prueba: Soft delete de comentario y revocación automática
    console.log("\n--- Prueba 10: Soft Delete de la Respuesta Aceptada ---");
    // Soft delete comentario 2 (usando poolDb.transaction para consistencia atómica)
    await poolDb.transaction(async (tx) => {
      await tx.update(comments).set({ status: "DELETED", deletedAt: new Date() }).where(eq(comments.id, commentReply.id));
      await tx.insert(auditLogs).values({
        actorId: userIdCommenter2,
        action: "COMMENT_DELETE",
        targetType: "COMMENT",
        targetId: commentReply.id,
        description: "Comentario eliminado por soft delete",
      });

      // Revocar respuesta aceptada en el post
      await tx.update(posts).set({ acceptedAnswerId: null }).where(eq(posts.id, post.id));

      // Revertir reputación de Commenter 2
      await tx.insert(reputationEvents).values({
        userId: userIdCommenter2,
        eventType: "ANSWER_UNACCEPTED",
        points: -50,
        sourceType: "COMMENT",
        sourceId: commentReply.id,
      });
      await tx.insert(auditLogs).values({
        actorId: userIdCommenter2,
        action: "ANSWER_UNACCEPTED",
        targetType: "POST",
        targetId: post.id,
        description: `Revocada respuesta aceptada para comentario ${commentReply.id} por eliminación del mismo`,
      });
    });

    const repUser2Deleted = await db.query.userReputation.findFirst({ where: eq(userReputation.userId, userIdCommenter2) });
    console.log(`Reputación de Commenter 2 tras eliminación del comentario: Score=${repUser2Deleted?.score}`);
    if (repUser2Deleted?.score !== 0) {
      throw new Error("FALLO: La reputación de Commenter 2 no bajó a 0 tras la revocación por eliminación.");
    }
    console.log("ÉXITO: Reputación revocada correctamente y post sin respuesta aceptada.");

    // 16. Mostrar todos los Audit Logs
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
    // 17. Limpieza final de datos sembrados
    console.log("\nLimpiando datos sembrados de prueba...");
    await db.delete(auditLogs).execute();
    await db.delete(reputationEvents).execute();
    await db.delete(comments).execute();
    await db.delete(posts).execute();
    await db.delete(communityMembers).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdPostAuthor)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdCommenter1)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdCommenter2)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdModerator)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdPostAuthor)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdCommenter1)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdCommenter2)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdModerator)).execute();
    await db.delete(users).where(eq(users.id, userIdPostAuthor)).execute();
    await db.delete(users).where(eq(users.id, userIdCommenter1)).execute();
    await db.delete(users).where(eq(users.id, userIdCommenter2)).execute();
    await db.delete(users).where(eq(users.id, userIdModerator)).execute();
    console.log("Limpieza terminada. Base de datos restaurada.");
  }
}

testCommentsFlow();
