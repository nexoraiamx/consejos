"use server";

import { db, poolDb } from "@/db";
import { notifications, profiles, posts, comments, communities, attachments } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";


/**
 * Marca una notificación como leída.
 */
export async function markNotificationAsReadAction(notificationId: string) {
  const user = await requireAuth();

  // Validar propiedad de la notificación
  const notif = await db.query.notifications.findFirst({
    where: eq(notifications.id, notificationId),
  });

  if (!notif) {
    return { success: false, error: "Notificación no encontrada." };
  }

  if (notif.recipientId !== user.id) {
    return { success: false, error: "No autorizado: No eres el destinatario de esta notificación." };
  }

  try {
    await poolDb
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, notificationId));

    revalidatePath("/app/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error al marcar notificación como leída:", error);
    return { success: false, error: "Error al procesar la solicitud." };
  }
}

/**
 * Marca todas las notificaciones del usuario actual como leídas.
 */
export async function markAllNotificationsAsReadAction() {
  const user = await requireAuth();

  try {
    await poolDb
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.recipientId, user.id),
          eq(notifications.isRead, false)
        )
      );

    revalidatePath("/app/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error al marcar todas las notificaciones como leídas:", error);
    return { success: false, error: "Error al procesar la solicitud." };
  }
}

/**
 * Elimina una notificación.
 */
export async function deleteNotificationAction(notificationId: string) {
  const user = await requireAuth();

  // Validar propiedad de la notificación
  const notif = await db.query.notifications.findFirst({
    where: eq(notifications.id, notificationId),
  });

  if (!notif) {
    return { success: false, error: "Notificación no encontrada." };
  }

  if (notif.recipientId !== user.id) {
    return { success: false, error: "No autorizado: No puedes eliminar notificaciones ajenas." };
  }

  try {
    await poolDb
      .delete(notifications)
      .where(eq(notifications.id, notificationId));

    revalidatePath("/app/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error al eliminar notificación:", error);
    return { success: false, error: "Error al eliminar la notificación." };
  }
}

/**
 * Obtiene el conteo de notificaciones no leídas del usuario logueado.
 * Útil para los badges en sidebar/mobile nav.
 */
export async function getUnreadNotificationsCountAction() {
  try {
    const user = await requireAuth();
    if (!user) return 0;

    const unread = await db.query.notifications.findMany({
      where: and(
        eq(notifications.recipientId, user.id),
        eq(notifications.isRead, false)
      ),
    });

    return unread.length;
  } catch (error) {
    return 0;
  }
}

/**
 * Obtiene y enriquece las notificaciones del usuario logueado.
 */
export async function getUserNotificationsAction() {
  const user = await requireAuth();
  if (!user) {
    return [];
  }

  // Obtener notificaciones
  const rawNotifications = await db.query.notifications.findMany({
    where: eq(notifications.recipientId, user.id),
    orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
  });

  if (rawNotifications.length === 0) {
    return [];
  }

  // Reunir IDs únicos
  const senderIds = new Set<string>();
  const postOrCommentIds = new Set<string>();
  const communityIds = new Set<string>();
  const targetProfileIds = new Set<string>();

  for (const n of rawNotifications) {
    if (n.senderId) senderIds.add(n.senderId);
    if (n.targetType === "POST" || n.targetType === "COMMENT") {
      postOrCommentIds.add(n.targetId);
    } else if (n.targetType === "COMMUNITY") {
      communityIds.add(n.targetId);
    } else if (n.targetType === "USER") {
      targetProfileIds.add(n.targetId);
    }
  }

  // Obtener Perfiles de Remitentes
  const profilesList = senderIds.size > 0
    ? await db.query.profiles.findMany({
        where: inArray(profiles.userId, Array.from(senderIds)),
      })
    : [];
  const profileMap = new Map(profilesList.map((p) => [p.userId, p]));

  // Obtener Perfiles de Destino
  const targetProfilesList = targetProfileIds.size > 0
    ? await db.query.profiles.findMany({
        where: inArray(profiles.id, Array.from(targetProfileIds)),
      })
    : [];
  const targetProfileMap = new Map(targetProfilesList.map((p) => [p.id, p]));

  // Obtener Comentarios
  const commentsList = postOrCommentIds.size > 0
    ? await db.query.comments.findMany({
        where: inArray(comments.id, Array.from(postOrCommentIds)),
      })
    : [];
  const commentMap = new Map(commentsList.map((c) => [c.id, c]));

  // Reunir IDs de posts
  const postIds = new Set<string>();
  for (const n of rawNotifications) {
    if (n.targetType === "POST" || n.targetType === "COMMENT") {
      const comm = commentMap.get(n.targetId);
      if (comm) {
        postIds.add(comm.postId);
      } else {
        postIds.add(n.targetId);
      }
    }
  }

  // Obtener Posts
  const postsList = postIds.size > 0
    ? await db.query.posts.findMany({
        where: inArray(posts.id, Array.from(postIds)),
      })
    : [];
  const postMap = new Map(postsList.map((p) => [p.id, p]));

  // Reunir IDs de comunidades
  for (const p of postsList) {
    communityIds.add(p.communityId);
  }

  // Obtener Comunidades
  const communitiesList = communityIds.size > 0
    ? await db.query.communities.findMany({
        where: inArray(communities.id, Array.from(communityIds)),
      })
    : [];
  const communityMap = new Map(communitiesList.map((c) => [c.id, c]));

  // Carga en batch de adjuntos
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

  // Mapear y enriquecer
  const enriched = rawNotifications.map((n) => {
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
      } else {
        targetTitle = senderName;
        href = `/app/profile/${senderUsername}`;
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
      } else {
        const post = postMap.get(n.targetId);
        if (post) {
          postId = post.id;
          targetTitle = post.title;
          attachmentSummary = getSummary(post.id);
          const comm = communityMap.get(post.communityId);
          if (comm) {
            communitySlug = comm.slug;
            href = `/app/r/${comm.slug}/post/${post.id}`;
          }
        }
      }
    } else if (n.targetType === "COMMUNITY") {
      const comm = communityMap.get(n.targetId);
      if (comm) {
        targetTitle = comm.displayName;
        communitySlug = comm.slug;
        href = `/app/r/${comm.slug}`;
      }
    }

    return {
      id: n.id,
      type: n.type,
      isRead: n.isRead,
      createdAt: n.createdAt,
      targetType: n.targetType,
      targetId: n.targetId,
      senderId: n.senderId,
      senderName,
      senderUsername,
      senderAvatar,
      targetTitle,
      content,
      communitySlug,
      postId,
      commentId,
      href,
      attachmentSummary,
    };
  });

  return enriched;
}
