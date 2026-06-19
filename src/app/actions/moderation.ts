"use server";

import { db, poolDb } from "@/db";
import { reports, posts, comments, communityMembers, users, auditLogs, communities } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

const VALID_REASONS = ["SPAM", "HARASSMENT", "MISINFORMATION", "OFF_TOPIC", "ILLEGAL", "OTHER"];

// Helper para obtener el communityId de un target
async function getTargetCommunityId(targetType: string, targetId: string) {
  if (targetType === "POST") {
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, targetId),
    });
    return post ? post.communityId : null;
  } else if (targetType === "COMMENT") {
    const comment = await db.query.comments.findFirst({
      where: eq(comments.id, targetId),
    });
    if (!comment) return null;
    const post = await db.query.posts.findFirst({
      where: eq(posts.id, comment.postId),
    });
    return post ? post.communityId : null;
  }
  return null;
}

// Helper para verificar si el usuario tiene privilegios de moderación en la comunidad o a nivel global
async function checkModerationPermission(user: any, communityId: string | null) {
  if (user.globalRole === "GLOBAL_ADMIN") {
    return true;
  }
  if (!communityId) {
    return false;
  }
  const membership = await db.query.communityMembers.findFirst({
    where: and(
      eq(communityMembers.communityId, communityId),
      eq(communityMembers.userId, user.id),
      eq(communityMembers.status, "APPROVED")
    ),
  });
  return membership && (membership.role === "COMMUNITY_ADMIN" || membership.role === "MODERATOR");
}

interface ReportInput {
  targetType: "POST" | "COMMENT";
  targetId: string;
  reason: string;
  description?: string;
}

/**
 * Crea un reporte contra un post o comentario.
 */
export async function createReportAction(formData: ReportInput) {
  const user = await requireAuth();

  const targetType = formData.targetType;
  const targetId = formData.targetId;
  const reason = formData.reason;
  const description = formData.description?.trim() || null;

  if (targetType !== "POST" && targetType !== "COMMENT") {
    return { success: false, error: "Tipo de contenido no válido." };
  }

  if (!VALID_REASONS.includes(reason)) {
    return { success: false, error: "Razón de reporte no válida." };
  }

  // Verificar si existe el target
  if (targetType === "POST") {
    const postExists = await db.query.posts.findFirst({
      where: eq(posts.id, targetId),
    });
    if (!postExists) {
      return { success: false, error: "El post reportado no existe." };
    }
  } else {
    const commentExists = await db.query.comments.findFirst({
      where: eq(comments.id, targetId),
    });
    if (!commentExists) {
      return { success: false, error: "El comentario reportado no existe." };
    }
  }

  // Evitar reportes duplicados por mismo usuario/target si está pendiente
  const existingReport = await db.query.reports.findFirst({
    where: and(
      eq(reports.reporterId, user.id),
      eq(reports.targetType, targetType),
      eq(reports.targetId, targetId),
      eq(reports.status, "PENDING")
    ),
  });

  if (existingReport) {
    return { success: false, error: "Ya has reportado este contenido y tu reporte se encuentra en revisión." };
  }

  try {
    const [newReport] = await poolDb.insert(reports).values({
      reporterId: user.id,
      targetType,
      targetId,
      reason,
      description,
      status: "PENDING",
    }).returning();

    // Log de auditoría para creación de reporte
    await poolDb.insert(auditLogs).values({
      actorId: user.id,
      action: "REPORT_CREATE",
      targetType: "REPORT",
      targetId: newReport.id,
      description: `Reporte creado contra ${targetType} ${targetId}. Razón: ${reason}`,
    });

    return { success: true, reportId: newReport.id };
  } catch (error: any) {
    console.error("Error al crear reporte:", error);
    return { success: false, error: "Error interno del servidor al procesar el reporte." };
  }
}

/**
 * Resuelve un reporte marcándolo como RESOLVED.
 */
export async function resolveReportAction(reportId: string, resolutionNotes: string) {
  const user = await requireAuth();

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  });

  if (!report) {
    return { success: false, error: "Reporte no encontrado." };
  }

  const communityId = await getTargetCommunityId(report.targetType, report.targetId);
  const isAllowed = await checkModerationPermission(user, communityId);

  if (!isAllowed) {
    return { success: false, error: "No tienes permisos de moderación para realizar esta acción." };
  }

  try {
    await poolDb.transaction(async (tx) => {
      await tx.update(reports).set({
        status: "RESOLVED",
        moderatorId: user.id,
        resolutionNotes: resolutionNotes || "Reporte marcado como resuelto.",
        updatedAt: new Date(),
      }).where(eq(reports.id, reportId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "REPORT_RESOLVE",
        targetType: "REPORT",
        targetId: reportId,
        description: `Reporte ${reportId} resuelto de manera directa. Notas: ${resolutionNotes}`,
      });
    });

    // Revalidar rutas pertinentes
    if (communityId) {
      const community = await db.query.communities.findFirst({
        where: eq(communities.id, communityId),
      });
      if (community) {
        revalidatePath(`/app/r/${community.slug}/moderation`);
      }
    }
    revalidatePath("/app/admin");

    return { success: true };
  } catch (error: any) {
    console.error("Error al resolver reporte:", error);
    return { success: false, error: "Error interno del servidor al resolver reporte." };
  }
}

/**
 * Descarta un reporte marcándolo como DISMISSED.
 */
export async function dismissReportAction(reportId: string, resolutionNotes: string) {
  const user = await requireAuth();

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  });

  if (!report) {
    return { success: false, error: "Reporte no encontrado." };
  }

  const communityId = await getTargetCommunityId(report.targetType, report.targetId);
  const isAllowed = await checkModerationPermission(user, communityId);

  if (!isAllowed) {
    return { success: false, error: "No tienes permisos de moderación para realizar esta acción." };
  }

  try {
    await poolDb.transaction(async (tx) => {
      await tx.update(reports).set({
        status: "DISMISSED",
        moderatorId: user.id,
        resolutionNotes: resolutionNotes || "Reporte descartado por el moderador.",
        updatedAt: new Date(),
      }).where(eq(reports.id, reportId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "REPORT_DISMISS",
        targetType: "REPORT",
        targetId: reportId,
        description: `Reporte ${reportId} descartado. Notas: ${resolutionNotes}`,
      });
    });

    if (communityId) {
      const community = await db.query.communities.findFirst({
        where: eq(communities.id, communityId),
      });
      if (community) {
        revalidatePath(`/app/r/${community.slug}/moderation`);
      }
    }
    revalidatePath("/app/admin");

    return { success: true };
  } catch (error: any) {
    console.error("Error al descartar reporte:", error);
    return { success: false, error: "Error interno del servidor al descartar reporte." };
  }
}

/**
 * Oculta el contenido reportado y marca el reporte como RESOLVED.
 */
export async function hideReportedContentAction(reportId: string) {
  const user = await requireAuth();

  const report = await db.query.reports.findFirst({
    where: eq(reports.id, reportId),
  });

  if (!report) {
    return { success: false, error: "Reporte no encontrado." };
  }

  const communityId = await getTargetCommunityId(report.targetType, report.targetId);
  const isAllowed = await checkModerationPermission(user, communityId);

  if (!isAllowed) {
    return { success: false, error: "No tienes permisos de moderación para realizar esta acción." };
  }

  try {
    await poolDb.transaction(async (tx) => {
      // 1. Ocultar contenido
      if (report.targetType === "POST") {
        await tx.update(posts).set({
          status: "HIDDEN",
          updatedAt: new Date(),
        }).where(eq(posts.id, report.targetId));

        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: "POST_HIDE",
          targetType: "POST",
          targetId: report.targetId,
          description: `Publicación ocultada tras reporte ${reportId}`,
        });
      } else if (report.targetType === "COMMENT") {
        await tx.update(comments).set({
          status: "HIDDEN",
          updatedAt: new Date(),
        }).where(eq(comments.id, report.targetId));

        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: "COMMENT_HIDE",
          targetType: "COMMENT",
          targetId: report.targetId,
          description: `Comentario ocultado tras reporte ${reportId}`,
        });
      }

      // 2. Resolver reporte
      await tx.update(reports).set({
        status: "RESOLVED",
        moderatorId: user.id,
        resolutionNotes: "Contenido ocultado por moderación.",
        updatedAt: new Date(),
      }).where(eq(reports.id, reportId));

      // 3. Registrar auditoría de resolución de reporte
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "REPORT_RESOLVE",
        targetType: "REPORT",
        targetId: reportId,
        description: `Reporte ${reportId} resuelto ocultando el contenido.`,
      });
    });

    if (communityId) {
      const community = await db.query.communities.findFirst({
        where: eq(communities.id, communityId),
      });
      if (community) {
        revalidatePath(`/app/r/${community.slug}/moderation`);
        revalidatePath(`/app/r/${community.slug}`);
      }
    }
    revalidatePath("/app/admin");
    revalidatePath("/app");

    return { success: true };
  } catch (error: any) {
    console.error("Error al ocultar contenido reportado:", error);
    return { success: false, error: "Error interno del servidor al ocultar el contenido." };
  }
}

/**
 * Suspende a un usuario (solo GLOBAL_ADMIN).
 */
export async function suspendUserAction(userId: string, reason: string) {
  const user = await requireAuth();

  if (user.globalRole !== "GLOBAL_ADMIN") {
    return { success: false, error: "No autorizado: Requiere rol GLOBAL_ADMIN." };
  }

  const userToSuspend = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!userToSuspend) {
    return { success: false, error: "Usuario no encontrado." };
  }

  try {
    await poolDb.transaction(async (tx) => {
      await tx.update(users).set({
        isSuspended: true,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "USER_SUSPEND",
        targetType: "USER",
        targetId: userId,
        description: `Usuario ${userId} suspendido. Razón: ${reason}`,
      });
    });

    revalidatePath("/app/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error al suspender usuario:", error);
    return { success: false, error: "Error interno al suspender usuario." };
  }
}

/**
 * Levanta la suspensión de un usuario (solo GLOBAL_ADMIN).
 */
export async function unsuspendUserAction(userId: string) {
  const user = await requireAuth();

  if (user.globalRole !== "GLOBAL_ADMIN") {
    return { success: false, error: "No autorizado: Requiere rol GLOBAL_ADMIN." };
  }

  const userToUnsuspend = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!userToUnsuspend) {
    return { success: false, error: "Usuario no encontrado." };
  }

  try {
    await poolDb.transaction(async (tx) => {
      await tx.update(users).set({
        isSuspended: false,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "USER_UNSUSPEND",
        targetType: "USER",
        targetId: userId,
        description: `Suspensión revocada para el usuario ${userId}`,
      });
    });

    revalidatePath("/app/admin");
    return { success: true };
  } catch (error: any) {
    console.error("Error al restaurar usuario:", error);
    return { success: false, error: "Error interno al restaurar usuario." };
  }
}
