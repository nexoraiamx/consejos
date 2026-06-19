"use server";

import { db, poolDb } from "@/db";
import { posts, communities, communityMembers, auditLogs, attachments } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { createNotificationTx } from "@/lib/notifications";

export interface AttachmentInput {
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface PostInput {
  communityId: string;
  title: string;
  content: string;
  postType: "QUESTION" | "RESOURCE" | "DISCUSSION" | "CASE_STUDY";
  category?: string;
  tags?: string[];
  attachments?: AttachmentInput[];
}

/**
 * Server Action para crear una publicación dentro de una comunidad.
 */
export async function createPostAction(formData: PostInput) {
  const user = await requireAuth();

  const title = formData.title.trim();
  const content = formData.content.trim();
  const postType = formData.postType;
  const category = formData.category?.trim();
  const tags = (formData.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean);

  // 1. Validaciones
  if (!title || title.length < 5 || title.length > 256) {
    return { success: false, error: "El título debe tener entre 5 y 256 caracteres." };
  }

  if (!content) {
    return { success: false, error: "El contenido de la publicación no puede estar vacío." };
  }

  const validTypes = ["QUESTION", "RESOURCE", "DISCUSSION", "CASE_STUDY"];
  if (!validTypes.includes(postType)) {
    return { success: false, error: "Tipo de publicación no válido." };
  }

  // 2. Verificar permisos del usuario
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";

  if (!isGlobalAdmin) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, formData.communityId),
        eq(communityMembers.userId, user.id)
      ),
    });

    if (!membership || membership.status !== "APPROVED") {
      return {
        success: false,
        error: "No tienes permiso para publicar en esta comunidad. Debes ser un miembro aprobado."
      };
    }
  }

  // 3. Obtener slug de comunidad para redirecciones
  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.id, formData.communityId),
      isNull(communities.deletedAt)
    ),
  });

  if (!community) {
    return { success: false, error: "La comunidad especificada no existe." };
  }

  try {
    // Usar poolDb.transaction para atomicidad real
    const newPost = await poolDb.transaction(async (tx) => {
      const [insertedPost] = await tx.insert(posts).values({
        communityId: formData.communityId,
        authorId: user.id,
        title,
        content,
        postType,
        category: category || null,
        tags,
        status: "ACTIVE",
      }).returning();

      // Guardar metadata de adjuntos
      if (formData.attachments && formData.attachments.length > 0) {
        await tx.insert(attachments).values(
          formData.attachments.map((att) => ({
            uploaderId: user.id,
            targetType: "POST",
            targetId: insertedPost.id,
            fileUrl: att.fileUrl,
            fileKey: att.fileKey,
            fileName: att.fileName,
            fileSize: att.fileSize,
            mimeType: att.mimeType,
          }))
        );
      }

      // Log de auditoría
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "POST_CREATE",
        targetType: "POST",
        targetId: insertedPost.id,
        description: `Publicación creada: "${title}" (${postType}) en r/${community.slug}`,
      });

      return insertedPost;
    });

    revalidatePath(`/app/r/${community.slug}`);
    revalidatePath("/app");
    return { success: true, postId: newPost.id, slug: community.slug };
  } catch (error) {
    console.error("Error al crear post:", error);
    return { success: false, error: "Error interno del servidor al procesar la publicación." };
  }
}

/**
 * Server Action para actualizar un post existente.
 */
export async function updatePostAction(
  postId: string,
  formData: Omit<PostInput, "communityId">
) {
  const user = await requireAuth();

  const title = formData.title.trim();
  const content = formData.content.trim();
  const postType = formData.postType;
  const category = formData.category?.trim();
  const tags = (formData.tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean);

  // 1. Validaciones
  if (!title || title.length < 5 || title.length > 256) {
    return { success: false, error: "El título debe tener entre 5 y 256 caracteres." };
  }

  if (!content) {
    return { success: false, error: "El contenido de la publicación no puede estar vacío." };
  }

  const validTypes = ["QUESTION", "RESOURCE", "DISCUSSION", "CASE_STUDY"];
  if (!validTypes.includes(postType)) {
    return { success: false, error: "Tipo de publicación no válido." };
  }

  // 2. Obtener el post y validar autoría
  const post = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, postId),
      isNull(posts.deletedAt)
    ),
  });

  if (!post) {
    return { success: false, error: "La publicación no existe o fue eliminada." };
  }

  if (post.authorId !== user.id) {
    return { success: false, error: "No autorizado: Solo el creador puede editar esta publicación." };
  }

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  });

  try {
    // Usar poolDb.transaction para atomicidad real
    await poolDb.transaction(async (tx) => {
      await tx.update(posts).set({
        title,
        content,
        postType,
        category: category || null,
        tags,
        updatedAt: new Date(),
      }).where(eq(posts.id, postId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "POST_UPDATE",
        targetType: "POST",
        targetId: postId,
        description: `Publicación editada: "${title}" (${postType})`,
      });
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}`);
      revalidatePath(`/app/r/${community.slug}/post/${postId}`);
    }
    revalidatePath("/app");
    return { success: true, slug: community?.slug };
  } catch (error) {
    console.error("Error al actualizar post:", error);
    return { success: false, error: "Error al intentar actualizar la publicación." };
  }
}

/**
 * Server Action para soft delete de un post propio.
 */
export async function softDeletePostAction(postId: string) {
  const user = await requireAuth();

  const post = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, postId),
      isNull(posts.deletedAt)
    ),
  });

  if (!post) {
    return { success: false, error: "La publicación no existe." };
  }

  if (post.authorId !== user.id) {
    return { success: false, error: "No autorizado: Solo el autor puede eliminar esta publicación." };
  }

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  });

  try {
    // Usar poolDb.transaction para atomicidad real
    await poolDb.transaction(async (tx) => {
      await tx.update(posts).set({
        status: "DELETED",
        deletedAt: new Date(),
      }).where(eq(posts.id, postId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "POST_DELETE",
        targetType: "POST",
        targetId: postId,
        description: `Publicación eliminada (Soft delete): "${post.title}"`,
      });
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}`);
    }
    revalidatePath("/app");
    return { success: true, slug: community?.slug };
  } catch (error) {
    console.error("Error al eliminar post:", error);
    return { success: false, error: "Error al procesar la eliminación." };
  }
}

/**
 * Server Action para ocultar (moderación) un post de cualquier usuario.
 */
export async function hidePostAction(postId: string) {
  const user = await requireAuth();

  const post = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, postId),
      isNull(posts.deletedAt)
    ),
  });

  if (!post) {
    return { success: false, error: "La publicación no existe." };
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
      (membership.role === "COMMUNITY_ADMIN" || membership.role === "MODERATOR") && 
      membership.status === "APPROVED"
    ) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    return {
      success: false,
      error: "No autorizado: Requiere privilegios de moderación o administración."
    };
  }

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  });

  try {
    // Usar poolDb.transaction para atomicidad real
    await poolDb.transaction(async (tx) => {
      await tx.update(posts).set({
        status: "HIDDEN",
        updatedAt: new Date(),
      }).where(eq(posts.id, postId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "POST_HIDE",
        targetType: "POST",
        targetId: postId,
        description: `Publicación marcada como oculta por moderación: "${post.title}"`,
      });

      if (post.authorId !== user.id) {
        await createNotificationTx(tx, {
          recipientId: post.authorId,
          senderId: user.id,
          type: "MODERATION",
          targetType: "POST",
          targetId: postId,
        });
      }
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}`);
      revalidatePath(`/app/r/${community.slug}/post/${postId}`);
    }
    revalidatePath("/app");
    return { success: true, status: "HIDDEN" };
  } catch (error) {
    console.error("Error al ocultar post:", error);
    return { success: false, error: "Error al ocultar la publicación." };
  }
}

/**
 * Server Action para mostrar (unhide) un post ocultado por moderación.
 */
export async function unhidePostAction(postId: string) {
  const user = await requireAuth();

  const post = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, postId),
      isNull(posts.deletedAt)
    ),
  });

  if (!post) {
    return { success: false, error: "La publicación no existe." };
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
      (membership.role === "COMMUNITY_ADMIN" || membership.role === "MODERATOR") && 
      membership.status === "APPROVED"
    ) {
      isAllowed = true;
    }
  }

  if (!isAllowed) {
    return {
      success: false,
      error: "No autorizado: Requiere privilegios de moderación o administración."
    };
  }

  const community = await db.query.communities.findFirst({
    where: eq(communities.id, post.communityId),
  });

  try {
    // Usar poolDb.transaction para atomicidad real
    await poolDb.transaction(async (tx) => {
      await tx.update(posts).set({
        status: "ACTIVE",
        updatedAt: new Date(),
      }).where(eq(posts.id, postId));

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "POST_UNHIDE",
        targetType: "POST",
        targetId: postId,
        description: `Publicación restaurada a activa por moderación: "${post.title}"`,
      });
    });

    if (community) {
      revalidatePath(`/app/r/${community.slug}`);
      revalidatePath(`/app/r/${community.slug}/post/${postId}`);
    }
    revalidatePath("/app");
    return { success: true, status: "ACTIVE" };
  } catch (error) {
    console.error("Error al mostrar post:", error);
    return { success: false, error: "Error al mostrar la publicación." };
  }
}
