"use server";

import { db, poolDb } from "@/db";
import { comments, posts, communities, communityMembers, auditLogs, reputationEvents, attachments } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { createNotificationTx } from "@/lib/notifications";
import { AttachmentInput } from "./posts";
import { checkAndAwardFirstCommentBadge, syncUserReputationAndLevel } from "@/lib/reputation";

interface CreateCommentInput {
  postId: string;
  content: string;
  parentId?: string;
  attachments?: AttachmentInput[];
}

/**
 * Server Action para crear un comentario o respuesta anidada.
 */
export async function createCommentAction(formData: CreateCommentInput) {
  const user = await requireAuth();

  const content = formData.content.trim();
  const hasAttachments = formData.attachments && formData.attachments.length > 0;
  if (!content && !hasAttachments) {
    return { success: false, error: "El contenido del comentario no puede estar vacío." };
  }

  // 1. Obtener post y comunidad
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, formData.postId), isNull(posts.deletedAt)),
  });

  if (!post) {
    return { success: false, error: "La publicación no existe o fue eliminada." };
  }

  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";

  // 2. Si el post está oculto (HIDDEN) o borrado (DELETED), no permitir comentarios a usuarios comunes
  if (post.status === "DELETED") {
    return { success: false, error: "No puedes comentar en una publicación eliminada." };
  }
  
  if (post.status === "HIDDEN" && !isGlobalAdmin) {
    // Verificar si es moderador/admin de la comunidad
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, post.communityId),
        eq(communityMembers.userId, user.id)
      ),
    });
    
    const isLocalModOrAdmin = membership && 
      (membership.role.toLowerCase() === "owner" || membership.role === "COMMUNITY_ADMIN" || membership.role === "MODERATOR") && 
      membership.status.toUpperCase() === "APPROVED";

    if (!isLocalModOrAdmin) {
      return { success: false, error: "No puedes comentar en una publicación oculta." };
    }
  }

  // 3. Verificar membresía aprobada en la comunidad (o global admin)
  if (!isGlobalAdmin) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, post.communityId),
        eq(communityMembers.userId, user.id)
      ),
    });

    if (!membership || membership.status.toUpperCase() !== "APPROVED") {
      return {
        success: false,
        error: "No tienes permiso para comentar en esta comunidad. Debes ser un miembro aprobado."
      };
    }
  }

  // 4. Si tiene parentId, verificar comentario padre
  let parentCommentAuthorId: string | null = null;
  if (formData.parentId) {
    const parentComment = await db.query.comments.findFirst({
      where: and(eq(comments.id, formData.parentId), isNull(comments.deletedAt)),
    });
    if (!parentComment) {
      return { success: false, error: "El comentario al que intentas responder no existe." };
    }
    if (parentComment.postId !== formData.postId) {
      return { success: false, error: "El comentario de origen pertenece a otra publicación." };
    }
    parentCommentAuthorId = parentComment.authorId;
  }

  // 5. Insertar comentario y log de auditoría en una transacción atómica
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  });

  try {
    const newComment = await poolDb.transaction(async (tx) => {
      const [inserted] = await tx.insert(comments).values({
        postId: formData.postId,
        parentId: formData.parentId || null,
        authorId: user.id,
        content,
        status: "ACTIVE",
      }).returning();

      // Guardar metadata de adjuntos
      if (formData.attachments && formData.attachments.length > 0) {
        await tx.insert(attachments).values(
          formData.attachments.map((att) => ({
            uploaderId: user.id,
            targetType: "COMMENT",
            targetId: inserted.id,
            fileUrl: att.fileUrl,
            fileKey: att.fileKey,
            fileName: att.fileName,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
          }))
        );
      }

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "COMMENT_CREATE",
        targetType: "COMMENT",
        targetId: inserted.id,
        description: `Comentario creado en la publicación "${post.title}"`,
      });

      // Crear notificación
      if (formData.parentId && parentCommentAuthorId) {
        if (parentCommentAuthorId !== user.id) {
          await createNotificationTx(tx, {
            recipientId: parentCommentAuthorId,
            senderId: user.id,
            type: "COMMENT",
            targetType: "COMMENT",
            targetId: inserted.id,
          });
        }
      } else {
        if (post.authorId !== user.id) {
          await createNotificationTx(tx, {
            recipientId: post.authorId,
            senderId: user.id,
            type: "COMMENT",
            targetType: "POST",
            targetId: inserted.id,
          });
        }
      }

      // Insignias automáticas
      await checkAndAwardFirstCommentBadge(tx, user.id);

      return inserted;
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}/post/${formData.postId}`);
    }
    return { success: true, commentId: newComment.id };
  } catch (error) {
    console.error("Error al crear comentario:", error);
    return { success: false, error: "Error interno del servidor al crear el comentario." };
  }
}

/**
 * Server Action para actualizar un comentario existente.
 */
export async function updateCommentAction(commentId: string, content: string) {
  const user = await requireAuth();
  const trimmedContent = content.trim();

  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), isNull(comments.deletedAt)),
  });

  if (!comment) {
    return { success: false, error: "El comentario no existe o fue eliminado." };
  }

  if (comment.authorId !== user.id) {
    return { success: false, error: "No autorizado: Solo el autor puede editar su comentario." };
  }

  const commentAttachments = await db.query.attachments.findMany({
    where: and(
      eq(attachments.targetType, "COMMENT"),
      eq(attachments.targetId, commentId)
    )
  });
  const hasAttachments = commentAttachments.length > 0;

  if (!trimmedContent && !hasAttachments) {
    return { success: false, error: "El contenido del comentario no puede estar vacío." };
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, comment.postId),
  });
  const community = post ? await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  }) : null;

  try {
    await poolDb.transaction(async (tx) => {
      await tx.update(comments).set({
        content: trimmedContent,
        updatedAt: new Date(),
      }).where(eq(comments.id, commentId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "COMMENT_UPDATE",
        targetType: "COMMENT",
        targetId: commentId,
        description: `Comentario actualizado`,
      });
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}/post/${comment.postId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar comentario:", error);
    return { success: false, error: "Error al actualizar el comentario." };
  }
}

/**
 * Server Action para soft delete de un comentario propio.
 */
export async function softDeleteCommentAction(commentId: string) {
  const user = await requireAuth();

  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), isNull(comments.deletedAt)),
  });

  if (!comment) {
    return { success: false, error: "El comentario no existe o ya fue eliminado." };
  }

  if (comment.authorId !== user.id) {
    return { success: false, error: "No autorizado: Solo el autor puede eliminar su comentario." };
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, comment.postId),
  });
  const community = post ? await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  }) : null;

  try {
    await poolDb.transaction(async (tx) => {
      // 1. Marcar el comentario como eliminado
      await tx.update(comments).set({
        status: "DELETED",
        deletedAt: new Date(),
      }).where(eq(comments.id, commentId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "COMMENT_DELETE",
        targetType: "COMMENT",
        targetId: commentId,
        description: `Comentario eliminado por su autor`,
      });

      // 2. Si el comentario era la respuesta aceptada, removerla y revertir reputación
      if (post && post.acceptedAnswerId === commentId) {
        await tx.update(posts).set({
          acceptedAnswerId: null,
          updatedAt: new Date(),
        }).where(eq(posts.id, post.id));

        await tx.insert(reputationEvents).values({
          userId: comment.authorId,
          eventType: "ANSWER_UNACCEPTED",
          points: -50,
          sourceType: "COMMENT",
          sourceId: commentId,
        });

        await syncUserReputationAndLevel(tx, comment.authorId);

        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: "ANSWER_UNACCEPTED",
          targetType: "POST",
          targetId: post.id,
          description: `Respuesta aceptada revocada porque el comentario fue eliminado`,
        });
      }
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}/post/${comment.postId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error al eliminar comentario:", error);
    return { success: false, error: "Error al eliminar el comentario." };
  }
}

/**
 * Server Action para ocultar (moderación) un comentario.
 */
export async function hideCommentAction(commentId: string) {
  const user = await requireAuth();

  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), isNull(comments.deletedAt)),
  });

  if (!comment) {
    return { success: false, error: "El comentario no existe." };
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, comment.postId),
  });

  if (!post) {
    return { success: false, error: "La publicación relacionada no existe." };
  }

  // Verificar permisos de moderación
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  let isAllowed = isGlobalAdmin;

  if (!isGlobalAdmin) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, post.communityId),
        eq(communityMembers.userId, user.id)
      ),
    });

    if (
      membership && 
      (membership.role.toLowerCase() === "owner" || membership.role === "COMMUNITY_ADMIN" || membership.role === "MODERATOR") && 
      membership.status.toUpperCase() === "APPROVED"
    ) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    return {
      success: false,
      error: "No autorizado: Requiere privilegios de moderación."
    };
  }

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  });

  try {
    await poolDb.transaction(async (tx) => {
      await tx.update(comments).set({
        status: "HIDDEN",
        updatedAt: new Date(),
      }).where(eq(comments.id, commentId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "COMMENT_HIDE",
        targetType: "COMMENT",
        targetId: commentId,
        description: `Comentario marcado como oculto por moderación`,
      });
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}/post/${comment.postId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error al ocultar comentario:", error);
    return { success: false, error: "Error al ocultar el comentario." };
  }
}

/**
 * Server Action para desocultar (moderación) un comentario.
 */
export async function unhideCommentAction(commentId: string) {
  const user = await requireAuth();

  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), isNull(comments.deletedAt)),
  });

  if (!comment) {
    return { success: false, error: "El comentario no existe." };
  }

  const post = await db.query.posts.findFirst({
    where: eq(posts.id, comment.postId),
  });

  if (!post) {
    return { success: false, error: "La publicación relacionada no existe." };
  }

  // Verificar permisos de moderación
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  let isAllowed = isGlobalAdmin;

  if (!isGlobalAdmin) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, post.communityId),
        eq(communityMembers.userId, user.id)
      ),
    });

    if (
      membership && 
      (membership.role.toLowerCase() === "owner" || membership.role === "COMMUNITY_ADMIN" || membership.role === "MODERATOR") && 
      membership.status.toUpperCase() === "APPROVED"
    ) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    return {
      success: false,
      error: "No autorizado: Requiere privilegios de moderación."
    };
  }

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  });

  try {
    await poolDb.transaction(async (tx) => {
      await tx.update(comments).set({
        status: "ACTIVE",
        updatedAt: new Date(),
      }).where(eq(comments.id, commentId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "COMMENT_UNHIDE",
        targetType: "COMMENT",
        targetId: commentId,
        description: `Comentario restaurado a activo por moderación`,
      });
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}/post/${comment.postId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error al mostrar comentario:", error);
    return { success: false, error: "Error al mostrar el comentario." };
  }
}

/**
 * Server Action para marcar/desmarcar una respuesta como aceptada.
 */
export async function acceptAnswerAction(postId: string, commentId: string) {
  const user = await requireAuth();

  // 1. Obtener el post y verificar que el usuario actual es el autor
  const post = await db.query.posts.findFirst({
    where: and(eq(posts.id, postId), isNull(posts.deletedAt)),
  });

  if (!post) {
    return { success: false, error: "La publicación no existe o fue eliminada." };
  }

  if (post.authorId !== user.id) {
    return { success: false, error: "No autorizado: Solo el autor de la publicación puede marcar una respuesta." };
  }

  // 2. Obtener el comentario y verificar que pertenezca a la publicación
  const comment = await db.query.comments.findFirst({
    where: and(eq(comments.id, commentId), isNull(comments.deletedAt)),
  });

  if (!comment) {
    return { success: false, error: "El comentario especificado no existe o fue eliminado." };
  }

  if (comment.postId !== postId) {
    return { success: false, error: "El comentario no pertenece a esta publicación." };
  }

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  });

  try {
    await poolDb.transaction(async (tx) => {
      // Caso A: Se está haciendo click sobre la respuesta que ya está aceptada (Des-aceptar / Toggle off)
      if (post.acceptedAnswerId === commentId) {
        // Remover del post
        await tx.update(posts).set({
          acceptedAnswerId: null,
          updatedAt: new Date(),
        }).where(eq(posts.id, postId));

        // Evento negativo de reputación
        await tx.insert(reputationEvents).values({
          userId: comment.authorId,
          eventType: "ANSWER_UNACCEPTED",
          points: -50,
          sourceType: "COMMENT",
          sourceId: commentId,
        });

        await syncUserReputationAndLevel(tx, comment.authorId);

        // Log de auditoría
        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: "ANSWER_UNACCEPTED",
          targetType: "POST",
          targetId: postId,
          description: `Respuesta desmarcada como aceptada: Comentario ${commentId}`,
        });
      } 
      // Caso B: Se está aceptando una respuesta nueva o cambiando la anterior
      else {
        // Si ya había una respuesta aceptada previa, revertir su reputación
        if (post.acceptedAnswerId) {
          const oldComment = await tx.query.comments.findFirst({
            where: eq(comments.id, post.acceptedAnswerId),
          });
          if (oldComment) {
            await tx.insert(reputationEvents).values({
              userId: oldComment.authorId,
              eventType: "ANSWER_UNACCEPTED",
              points: -50,
              sourceType: "COMMENT",
              sourceId: post.acceptedAnswerId,
            });

            await syncUserReputationAndLevel(tx, oldComment.authorId);

            await tx.insert(auditLogs).values({
              actorId: user.id,
              action: "ANSWER_UNACCEPTED",
              targetType: "POST",
              targetId: postId,
              description: `Respuesta aceptada anterior revocada: Comentario ${post.acceptedAnswerId}`,
            });
          }
        }

        // Marcar la nueva respuesta como aceptada
        await tx.update(posts).set({
          acceptedAnswerId: commentId,
          updatedAt: new Date(),
        }).where(eq(posts.id, postId));

        // Otorgar puntos al autor del nuevo comentario
        await tx.insert(reputationEvents).values({
          userId: comment.authorId,
          eventType: "ANSWER_ACCEPTED",
          points: 50,
          sourceType: "COMMENT",
          sourceId: commentId,
        });

        await syncUserReputationAndLevel(tx, comment.authorId);

        // Log de auditoría
        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: "ANSWER_ACCEPTED",
          targetType: "POST",
          targetId: postId,
          description: `Respuesta marcada como aceptada: Comentario ${commentId}`,
        });

        // Notificar al autor del comentario
        if (comment.authorId !== user.id) {
          await createNotificationTx(tx, {
            recipientId: comment.authorId,
            senderId: user.id,
            type: "REACTION",
            targetType: "COMMENT",
            targetId: commentId,
          });
        }
      }
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}/post/${postId}`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error al gestionar respuesta aceptada:", error);
    return { success: false, error: "Error interno del servidor al procesar la respuesta aceptada." };
  }
}
