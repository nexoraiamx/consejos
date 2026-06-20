import { auth, currentUser as getClerkUser } from "@clerk/nextjs/server";
import { db, poolDb } from "@/db";
import { users, profiles, userReputation, communityMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";

/**
 * Obtiene el usuario actual registrado en Neon DB a partir de la sesión de Clerk.
 * Cuenta con un mecanismo de auto-aprovisionamiento seguro por si el webhook de Clerk falla.
 */
export async function getCurrentUser() {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    let user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      console.log(`[Auto-Aprovisionamiento] Usuario ${userId} no existe en Neon DB. Sincronizando...`);
      const clerkUser = await getClerkUser();
      if (clerkUser) {
        const primaryEmailObj = clerkUser.emailAddresses.find(
          (email) => email.id === clerkUser.primaryEmailAddressId
        ) || clerkUser.emailAddresses[0];
        
        const email = primaryEmailObj ? primaryEmailObj.emailAddress : "";
        if (email) {
          // Generar username único
          let baseUsername = clerkUser.username || email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!baseUsername || baseUsername.length < 2) {
            baseUsername = "user";
          }
          let username = baseUsername;
          let isUnique = false;
          let counter = 0;
          while (!isUnique) {
            const existing = await db
              .select({ username: profiles.username })
              .from(profiles)
              .where(eq(profiles.username, username))
              .limit(1);
            if (existing.length === 0) {
              isUnique = true;
            } else {
              counter++;
              username = `${baseUsername}${counter}`;
            }
          }

          let displayName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
          if (!displayName) {
            displayName = email.split("@")[0];
          }

          // Insertar registro completo transaccionalmente usando poolDb (WebSocket Pool) para soportar transacciones
          await poolDb.transaction(async (tx) => {
            await tx.insert(users).values({
              id: userId,
              email,
              globalRole: "MEMBER",
              isSuspended: false,
            });
            await tx.insert(profiles).values({
              userId,
              displayName,
              username,
              avatarUrl: clerkUser.imageUrl,
            });
            await tx.insert(userReputation).values({
              userId,
              score: 0,
              level: 1,
            });
          });

          // Volver a consultar
          user = await db.query.users.findFirst({
            where: eq(users.id, userId),
          });
          console.log(`[Auto-Aprovisionamiento] Registro creado para ${userId}`);
        }
      }
    }

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
      role: member.role as "owner" | "COMMUNITY_ADMIN" | "MODERATOR" | "MEMBER",
      status: member.status as "approved" | "APPROVED" | "PENDING" | "BANNED",
    };
  } catch (error) {
    console.error("Error al obtener rol del usuario en la comunidad:", error);
    return null;
  }
}

/**
 * Valida si un usuario tiene permisos de administración sobre una comunidad.
 * Retorna true si es owner o COMMUNITY_ADMIN aprobado o si tiene el rol GLOBAL_ADMIN.
 */
export async function canManageCommunity(userId: string, communityId: string) {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (user?.globalRole === "GLOBAL_ADMIN") return true;

    const roleInfo = await getUserCommunityRole(userId, communityId);
    if (!roleInfo) return false;

    const role = roleInfo.role.toLowerCase();
    const status = roleInfo.status.toUpperCase();
    return (role === "owner" || role === "community_admin") && status === "APPROVED";
  } catch (error) {
    console.error("Error en validación de gestión de comunidad:", error);
    return false;
  }
}
