"use server";

import { db, poolDb } from "@/db";
import { communities, communityMembers, auditLogs, invitations, joinRequests, posts, comments, attachments, communitySlugRedirects } from "@/db/schema";
import { eq, and, isNull, or, inArray } from "drizzle-orm";
import { requireAuth, getUserCommunityRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { createNotificationTx } from "@/lib/notifications";
import { awardBadgeTx } from "@/lib/reputation";
import { deleteR2Objects } from "@/lib/r2";

interface CreateCommunityInput {
  displayName: string;
  slug: string;
  description: string;
  privacyType: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  avatarUrl?: string;
  bannerUrl?: string;
  category?: string;
}

/**
 * Server Action para crear una nueva comunidad.
 */
export async function createCommunityAction(formData: CreateCommunityInput) {
  const user = await requireAuth();

  const displayName = formData.displayName.trim();
  const slug = formData.slug.trim().toLowerCase();
  const description = formData.description.trim();
  const privacyType = formData.privacyType;

  // Validaciones del lado del servidor
  if (!displayName || displayName.length < 3 || displayName.length > 100) {
    return { success: false, error: "El nombre debe tener entre 3 y 100 caracteres." };
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { success: false, error: "El slug solo puede contener letras minúsculas, números y guiones." };
  }

  if (slug.length < 3 || slug.length > 50) {
    return { success: false, error: "El slug debe tener entre 3 y 50 caracteres." };
  }

  // Verificar unicidad de slug
  const existing = await db.query.communities.findFirst({
    where: and(
      eq(communities.slug, slug),
      isNull(communities.deletedAt)
    ),
  });

  if (existing) {
    return { success: false, error: "Este slug ya está en uso. Por favor elige otro." };
  }

  try {
    const result = await poolDb.transaction(async (tx) => {
      // 1. Crear la comunidad
      const [newCommunity] = await tx.insert(communities).values({
        slug,
        displayName,
        description: description || null,
        privacyType,
        creatorId: user.id,
        avatarUrl: formData.avatarUrl || null,
        bannerUrl: formData.bannerUrl || null,
        category: formData.category || null,
      }).returning();

      // 2. Unir al creador como COMMUNITY_ADMIN y APPROVED
      await tx.insert(communityMembers).values({
        communityId: newCommunity.id,
        userId: user.id,
        role: "COMMUNITY_ADMIN",
        status: "APPROVED",
      });

      // 2.5 Otorga insignias de fundador y administrador
      await awardBadgeTx(tx, user.id, "COMMUNITY_FOUNDER");
      await awardBadgeTx(tx, user.id, "COMMUNITY_ADMIN");

      // 3. Crear log de auditoría
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "COMMUNITY_CREATE",
        targetType: "COMMUNITY",
        targetId: newCommunity.id,
        description: `Comunidad creada: ${displayName} (${slug}) con privacidad ${privacyType}`,
      });

      return newCommunity;
    });

    revalidatePath("/app", "layout");
    revalidatePath("/app/explore");
    revalidatePath(`/app/r/${result.slug}`);
    return { success: true, slug: result.slug };
  } catch (error) {
    console.error("Error al crear comunidad:", error);
    return { success: false, error: "Error interno al procesar tu solicitud." };
  }
}

/**
 * Server Action para unirse o salirse (leave) de una comunidad o alternar solicitud de ingreso.
 */
export async function toggleJoinCommunityAction(communityId: string) {
  // Validar formato UUID de la comunidad
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(communityId)) {
    return { success: false, error: "ID de comunidad no válido." };
  }

  const user = await requireAuth();

  // Verificar que la comunidad exista
  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.id, communityId),
      isNull(communities.deletedAt)
    ),
  });

  if (!community) {
    return { success: false, error: "La comunidad especificada no existe." };
  }

  // Consultar membresía existente
  const existingMember = await db.query.communityMembers.findFirst({
    where: and(
      eq(communityMembers.communityId, communityId),
      eq(communityMembers.userId, user.id)
    ),
  });

  try {
    if (existingMember) {
      if (existingMember.status === "BANNED" || existingMember.status === "banned") {
        return {
          success: false,
          error: "Acceso denegado: Has sido suspendido o bloqueado de esta comunidad."
        };
      }

      // Si ya es miembro, se sale. El creador o administrador no puede salirse.
      const roleUpper = existingMember.role.toUpperCase();
      if (roleUpper === "OWNER" || roleUpper === "COMMUNITY_ADMIN") {
        return {
          success: false,
          error: "No puedes abandonar una comunidad que administras sin transferir la administración."
        };
      }

      await poolDb.transaction(async (tx) => {
        // Eliminar membresía
        await tx.delete(communityMembers).where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, user.id)
          )
        );

        // Crear audit log
        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: "COMMUNITY_LEAVE",
          targetType: "COMMUNITY",
          targetId: communityId,
          description: `El usuario abandonó la comunidad: ${community.displayName}`,
        });
      });

      revalidatePath("/app/explore");
      revalidatePath(`/app/r/${community.slug}`);
      revalidatePath("/app");
      return { success: true, joined: false, status: null };
    }

    // Si no es miembro:
    // Si la comunidad es PUBLIC, se une directamente.
    if (community.privacyType === "PUBLIC") {
      await poolDb.transaction(async (tx) => {
        await tx.insert(communityMembers).values({
          communityId,
          userId: user.id,
          role: "MEMBER",
          status: "APPROVED",
        });

        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: "COMMUNITY_JOIN",
          targetType: "COMMUNITY",
          targetId: communityId,
          description: `El usuario se unió a la comunidad: ${community.displayName}`,
        });

        await createNotificationTx(tx, {
          recipientId: user.id,
          senderId: null,
          type: "INVITATION",
          targetType: "COMMUNITY",
          targetId: communityId,
        });
      });

      revalidatePath("/app/explore");
      revalidatePath(`/app/r/${community.slug}`);
      revalidatePath("/app");
      return { success: true, joined: true, status: "APPROVED" };
    } else {
      // Si la comunidad es PRIVATE o INVITE_ONLY, creamos una solicitud en joinRequests (toggle behavior)
      const existingRequest = await db.query.joinRequests.findFirst({
        where: and(
          eq(joinRequests.communityId, communityId),
          eq(joinRequests.userId, user.id)
        ),
      });

      if (existingRequest) {
        // Si ya tiene una solicitud pendiente, cancelarla (toggle off)
        await db.delete(joinRequests).where(
          and(
            eq(joinRequests.communityId, communityId),
            eq(joinRequests.userId, user.id)
          )
        );

        revalidatePath("/app/explore");
        revalidatePath(`/app/r/${community.slug}`);
        revalidatePath("/app");
        return { success: true, joined: false, status: null };
      } else {
        // Crear solicitud de ingreso
        await db.insert(joinRequests).values({
          communityId,
          userId: user.id,
          status: "PENDING",
        });

        revalidatePath("/app/explore");
        revalidatePath(`/app/r/${community.slug}`);
        revalidatePath("/app");
        return { success: true, joined: false, status: "PENDING" };
      }
    }
  } catch (error) {
    console.error("Error al unirse/abandonar la comunidad:", error);
    return { success: false, error: "Error interno al procesar el cambio de membresía." };
  }
}

// Action to create an invitation
export async function createInvitationAction(communityId: string) {
  const user = await requireAuth();

  // Validate permission: must be COMMUNITY_ADMIN
  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && roleInfo.role === "COMMUNITY_ADMIN" && roleInfo.status === "APPROVED");

  if (!canManage) {
    return { success: false, error: "No tienes permiso para gestionar invitaciones de esta comunidad." };
  }

  // Generate unique alphanumeric code of length 8
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Check uniqueness
    const existing = await db.query.invitations.findFirst({
      where: eq(invitations.code, code)
    });
    if (!existing) isUnique = true;
  }

  if (!isUnique) {
    return { success: false, error: "No se pudo generar un código único. Inténtalo de nuevo." };
  }

  try {
    const [newInvite] = await db.insert(invitations).values({
      communityId,
      code,
      creatorId: user.id,
      isActive: true,
      usesCount: 0,
    }).returning();

    revalidatePath(`/app/r/${communityId}/admin`);
    return { success: true, invitation: newInvite };
  } catch (error) {
    console.error("Error al crear invitación:", error);
    return { success: false, error: "Error al generar el enlace de invitación." };
  }
}

// Action to deactivate an invitation
export async function deactivateInvitationAction(invitationId: string) {
  const user = await requireAuth();

  const invite = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId)
  });

  if (!invite) {
    return { success: false, error: "La invitación no existe." };
  }

  // Validate permission: must be COMMUNITY_ADMIN
  const roleInfo = await getUserCommunityRole(user.id, invite.communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && roleInfo.role === "COMMUNITY_ADMIN" && roleInfo.status === "APPROVED");

  if (!canManage) {
    return { success: false, error: "No tienes permiso para gestionar esta invitación." };
  }

  try {
    await db.update(invitations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(invitations.id, invitationId));

    revalidatePath(`/app/r/${invite.communityId}/admin`);
    return { success: true };
  } catch (error) {
    console.error("Error al desactivar invitación:", error);
    return { success: false, error: "Error al desactivar la invitación." };
  }
}

// Action to approve or reject join request
export async function processJoinRequestAction(requestId: string, action: "APPROVE" | "REJECT") {
  const user = await requireAuth();

  const request = await db.query.joinRequests.findFirst({
    where: eq(joinRequests.id, requestId)
  });

  if (!request) {
    return { success: false, error: "La solicitud de ingreso no existe." };
  }

  const roleInfo = await getUserCommunityRole(user.id, request.communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && roleInfo.role === "COMMUNITY_ADMIN" && roleInfo.status === "APPROVED");

  if (!canManage) {
    return { success: false, error: "No tienes permiso para gestionar solicitudes en esta comunidad." };
  }

  try {
    if (action === "APPROVE") {
      await poolDb.transaction(async (tx) => {
        // Insert member as approved
        await tx.insert(communityMembers).values({
          communityId: request.communityId,
          userId: request.userId,
          role: "MEMBER",
          status: "APPROVED"
        });

        // Delete join request
        await tx.delete(joinRequests).where(eq(joinRequests.id, requestId));

        // Create audit log
        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: "COMMUNITY_JOIN_APPROVED",
          targetType: "COMMUNITY",
          targetId: request.communityId,
          description: `Solicitud de ingreso aprobada para el usuario ${request.userId}`,
        });

        // Notify user
        await createNotificationTx(tx, {
          recipientId: request.userId,
          senderId: user.id,
          type: "INVITATION",
          targetType: "COMMUNITY",
          targetId: request.communityId,
        });
      });
    } else {
      // Reject request
      await db.delete(joinRequests).where(eq(joinRequests.id, requestId));
    }

    revalidatePath(`/app/r/${request.communityId}/admin`);
    return { success: true };
  } catch (error) {
    console.error("Error al procesar la solicitud de ingreso:", error);
    return { success: false, error: "Error al procesar la solicitud de ingreso." };
  }
}

// Action to update a member's role
export async function updateMemberRoleAction(communityId: string, memberUserId: string, newRole: "MEMBER" | "MODERATOR") {
  const user = await requireAuth();

  // Validate permission: only the COMMUNITY_ADMIN (or global admin) can change roles!
  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  
  // El creador es el único administrador local que puede cambiar los roles de otros administradores.
  // Obtenemos el creador de la comunidad para validar esto.
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId)
  });
  const isCreator = community && community.creatorId === user.id;
  
  const isOwner = isGlobalAdmin || (roleInfo && roleInfo.role === "COMMUNITY_ADMIN" && roleInfo.status === "APPROVED");

  if (!isOwner) {
    return { success: false, error: "Solo el propietario de la comunidad puede cambiar los roles de los miembros." };
  }

  // Fetch the target member
  const targetMember = await db.query.communityMembers.findFirst({
    where: and(
      eq(communityMembers.communityId, communityId),
      eq(communityMembers.userId, memberUserId)
    )
  });

  if (!targetMember) {
    return { success: false, error: "El miembro especificado no existe." };
  }

  const targetRoleUpper = targetMember.role.toUpperCase();
  if (targetRoleUpper === "OWNER" || targetRoleUpper === "COMMUNITY_ADMIN") {
    // Solo el creador original o global admin puede cambiar los roles de otros admins principales.
    if (!isCreator && !isGlobalAdmin) {
      return { success: false, error: "No puedes cambiar el rol del propietario de la comunidad." };
    }
  }

  try {
    await db.update(communityMembers)
      .set({ role: newRole, updatedAt: new Date() })
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, memberUserId)
        )
      );

    revalidatePath(`/app/r/${communityId}/admin`);
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar rol del miembro:", error);
    return { success: false, error: "Error al actualizar el rol." };
  }
}

// Action to expel a member from community
export async function expelMemberAction(communityId: string, memberUserId: string) {
  const user = await requireAuth();

  // Validate permission: COMMUNITY_ADMIN (or global admin)
  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && roleInfo.role === "COMMUNITY_ADMIN" && roleInfo.status === "APPROVED");

  if (!canManage) {
    return { success: false, error: "No tienes permiso para expulsar miembros de esta comunidad." };
  }

  // Fetch the target member
  const targetMember = await db.query.communityMembers.findFirst({
    where: and(
      eq(communityMembers.communityId, communityId),
      eq(communityMembers.userId, memberUserId)
    )
  });

  if (!targetMember) {
    return { success: false, error: "El miembro especificado no existe." };
  }

  // Safety checks: No se puede expulsar al creador
  const community = await db.query.communities.findFirst({
    where: eq(communities.id, communityId)
  });
  
  if (community && targetMember.userId === community.creatorId) {
    return { success: false, error: "No se puede expulsar al creador de la comunidad." };
  }

  // COMMUNITY_ADMIN cannot expel other administrators unless they are the creator or global admin
  const targetRoleUpper = targetMember.role.toUpperCase();
  const isUserCreator = community && community.creatorId === user.id;
  const isUserOwner = isGlobalAdmin || isUserCreator;
  
  if ((targetRoleUpper === "OWNER" || targetRoleUpper === "COMMUNITY_ADMIN") && !isUserOwner) {
    return { success: false, error: "No tienes permisos suficientes para expulsar a un administrador principal." };
  }

  try {
    await poolDb.transaction(async (tx) => {
      await tx.delete(communityMembers).where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, memberUserId)
        )
      );

      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "COMMUNITY_MEMBER_EXPEL",
        targetType: "COMMUNITY",
        targetId: communityId,
        description: `Usuario expulsado de la comunidad: ${memberUserId}`,
      });
    });

    revalidatePath(`/app/r/${communityId}/admin`);
    return { success: true };
  } catch (error) {
    console.error("Error al expulsar al miembro:", error);
    return { success: false, error: "Error al expulsar al miembro." };
  }
}

// Action to update community settings
export async function updateCommunitySettingsAction(
  communityId: string, 
  displayName: string, 
  description: string, 
  privacyType: "PUBLIC" | "PRIVATE" | "INVITE_ONLY",
  avatarUrl?: string | null,
  bannerUrl?: string | null,
  category?: string | null,
  newSlug?: string
) {
  const user = await requireAuth();

  // Validate permission: must be COMMUNITY_ADMIN
  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && roleInfo.role === "COMMUNITY_ADMIN" && roleInfo.status === "APPROVED");

  if (!canManage) {
    return { success: false, error: "No tienes permiso para actualizar los ajustes de esta comunidad." };
  }

  const community = await db.query.communities.findFirst({
    where: and(eq(communities.id, communityId), isNull(communities.deletedAt))
  });
  if (!community) {
    return { success: false, error: "La comunidad no existe o fue eliminada." };
  }

  let slugToSave = community.slug;
  let slugChanged = false;

  if (newSlug) {
    const cleanNewSlug = newSlug.trim().toLowerCase();
    if (cleanNewSlug !== community.slug) {
      // Validate format
      if (!/^[a-z0-9-]+$/.test(cleanNewSlug)) {
        return { success: false, error: "El slug solo puede contener letras minúsculas, números y guiones." };
      }
      if (cleanNewSlug.length < 3 || cleanNewSlug.length > 50) {
        return { success: false, error: "El slug debe tener entre 3 y 50 caracteres." };
      }
      // Check unicidad in active communities
      const existingSlug = await db.query.communities.findFirst({
        where: and(
          eq(communities.slug, cleanNewSlug),
          isNull(communities.deletedAt)
        )
      });
      if (existingSlug) {
        return { success: false, error: "Este slug ya está en uso por otra comunidad." };
      }
      // Check if this slug is an old slug in communitySlugRedirects for a different community
      const existingRedirect = await db.query.communitySlugRedirects.findFirst({
        where: eq(communitySlugRedirects.oldSlug, cleanNewSlug)
      });
      if (existingRedirect && existingRedirect.communityId !== communityId) {
        return { success: false, error: "Este slug está reservado por una redirección de otra comunidad." };
      }
      slugToSave = cleanNewSlug;
      slugChanged = true;
    }
  }

  try {
    await poolDb.transaction(async (tx) => {
      // 1. Actualizar configuración e imágenes
      await tx.update(communities)
        .set({
          displayName: displayName.trim(),
          description: description.trim() || null,
          privacyType,
          avatarUrl: avatarUrl || null,
          bannerUrl: bannerUrl || null,
          category: category || null,
          slug: slugToSave,
          updatedAt: new Date()
        })
        .where(eq(communities.id, communityId));

      // 2. Si el slug cambió, procesar redirecciones
      if (slugChanged) {
        // Eliminar cualquier redirección antigua donde oldSlug sea el nuevo slug (evitar bucles)
        await tx.delete(communitySlugRedirects)
          .where(eq(communitySlugRedirects.oldSlug, slugToSave));

        // Insertar la redirección del slug anterior al nuevo
        await tx.insert(communitySlugRedirects).values({
          oldSlug: community.slug,
          newSlug: slugToSave,
          communityId: communityId
        });

        // Actualizar redirecciones anteriores que apuntaban al slug viejo para que apunten al nuevo
        await tx.update(communitySlugRedirects)
          .set({ newSlug: slugToSave })
          .where(and(
            eq(communitySlugRedirects.communityId, communityId),
            eq(communitySlugRedirects.newSlug, community.slug)
          ));
      }
    });

    // Revalidar rutas
    revalidatePath(`/app/r/${community.slug}`);
    revalidatePath(`/app/r/${community.slug}/admin`);
    if (slugChanged) {
      revalidatePath(`/app/r/${slugToSave}`);
      revalidatePath(`/app/r/${slugToSave}/admin`);
    }
    revalidatePath("/app", "layout");
    revalidatePath("/app/explore");

    return { success: true };
  } catch (error) {
    console.error("Error al actualizar comunidad:", error);
    return { success: false, error: "Error al guardar los cambios." };
  }
}

function extractFileKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const index = url.indexOf("uploads/");
  if (index !== -1) {
    return url.substring(index);
  }
  return null;
}

/**
 * Server Action para soft delete de una comunidad.
 */
export async function deleteCommunityAction(communityId: string) {
  const user = await requireAuth();

  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.id, communityId),
      isNull(communities.deletedAt)
    )
  });

  if (!community) {
    return { success: false, error: "La comunidad no existe o ya fue eliminada." };
  }

  // Verificar permisos:
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const isCreator = community.creatorId === user.id;

  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isCommunityAdmin = roleInfo && roleInfo.role === "COMMUNITY_ADMIN" && roleInfo.status === "APPROVED";

  const canDelete = isGlobalAdmin || isCreator || isCommunityAdmin;

  if (!canDelete) {
    return { success: false, error: "No tienes permiso para eliminar esta comunidad. Solo el creador o un administrador principal pueden hacerlo." };
  }

  // Recopilar fileKeys a eliminar de R2
  const fileKeysToDelete: string[] = [];

  try {
    // 1. Obtener avatar y banner de la comunidad
    if (community.avatarUrl) {
      const avatarKey = extractFileKeyFromUrl(community.avatarUrl);
      if (avatarKey) fileKeysToDelete.push(avatarKey);
    }
    if (community.bannerUrl) {
      const bannerKey = extractFileKeyFromUrl(community.bannerUrl);
      if (bannerKey) fileKeysToDelete.push(bannerKey);
    }

    // 2. Obtener todos los posts de esta comunidad (incluyendo los que tengan soft-delete o no)
    const communityPosts = await db.query.posts.findMany({
      columns: { id: true },
      where: eq(posts.communityId, communityId),
    });

    if (communityPosts.length > 0) {
      const postIds = communityPosts.map((p) => p.id);

      // 3. Obtener comentarios de esos posts
      const postComments = await db.query.comments.findMany({
        columns: { id: true },
        where: inArray(comments.postId, postIds),
      });
      const commentIds = postComments.map((c) => c.id);

      // 4. Obtener adjuntos vinculados a posts o comentarios o a la comunidad misma
      const conditions = [
        and(eq(attachments.targetType, "POST"), inArray(attachments.targetId, postIds)),
      ];

      if (commentIds.length > 0) {
        conditions.push(
          and(eq(attachments.targetType, "COMMENT"), inArray(attachments.targetId, commentIds))
        );
      }

      conditions.push(
        and(
          or(eq(attachments.targetType, "COMMUNITY"), eq(attachments.targetType, "COMMUNITY_ASSET")),
          eq(attachments.targetId, communityId)
        )
      );

      const communityAttachments = await db.query.attachments.findMany({
        columns: { fileKey: true },
        where: or(...conditions),
      });

      for (const att of communityAttachments) {
        if (att.fileKey && att.fileKey !== "external" && !att.fileKey.startsWith("http")) {
          fileKeysToDelete.push(att.fileKey);
        }
      }
    }
  } catch (err) {
    console.error("Error al recopilar adjuntos de la comunidad para R2:", err);
  }

  try {
    await poolDb.transaction(async (tx) => {
      // 1. Soft delete la comunidad
      await tx.update(communities)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(communities.id, communityId));

      // 2. Audit log
      await tx.insert(auditLogs).values({
        actorId: user.id,
        action: "COMMUNITY_DELETE",
        targetType: "COMMUNITY",
        targetId: communityId,
        description: `Comunidad eliminada (Soft delete): "${community.displayName}" (${community.slug})`,
        metadata: {
          communityId,
          slug: community.slug,
          displayName: community.displayName
        }
      });
    });

    // 3. Limpieza de R2
    if (fileKeysToDelete.length > 0) {
      const r2Result = await deleteR2Objects(fileKeysToDelete);
      if (r2Result.success) {
        await db.insert(auditLogs).values({
          actorId: user.id,
          action: "COMMUNITY_R2_CLEANUP_SUCCESS",
          targetType: "COMMUNITY",
          targetId: communityId,
          description: `Limpieza de R2 exitosa para la comunidad "${community.displayName}". Se eliminaron ${fileKeysToDelete.length} archivos.`,
          metadata: {
            communityId,
            deletedKeys: fileKeysToDelete
          }
        });
      } else {
        await db.insert(auditLogs).values({
          actorId: user.id,
          action: "COMMUNITY_R2_CLEANUP_FAILED",
          targetType: "COMMUNITY",
          targetId: communityId,
          description: `Falló la limpieza de R2 para la comunidad "${community.displayName}". Error: ${r2Result.error}`,
          metadata: {
            communityId,
            failedKeys: fileKeysToDelete,
            error: r2Result.error
          }
        });
      }
    }

    revalidatePath("/app", "layout");
    revalidatePath("/app/explore");
    revalidatePath(`/app/r/${community.slug}`);

    return { success: true };
  } catch (error) {
    console.error("Error al eliminar la comunidad:", error);
    return { success: false, error: "Error interno al intentar eliminar la comunidad." };
  }
}


