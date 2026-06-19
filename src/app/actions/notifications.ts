"use server";

import { db, poolDb } from "@/db";
import { notifications, profiles, posts, comments, communities } from "@/db/schema";
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
  const postIds = new Set<string>();
  const commentIds = new Set<string>();
  const communityIds = new Set<string>();

  for (const n of rawNotifications) {
    if (n.senderId) senderIds.add(n.senderId);
    if (n.targetType === "POST") {
      postIds.add(n.targetId);
    } else if (n.targetType === "COMMENT") {
      commentIds.add(n.targetId);
    } else if (n.targetType === "COMMUNITY") {
      communityIds.add(n.targetId);
    }
  }

  // Obtener Perfiles
  const profilesList = senderIds.size > 0
    ? await db.query.profiles.findMany({
        where: inArray(profiles.userId, Array.from(senderIds)),
      })
    : [];
  const profileMap = new Map(profilesList.map((p) => [p.userId, p]));

  // Obtener Comentarios
  const commentsList = commentIds.size > 0
    ? await db.query.comments.findMany({
        where: inArray(comments.id, Array.from(commentIds)),
      })
    : [];
  const commentMap = new Map(commentsList.map((c) => [c.id, c]));

  // Agregar IDs de posts desde comentarios
  for (const c of commentsList) {
    postIds.add(c.postId);
  }

  // Obtener Posts
  const postsList = postIds.size > 0
    ? await db.query.posts.findMany({
        where: inArray(posts.id, Array.from(postIds)),
      })
    : [];
  const postMap = new Map(postsList.map((p) => [p.id, p]));

  // Reunir IDs de comunidades desde posts
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

  // Mapear y enriquecer
  const enriched = rawNotifications.map((n) => {
    let senderName = "Sistema";
    let senderUsername = "sistema";
    if (n.senderId) {
      const p = profileMap.get(n.senderId);
      if (p) {
        senderName = p.displayName;
        senderUsername = p.username;
      }
    }

    let targetTitle = "Contenido no disponible";
    let content = "";
    let communitySlug = "";

    if (n.targetType === "POST") {
      const post = postMap.get(n.targetId);
      if (post) {
        targetTitle = post.title;
        const comm = communityMap.get(post.communityId);
        if (comm) {
          communitySlug = comm.slug;
        }
      }
    } else if (n.targetType === "COMMENT") {
      const comment = commentMap.get(n.targetId);
      if (comment) {
        content = comment.content;
        const post = postMap.get(comment.postId);
        if (post) {
          targetTitle = post.title;
          const comm = communityMap.get(post.communityId);
          if (comm) {
            communitySlug = comm.slug;
          }
        }
      }
    } else if (n.targetType === "COMMUNITY") {
      const comm = communityMap.get(n.targetId);
      if (comm) {
        targetTitle = comm.displayName;
        communitySlug = comm.slug;
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
      targetTitle,
      content,
      communitySlug,
    };
  });

  return enriched;
}
