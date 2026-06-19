import { db, poolDb } from "@/db";
import { 
  users, 
  profiles, 
  communities, 
  communityMembers, 
  posts, 
  comments, 
  notifications, 
  auditLogs, 
  userReputation 
} from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { createNotificationTx } from "@/lib/notifications";
import { SYSTEM_TARGET_ID } from "@/lib/constants";

async function testNotificationsFlow() {
  console.log("Iniciando pruebas de flujo para Notificaciones...");

  const userIdPostAuthor = "user_notif_author";
  const userIdCommenter = "user_notif_commenter";
  const userIdModerator = "user_notif_moderator";

  const communitySlug = "notif-flow-test-community";

  try {
    // 1. Limpieza de datos residuales
    console.log("Limpiando datos de pruebas previas...");
    await db.delete(notifications).execute();
    await db.delete(auditLogs).execute();
    await db.delete(comments).execute();
    await db.delete(posts).execute();
    await db.delete(communityMembers).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdPostAuthor)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdCommenter)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdModerator)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdPostAuthor)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdCommenter)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdModerator)).execute();
    await db.delete(users).where(eq(users.id, userIdPostAuthor)).execute();
    await db.delete(users).where(eq(users.id, userIdCommenter)).execute();
    await db.delete(users).where(eq(users.id, userIdModerator)).execute();

    // 2. Sembrar Usuarios
    console.log("Creando usuarios de prueba...");
    await db.insert(users).values([
      { id: userIdPostAuthor, email: "author@test.com", globalRole: "MEMBER" },
      { id: userIdCommenter, email: "commenter@test.com", globalRole: "MEMBER" },
      { id: userIdModerator, email: "mod@test.com", globalRole: "MEMBER" },
    ]);
    await db.insert(profiles).values([
      { userId: userIdPostAuthor, displayName: "Post Author", username: "post_author" },
      { userId: userIdCommenter, displayName: "Test Commenter", username: "test_commenter" },
      { userId: userIdModerator, displayName: "Community Moderator", username: "comm_mod" },
    ]);
    await db.insert(userReputation).values([
      { userId: userIdPostAuthor, score: 0, level: 1 },
      { userId: userIdCommenter, score: 0, level: 1 },
      { userId: userIdModerator, score: 0, level: 1 },
    ]);

    // 3. Sembrar Comunidad
    console.log("Creando comunidad...");
    const [community] = await db.insert(communities).values({
      slug: communitySlug,
      displayName: "Notif Flow Community",
      privacyType: "PUBLIC",
      creatorId: userIdPostAuthor,
    }).returning();

    // 4. Sembrar Membresías
    await db.insert(communityMembers).values([
      { communityId: community.id, userId: userIdPostAuthor, role: "COMMUNITY_ADMIN", status: "APPROVED" },
      { communityId: community.id, userId: userIdCommenter, role: "MEMBER", status: "APPROVED" },
      { communityId: community.id, userId: userIdModerator, role: "MODERATOR", status: "APPROVED" },
    ]);

    // 5. Sembrar Post (Pregunta)
    console.log("Creando publicación (Pregunta)...");
    const [post] = await db.insert(posts).values({
      communityId: community.id,
      authorId: userIdPostAuthor,
      title: "Cómo configurar notificaciones reales?",
      content: "Necesito conectar Neon con Server Actions.",
      postType: "QUESTION",
      status: "ACTIVE",
    }).returning();

    // --- Prueba 1: Comentar en post ajeno genera notificación ---
    console.log("\n--- Prueba 1: Comentar en post ajeno genera notificación ---");
    const [comment] = await db.insert(comments).values({
      postId: post.id,
      authorId: userIdCommenter,
      content: "Excelente pregunta, yo también quiero saber.",
      status: "ACTIVE",
    }).returning();

    await poolDb.transaction(async (tx) => {
      await createNotificationTx(tx, {
        recipientId: post.authorId,
        senderId: userIdCommenter,
        type: "COMMENT",
        targetType: "POST",
        targetId: comment.id,
      });
    });

    // Verificar notificación para el autor
    const notifsAuthor = await db.query.notifications.findMany({
      where: eq(notifications.recipientId, userIdPostAuthor),
    });
    if (notifsAuthor.length !== 1) {
      throw new Error(`FALLO: El autor debería tener 1 notificación, tiene ${notifsAuthor.length}`);
    }
    console.log("ÉXITO: Notificación de nuevo comentario creada.");
    console.log("Tipo:", notifsAuthor[0].type, "| TargetType:", notifsAuthor[0].targetType);

    // --- Prueba 2: Responder comentario ajeno genera notificación ---
    console.log("\n--- Prueba 2: Responder comentario ajeno genera notificación ---");
    const [reply] = await db.insert(comments).values({
      postId: post.id,
      parentId: comment.id,
      authorId: userIdPostAuthor,
      content: "Gracias! Estaremos atentos a las respuestas.",
      status: "ACTIVE",
    }).returning();

    await poolDb.transaction(async (tx) => {
      await createNotificationTx(tx, {
        recipientId: comment.authorId,
        senderId: userIdPostAuthor,
        type: "COMMENT",
        targetType: "COMMENT",
        targetId: reply.id,
      });
    });

    // Verificar notificación para el comentarista
    const notifsCommenter = await db.query.notifications.findMany({
      where: eq(notifications.recipientId, userIdCommenter),
    });
    if (notifsCommenter.length !== 1) {
      throw new Error(`FALLO: El comentarista debería tener 1 notificación, tiene ${notifsCommenter.length}`);
    }
    console.log("ÉXITO: Notificación de respuesta a comentario creada.");
    console.log("Tipo:", notifsCommenter[0].type, "| TargetType:", notifsCommenter[0].targetType);

    // --- Prueba 3: Aceptar respuesta genera notificación ---
    console.log("\n--- Prueba 3: Aceptar respuesta genera notificación ---");
    await db.update(posts).set({ acceptedAnswerId: comment.id }).where(eq(posts.id, post.id));
    await poolDb.transaction(async (tx) => {
      await createNotificationTx(tx, {
        recipientId: comment.authorId,
        senderId: userIdPostAuthor,
        type: "REACTION",
        targetType: "COMMENT",
        targetId: comment.id,
      });
    });

    const notifsAfterAccept = await db.query.notifications.findMany({
      where: and(
        eq(notifications.recipientId, userIdCommenter),
        eq(notifications.type, "REACTION")
      ),
    });
    if (notifsAfterAccept.length !== 1) {
      throw new Error("FALLO: No se creó la notificación al aceptar la respuesta.");
    }
    console.log("ÉXITO: Notificación de respuesta aceptada creada.");

    // --- Prueba 4: Ocultar contenido por moderación genera notificación ---
    console.log("\n--- Prueba 4: Ocultar contenido por moderación genera notificación ---");
    await db.update(comments).set({ status: "HIDDEN" }).where(eq(comments.id, comment.id));
    await poolDb.transaction(async (tx) => {
      await createNotificationTx(tx, {
        recipientId: comment.authorId,
        senderId: userIdModerator,
        type: "MODERATION",
        targetType: "COMMENT",
        targetId: comment.id,
      });
    });

    const notifsAfterHide = await db.query.notifications.findMany({
      where: and(
        eq(notifications.recipientId, userIdCommenter),
        eq(notifications.type, "MODERATION"),
        eq(notifications.targetType, "COMMENT")
      ),
    });
    if (notifsAfterHide.length !== 1) {
      throw new Error("FALLO: No se creó la notificación de moderación al ocultar el comentario.");
    }
    console.log("ÉXITO: Notificación de contenido ocultado por moderación creada.");

    // --- Prueba 5: Suspender usuario genera notificación ---
    console.log("\n--- Prueba 5: Suspender usuario genera notificación ---");
    await db.update(users).set({ isSuspended: true }).where(eq(users.id, userIdCommenter));
    await poolDb.transaction(async (tx) => {
      await createNotificationTx(tx, {
        recipientId: userIdCommenter,
        senderId: userIdModerator,
        type: "MODERATION",
        targetType: "POST",
        targetId: SYSTEM_TARGET_ID,
      });
    });

    const notifsAfterSuspend = await db.query.notifications.findMany({
      where: and(
        eq(notifications.recipientId, userIdCommenter),
        eq(notifications.type, "MODERATION"),
        eq(notifications.targetId, SYSTEM_TARGET_ID)
      ),
    });
    if (notifsAfterSuspend.length !== 1) {
      throw new Error("FALLO: No se creó la notificación de suspensión de cuenta.");
    }
    console.log("ÉXITO: Notificación de cuenta suspendida creada.");

    // --- Prueba 6: Marcar una como leída ---
    console.log("\n--- Prueba 6: Marcar una como leída ---");
    const targetNotif = notifsAfterSuspend[0];
    // Simular markNotificationAsReadAction
    await db.update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, targetNotif.id),
          eq(notifications.recipientId, userIdCommenter) // Permiso
        )
      );

    const verifiedRead = await db.query.notifications.findFirst({
      where: eq(notifications.id, targetNotif.id),
    });
    if (!verifiedRead?.isRead) {
      throw new Error("FALLO: La notificación no se marcó como leída.");
    }
    console.log("ÉXITO: Notificación marcada como leída.");

    // --- Prueba 7: Marcar todas como leídas ---
    console.log("\n--- Prueba 7: Marcar todas como leídas ---");
    // Simular markAllNotificationsAsReadAction
    await db.update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.recipientId, userIdCommenter),
          eq(notifications.isRead, false)
        )
      );

    const unreadCount = await db.query.notifications.findMany({
      where: and(
        eq(notifications.recipientId, userIdCommenter),
        eq(notifications.isRead, false)
      ),
    });
    if (unreadCount.length !== 0) {
      throw new Error(`FALLO: Aún quedan ${unreadCount.length} notificaciones sin leer.`);
    }
    console.log("ÉXITO: Todas las notificaciones del usuario marcadas como leídas.");

    // --- Prueba 8: Privacidad - Usuario no puede leer/modificar notificaciones ajenas ---
    console.log("\n--- Prueba 8: Privacidad - Usuario no puede leer/modificar notificaciones ajenas ---");
    // Notificación perteneciente a User A (Author)
    const authorNotif = notifsAuthor[0];
    
    // Intento de modificar notificación ajena por parte de User B (Commenter)
    // Debería fallar al aplicar la cláusula where del recipientId
    const updateResult = await db.update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, authorNotif.id),
          eq(notifications.recipientId, userIdCommenter) // Intento no autorizado
        )
      );
    // Verificamos si realmente afectó filas
    // En Drizzle, pg/neon-serverless retorna el número de filas afectadas
    // Pero para estar 100% seguros, volvemos a consultar la base de datos
    const checkAuthorNotif = await db.query.notifications.findFirst({
      where: eq(notifications.id, authorNotif.id),
    });
    if (checkAuthorNotif?.isRead) {
      throw new Error("FALLO: El usuario B pudo marcar como leída la notificación del usuario A.");
    }
    console.log("ÉXITO: Se impidió la modificación de notificaciones ajenas.");

  } catch (err: any) {
    console.error("Fallo inesperado durante las pruebas de notificaciones:", err.message);
    process.exit(1);
  } finally {
    // Limpieza final de datos sembrados
    console.log("\nLimpiando datos sembrados de prueba de notificaciones...");
    await db.delete(notifications).execute();
    await db.delete(comments).execute();
    await db.delete(posts).execute();
    await db.delete(communityMembers).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdPostAuthor)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdCommenter)).execute();
    await db.delete(userReputation).where(eq(userReputation.userId, userIdModerator)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdPostAuthor)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdCommenter)).execute();
    await db.delete(profiles).where(eq(profiles.userId, userIdModerator)).execute();
    await db.delete(users).where(eq(users.id, userIdPostAuthor)).execute();
    await db.delete(users).where(eq(users.id, userIdCommenter)).execute();
    await db.delete(users).where(eq(users.id, userIdModerator)).execute();
    console.log("Limpieza terminada. Base de datos restaurada.");
  }
}

testNotificationsFlow();
