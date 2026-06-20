import "./db-guard";
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
  userReputation,
  attachments,
  follows
} from "@/db/schema";
import { eq, and, isNull, inArray, or } from "drizzle-orm";
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
    const testUserIds = [userIdPostAuthor, userIdCommenter, userIdModerator];
    await db.delete(notifications).where(or(inArray(notifications.recipientId, testUserIds), inArray(notifications.senderId, testUserIds))).execute();
    await db.delete(follows).where(or(inArray(follows.followerId, testUserIds), inArray(follows.followingId, testUserIds))).execute();
    await db.delete(attachments).where(inArray(attachments.uploaderId, testUserIds)).execute();
    await db.delete(comments).where(inArray(comments.authorId, testUserIds)).execute();
    await db.delete(posts).where(inArray(posts.authorId, testUserIds)).execute();
    await db.delete(communityMembers).where(inArray(communityMembers.userId, testUserIds)).execute();
    await db.delete(auditLogs).where(inArray(auditLogs.actorId, testUserIds)).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(userReputation).where(inArray(userReputation.userId, testUserIds)).execute();
    await db.delete(profiles).where(inArray(profiles.userId, testUserIds)).execute();
    await db.delete(users).where(inArray(users.id, testUserIds)).execute();

    // 2. Sembrar Usuarios
    console.log("Creando usuarios de prueba...");
    await db.insert(users).values([
      { id: userIdPostAuthor, email: "author@test.com", globalRole: "MEMBER" },
      { id: userIdCommenter, email: "commenter@test.com", globalRole: "MEMBER" },
      { id: userIdModerator, email: "mod@test.com", globalRole: "MEMBER" },
    ]);
    const [authorProfile] = await db.insert(profiles).values([
      { userId: userIdPostAuthor, displayName: "Post Author", username: "post_author", avatarUrl: "https://avatar.url/author" },
      { userId: userIdCommenter, displayName: "Test Commenter", username: "test_commenter", avatarUrl: "https://avatar.url/commenter" },
      { userId: userIdModerator, displayName: "Community Moderator", username: "comm_mod" },
    ]).returning();

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

    // Agregar un adjunto de tipo audio al comentario para validar la clasificación
    console.log("Asociando adjunto de audio de prueba al comentario...");
    await db.insert(attachments).values({
      uploaderId: userIdCommenter,
      targetType: "COMMENT",
      targetId: comment.id,
      fileUrl: "https://r2.consejos.com/audio.webm",
      fileKey: "audio.webm",
      fileName: "audio.webm",
      fileSize: 1024,
      mimeType: "audio/webm"
    });

    // Verificar notificación para el autor
    const notifsAuthor = await db.query.notifications.findMany({
      where: eq(notifications.recipientId, userIdPostAuthor),
    });
    if (notifsAuthor.length !== 1) {
      throw new Error(`FALLO: El autor debería tener 1 notificación, tiene ${notifsAuthor.length}`);
    }
    console.log("ÉXITO: Notificación de nuevo comentario creada.");

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

    // --- Prueba 3: Notificación de Follow ---
    console.log("\n--- Prueba 3: Crear notificación de Follow ---");
    await poolDb.transaction(async (tx) => {
      await createNotificationTx(tx, {
        recipientId: userIdPostAuthor,
        senderId: userIdCommenter,
        type: "FOLLOW",
        targetType: "USER",
        targetId: authorProfile.id,
      });
    });

    const notifsFollow = await db.query.notifications.findMany({
      where: and(
        eq(notifications.recipientId, userIdPostAuthor),
        eq(notifications.type, "FOLLOW")
      ),
    });
    if (notifsFollow.length !== 1) {
      throw new Error("FALLO: La notificación de seguimiento no fue creada.");
    }
    console.log("ÉXITO: Notificación de seguimiento creada.");

    // --- Prueba 4: Enriquecimiento y validación de campos ---
    console.log("\n--- Prueba 4: Enriquecimiento y validación de campos (Simulado) ---");
    
    // Obtener notificaciones del autor
    const rawNotifs = await db.query.notifications.findMany({
      where: eq(notifications.recipientId, userIdPostAuthor),
    });

    // Mapear y enriquecer usando el mismo algoritmo que en la acción de servidor
    const senderIds = new Set<string>();
    const postOrCommentIds = new Set<string>();
    const communityIds = new Set<string>();
    const targetProfileIds = new Set<string>();

    for (const n of rawNotifs) {
      if (n.senderId) senderIds.add(n.senderId);
      if (n.targetType === "POST" || n.targetType === "COMMENT") {
        postOrCommentIds.add(n.targetId);
      } else if (n.targetType === "COMMUNITY") {
        communityIds.add(n.targetId);
      } else if (n.targetType === "USER") {
        targetProfileIds.add(n.targetId);
      }
    }

    const profilesList = await db.query.profiles.findMany({
      where: inArray(profiles.userId, Array.from(senderIds)),
    });
    const profileMap = new Map(profilesList.map((p) => [p.userId, p]));

    const targetProfilesList = targetProfileIds.size > 0
      ? await db.query.profiles.findMany({
          where: inArray(profiles.id, Array.from(targetProfileIds)),
        })
      : [];
    const targetProfileMap = new Map(targetProfilesList.map((p) => [p.id, p]));

    const commentsList = postOrCommentIds.size > 0
      ? await db.query.comments.findMany({
          where: inArray(comments.id, Array.from(postOrCommentIds)),
        })
      : [];
    const commentMap = new Map(commentsList.map((c) => [c.id, c]));

    const postIds = new Set<string>();
    for (const n of rawNotifs) {
      if (n.targetType === "POST" || n.targetType === "COMMENT") {
        const comm = commentMap.get(n.targetId);
        if (comm) {
          postIds.add(comm.postId);
        } else {
          postIds.add(n.targetId);
        }
      }
    }

    const postsList = postIds.size > 0
      ? await db.query.posts.findMany({
          where: inArray(posts.id, Array.from(postIds)),
        })
      : [];
    const postMap = new Map(postsList.map((p) => [p.id, p]));

    for (const p of postsList) {
      communityIds.add(p.communityId);
    }

    const communitiesList = communityIds.size > 0
      ? await db.query.communities.findMany({
          where: inArray(communities.id, Array.from(communityIds)),
        })
      : [];
    const communityMap = new Map(communitiesList.map((c) => [c.id, c]));

    // Carga de adjuntos
    const allTargetIds = Array.from(new Set([...Array.from(postOrCommentIds), ...Array.from(postIds)]));
    const attachmentsList = allTargetIds.length > 0
      ? await db.query.attachments.findMany({
          where: and(
            inArray(attachments.targetId, allTargetIds),
            inArray(attachments.targetType, ["POST", "COMMENT"])
          )
        })
      : [];

    const attachmentsMap = new Map<string, typeof attachmentsList>();
    for (const att of attachmentsList) {
      if (att.targetId) {
        if (!attachmentsMap.has(att.targetId)) {
          attachmentsMap.set(att.targetId, []);
        }
        attachmentsMap.get(att.targetId)!.push(att);
      }
    }

    const enriched = rawNotifs.map((n) => {
      let senderName = "Sistema";
      let senderUsername = "sistema";
      let senderAvatar: string | null = null;
      if (n.senderId) {
        const p = profileMap.get(n.senderId);
        if (p) {
          senderName = p.displayName;
          senderUsername = p.username;
          senderAvatar = p.avatarUrl;
        }
      }

      let targetTitle = "Contenido no disponible";
      let content = "";
      let communitySlug = "";
      let postId = "";
      let commentId = "";
      let href = "/app";
      let attachmentSummary: string | null = null;

      const getSummary = (tId: string) => {
        const atts = attachmentsMap.get(tId);
        if (!atts || atts.length === 0) return null;
        for (const att of atts) {
          if (att.mimeType.startsWith("audio/")) return "audio";
        }
        for (const att of atts) {
          if (att.mimeType.startsWith("video/")) return "video";
        }
        for (const att of atts) {
          if (att.mimeType.startsWith("image/")) return "imagen";
        }
        for (const att of atts) {
          if (att.mimeType === "application/pdf") return "PDF";
        }
        for (const att of atts) {
          if (att.mimeType === "text/uri-list") return "enlace";
        }
        return "archivo";
      };

      if (n.type === "FOLLOW" || n.targetType === "USER") {
        const p = targetProfileMap.get(n.targetId) || profileMap.get(n.senderId || "");
        if (p) {
          targetTitle = p.displayName;
          href = `/app/profile/${p.username}`;
        }
      } else if (n.targetType === "POST" || n.targetType === "COMMENT") {
        const comment = commentMap.get(n.targetId);
        if (comment) {
          commentId = comment.id;
          content = comment.content;
          attachmentSummary = getSummary(comment.id);
          const post = postMap.get(comment.postId);
          if (post) {
            postId = post.id;
            targetTitle = post.title;
            const comm = communityMap.get(post.communityId);
            if (comm) {
              communitySlug = comm.slug;
              href = `/app/r/${comm.slug}/post/${post.id}#comment-${comment.id}`;
            }
          }
        }
      }

      return {
        id: n.id,
        type: n.type,
        senderAvatar,
        href,
        attachmentSummary,
        content
      };
    });

    // Validar enriquecimiento de comentario con adjunto
    const commentEnriched = enriched.find((e) => e.type === "COMMENT");
    if (!commentEnriched) {
      throw new Error("FALLO: No se encontró la notificación enriquecida de comentario.");
    }
    console.log("Enriquecido comentario:", commentEnriched);
    if (commentEnriched.attachmentSummary !== "audio") {
      throw new Error(`FALLO: El resumen de adjuntos debería ser 'audio', pero es '${commentEnriched.attachmentSummary}'`);
    }
    if (!commentEnriched.senderAvatar || !commentEnriched.href.includes("#comment-")) {
      throw new Error("FALLO: Los campos de avatar o href no coinciden.");
    }
    console.log("ÉXITO: Enriquecimiento de comentario y adjunto validado con éxito.");

    // Validar enriquecimiento de follow
    const followEnriched = enriched.find((e) => e.type === "FOLLOW");
    if (!followEnriched) {
      throw new Error("FALLO: No se encontró la notificación enriquecida de follow.");
    }
    console.log("Enriquecido follow:", followEnriched);
    if (!followEnriched.href.includes("/profile/post_author") && !followEnriched.href.includes("/profile/test_commenter")) {
      throw new Error(`FALLO: La ruta del follow es incorrecta: ${followEnriched.href}`);
    }
    console.log("ÉXITO: Notificación de follow validada correctamente.");

    console.log("\n=============================================");
    console.log("¡TODAS LAS PRUEBAS DE NOTIFICACIONES PASARON CON ÉXITO!");
    console.log("=============================================");

  } catch (err: any) {
    console.error("Fallo inesperado durante las pruebas de notificaciones:", err.message);
    process.exit(1);
  } finally {
    // Limpieza final de datos sembrados
    console.log("\nLimpiando datos sembrados de prueba de notificaciones...");
    const testUserIds = [userIdPostAuthor, userIdCommenter, userIdModerator];
    await db.delete(notifications).where(or(inArray(notifications.recipientId, testUserIds), inArray(notifications.senderId, testUserIds))).execute();
    await db.delete(follows).where(or(inArray(follows.followerId, testUserIds), inArray(follows.followingId, testUserIds))).execute();
    await db.delete(attachments).where(inArray(attachments.uploaderId, testUserIds)).execute();
    await db.delete(comments).where(inArray(comments.authorId, testUserIds)).execute();
    await db.delete(posts).where(inArray(posts.authorId, testUserIds)).execute();
    await db.delete(communityMembers).where(inArray(communityMembers.userId, testUserIds)).execute();
    await db.delete(communities).where(eq(communities.slug, communitySlug)).execute();
    await db.delete(userReputation).where(inArray(userReputation.userId, testUserIds)).execute();
    await db.delete(profiles).where(inArray(profiles.userId, testUserIds)).execute();
    await db.delete(users).where(inArray(users.id, testUserIds)).execute();
    console.log("Limpieza terminada. Base de datos restaurada.");
  }
}

testNotificationsFlow();
