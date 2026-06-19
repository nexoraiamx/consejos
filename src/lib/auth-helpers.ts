import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, communityMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";

/**
 * Obtiene el usuario actual registrado en Neon DB a partir de la sesión de Clerk.
 */
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    return user || null;
  } catch (error) {
    console.error("Error al obtener el usuario actual desde Neon:", error);
    return null;
  }
}

/**
 * Fuerza a que el usuario esté autenticado. Redirige a /sign-in si no hay sesión,
 * o arroja un error si la cuenta está suspendida.
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }
  if (user.isSuspended) {
    throw new Error("Acceso denegado: Esta cuenta se encuentra suspendida.");
  }
  return user;
}

/**
 * Retorna el rol y estado de un usuario dentro de una comunidad específica.
 */
export async function getUserCommunityRole(userId: string, communityId: string) {
  try {
    const member = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, communityId),
        eq(communityMembers.userId, userId)
      ),
    });
    if (!member) return null;
    return {
      role: member.role as "COMMUNITY_ADMIN" | "MODERATOR" | "MEMBER",
      status: member.status as "PENDING" | "APPROVED" | "BANNED",
    };
  } catch (error) {
    console.error("Error al obtener rol del usuario en la comunidad:", error);
    return null;
  }
}

/**
 * Valida si un usuario tiene permisos de administración sobre una comunidad.
 * Retorna true si es COMMUNITY_ADMIN aprobado o si tiene el rol GLOBAL_ADMIN.
 */
export async function canManageCommunity(userId: string, communityId: string) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (user?.globalRole === "GLOBAL_ADMIN") return true;

    const roleInfo = await getUserCommunityRole(userId, communityId);
    return roleInfo?.role === "COMMUNITY_ADMIN" && roleInfo?.status === "APPROVED";
  } catch (error) {
    console.error("Error en validación de gestión de comunidad:", error);
    return false;
  }
}
