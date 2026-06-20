"use server";

import { db, poolDb } from "@/db";
import { communities, communityMembers, auditLogs, invitations, joinRequests } from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { requireAuth, getUserCommunityRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { createNotificationTx } from "@/lib/notifications";

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

      // 2. Unir al creador como owner y approved
      await tx.insert(communityMembers).values({
        communityId: newCommunity.id,
        userId: user.id,
        role: "owner",
        status: "approved",
      });

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

      // Si ya es miembro, se sale
      if (existingMember.role === "owner" || existingMember.role === "COMMUNITY_ADMIN") {
        return {
          success: false,
          error: "Como propietario o administrador principal, no puedes abandonar la comunidad."
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

  // Validate permission: must be owner or COMMUNITY_ADMIN
  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && (roleInfo.role === "owner" || roleInfo.role === "COMMUNITY_ADMIN") && roleInfo.status.toUpperCase() === "APPROVED");

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

  // Validate permission
  const roleInfo = await getUserCommunityRole(user.id, invite.communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && (roleInfo.role === "owner" || roleInfo.role === "COMMUNITY_ADMIN") && roleInfo.status.toUpperCase() === "APPROVED");

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
  const canManage = isGlobalAdmin || (roleInfo && (roleInfo.role === "owner" || roleInfo.role === "COMMUNITY_ADMIN") && roleInfo.status.toUpperCase() === "APPROVED");

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

  // Validate permission: only the owner (or global admin) can change roles!
  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const isOwner = isGlobalAdmin || (roleInfo && roleInfo.role === "owner" && roleInfo.status.toUpperCase() === "APPROVED");

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

  if (targetMember.role === "owner") {
    return { success: false, error: "No puedes cambiar el rol del propietario de la comunidad." };
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

  // Validate permission: owner, COMMUNITY_ADMIN (or global admin)
  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && (roleInfo.role === "owner" || roleInfo.role === "COMMUNITY_ADMIN") && roleInfo.status.toUpperCase() === "APPROVED");

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

  // Safety checks
  if (targetMember.role === "owner") {
    return { success: false, error: "No se puede expulsar al propietario de la comunidad." };
  }

  // COMMUNITY_ADMIN cannot expel other administrators unless they are the owner
  const isUserOwner = isGlobalAdmin || (roleInfo && roleInfo.role === "owner");
  if (targetMember.role === "COMMUNITY_ADMIN" && !isUserOwner) {
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
  category?: string | null
) {
  const user = await requireAuth();

  // Validate permission: must be owner or COMMUNITY_ADMIN
  const roleInfo = await getUserCommunityRole(user.id, communityId);
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  const canManage = isGlobalAdmin || (roleInfo && (roleInfo.role === "owner" || roleInfo.role === "COMMUNITY_ADMIN") && roleInfo.status.toUpperCase() === "APPROVED");

  if (!canManage) {
    return { success: false, error: "No tienes permiso para actualizar los ajustes de esta comunidad." };
  }

  try {
    await db.update(communities)
      .set({
        displayName: displayName.trim(),
        description: description.trim() || null,
        privacyType,
        avatarUrl: avatarUrl || null,
        bannerUrl: bannerUrl || null,
        category: category || null,
        updatedAt: new Date()
      })
      .where(eq(communities.id, communityId));

    const comm = await db.query.communities.findFirst({ where: eq(communities.id, communityId) });
    if (comm) {
      revalidatePath(`/app/r/${comm.slug}`);
      revalidatePath(`/app/r/${comm.slug}/admin`);
    }
    return { success: true };
  } catch (error) {
    console.error("Error al actualizar comunidad:", error);
    return { success: false, error: "Error al guardar los cambios." };
  }
}

