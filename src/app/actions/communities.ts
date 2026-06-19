"use server";

import { db, poolDb } from "@/db";
import { communities, communityMembers, auditLogs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { createNotificationTx } from "@/lib/notifications";

interface CreateCommunityInput {
  displayName: string;
  slug: string;
  description: string;
  privacyType: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
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
      }).returning();

      // 2. Unir al creador como COMMUNITY_ADMIN y APPROVED
      await tx.insert(communityMembers).values({
        communityId: newCommunity.id,
        userId: user.id,
        role: "COMMUNITY_ADMIN",
        status: "APPROVED",
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

    revalidatePath("/app/explore");
    return { success: true, slug: result.slug };
  } catch (error: any) {
    console.error("Error al crear comunidad:", error);
    return { success: false, error: "Error interno al procesar tu solicitud." };
  }
}

/**
 * Server Action para unirse o salirse (leave) de una comunidad.
 */
export async function toggleJoinCommunityAction(communityId: string) {
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
      // Si ya es miembro, se sale
      if (existingMember.role === "COMMUNITY_ADMIN") {
        return {
          success: false,
          error: "Como administrador principal, no puedes abandonar la comunidad."
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
    } else {
      // Si no es miembro, se une
      const status = community.privacyType === "PUBLIC" ? "APPROVED" : "PENDING";

      await poolDb.transaction(async (tx) => {
        await tx.insert(communityMembers).values({
          communityId,
          userId: user.id,
          role: "MEMBER",
          status,
        });

        await tx.insert(auditLogs).values({
          actorId: user.id,
          action: status === "APPROVED" ? "COMMUNITY_JOIN" : "COMMUNITY_JOIN_REQUEST",
          targetType: "COMMUNITY",
          targetId: communityId,
          description: status === "APPROVED" 
            ? `El usuario se unió a la comunidad: ${community.displayName}`
            : `El usuario solicitó unirse a la comunidad privada: ${community.displayName}`,
        });

        if (status === "APPROVED") {
          await createNotificationTx(tx, {
            recipientId: user.id,
            senderId: null,
            type: "INVITATION",
            targetType: "COMMUNITY",
            targetId: communityId,
          });
        }
      });

      revalidatePath("/app/explore");
      revalidatePath(`/app/r/${community.slug}`);
      revalidatePath("/app");
      return { success: true, joined: status === "APPROVED", status };
    }
  } catch (error: any) {
    console.error("Error al unirse/abandonar la comunidad:", error);
    return { success: false, error: "Error interno al procesar el cambio de membresía." };
  }
}
