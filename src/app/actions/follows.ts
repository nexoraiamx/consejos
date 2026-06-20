"use server";

import { db, poolDb } from "@/db";
import { follows, users, profiles, auditLogs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, getCurrentUser } from "@/lib/auth-helpers";
import { createNotificationTx } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

export async function followUserAction(followingId: string) {
  try {
    const follower = await requireAuth();
    const followerId = follower.id;

    if (followerId === followingId) {
      return { success: false, error: "No puedes seguirte a ti mismo." };
    }

    // Validar que el usuario seguido exista
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, followingId)
    });
    if (!targetUser) {
      return { success: false, error: "El usuario a seguir no existe." };
    }

    // Validar si ya lo sigue
    const existingFollow = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      )
    });
    if (existingFollow) {
      return { success: false, error: "Ya sigues a este usuario." };
    }

    // Obtener perfil del seguidor para la notificación
    const followerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, followerId)
    });
    const followingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, followingId)
    });

    if (!followerProfile || !followingProfile) {
      return { success: false, error: "Perfil no encontrado." };
    }

    await poolDb.transaction(async (tx) => {
      // 1. Insertar el follow
      await tx.insert(follows).values({
        followerId,
        followingId
      });

      // 2. Crear notificación para el usuario seguido
      // targetId será el ID del perfil del seguidor (followerProfile.id)
      await createNotificationTx(tx, {
        recipientId: followingId,
        senderId: followerId,
        type: "FOLLOW",
        targetType: "USER",
        targetId: followerProfile.id
      });

      // 3. Registrar en audit_logs
      await tx.insert(auditLogs).values({
        actorId: followerId,
        action: "USER_FOLLOW",
        targetType: "USER",
        targetId: followingProfile.id,
        description: `${followerProfile.displayName} empezó a seguir a ${followingProfile.displayName}`
      });
    });

    revalidatePath(`/app/profile/${followingProfile.username}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error al seguir usuario:", error);
    return { success: false, error: error.message || "Error interno al procesar la solicitud." };
  }
}

export async function unfollowUserAction(followingId: string) {
  try {
    const follower = await requireAuth();
    const followerId = follower.id;

    // Obtener perfiles para revalidar y auditar
    const followerProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, followerId)
    });
    const followingProfile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, followingId)
    });

    if (!followerProfile || !followingProfile) {
      return { success: false, error: "Perfil no encontrado." };
    }

    await poolDb.transaction(async (tx) => {
      // 1. Eliminar el follow
      await tx.delete(follows)
        .where(
          and(
            eq(follows.followerId, followerId),
            eq(follows.followingId, followingId)
          )
        );

      // 2. Registrar en audit_logs
      await tx.insert(auditLogs).values({
        actorId: followerId,
        action: "USER_UNFOLLOW",
        targetType: "USER",
        targetId: followingProfile.id,
        description: `${followerProfile.displayName} dejó de seguir a ${followingProfile.displayName}`
      });
    });

    revalidatePath(`/app/profile/${followingProfile.username}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error al dejar de seguir usuario:", error);
    return { success: false, error: error.message || "Error interno al procesar la solicitud." };
  }
}

export async function getFollowStatsAction(targetUserId: string) {
  try {
    const currentUser = await getCurrentUser();
    const currentUserId = currentUser?.id || null;

    // 1. Contar seguidores (followingId = targetUserId)
    const followersList = await db.query.follows.findMany({
      where: eq(follows.followingId, targetUserId)
    });
    
    // 2. Contar siguiendo (followerId = targetUserId)
    const followingList = await db.query.follows.findMany({
      where: eq(follows.followerId, targetUserId)
    });

    // 3. Verificar si el usuario actual sigue al targetUserId
    let isFollowing = false;
    if (currentUserId) {
      const match = await db.query.follows.findFirst({
        where: and(
          eq(follows.followerId, currentUserId),
          eq(follows.followingId, targetUserId)
        )
      });
      isFollowing = !!match;
    }

    return {
      success: true,
      followersCount: followersList.length,
      followingCount: followingList.length,
      isFollowing
    };
  } catch (error: any) {
    console.error("Error al obtener estadísticas de follows:", error);
    return { success: false, followersCount: 0, followingCount: 0, isFollowing: false };
  }
}
