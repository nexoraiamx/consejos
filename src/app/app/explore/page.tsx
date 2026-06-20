import { db } from "@/db";
import { communities, communityMembers } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import ExploreClient from "./explore-client";

// Forzar renderizado dinámico para leer siempre los datos más recientes de la base de datos
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const user = await getCurrentUser();
  let dbCommunities: any[] = [];

  try {
    dbCommunities = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        displayName: communities.displayName,
        description: communities.description,
        privacyType: communities.privacyType,
        createdAt: communities.createdAt,
      })
      .from(communities)
      .where(isNull(communities.deletedAt))
      .orderBy(communities.createdAt);
  } catch (error) {
    console.error("Error al consultar comunidades en Neon:", error);
  }

  // 2. Construir la metadata de membresías y cantidad de miembros de forma paralela
  const communitiesWithMeta = await Promise.all(
    (dbCommunities || []).map(async (comm) => {
      let membersCount = 0;
      try {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(communityMembers)
          .where(
            and(
              eq(communityMembers.communityId, comm.id),
              eq(communityMembers.status, "APPROVED")
            )
          );
        membersCount = countResult?.count || 0;
      } catch (err) {
        console.error(`Error al contar miembros de la comunidad ${comm.id}:`, err);
      }

      let isJoined = false;
      let membershipStatus: "APPROVED" | "PENDING" | "BANNED" | null = null;

      // Si hay un usuario logueado, consultar si tiene membresía en esta comunidad
      if (user) {
        try {
          const membership = await db.query.communityMembers.findFirst({
            where: and(
              eq(communityMembers.communityId, comm.id),
              eq(communityMembers.userId, user.id)
            ),
          });

          if (membership) {
            isJoined = membership.status === "APPROVED";
            membershipStatus = membership.status as "APPROVED" | "PENDING" | "BANNED";
          }
        } catch (err) {
          console.error(`Error al consultar membresía para el usuario ${user.id} en la comunidad ${comm.id}:`, err);
        }
      }

      return {
        id: comm.id,
        slug: comm.slug || "",
        displayName: comm.displayName || "Comunidad sin nombre",
        description: comm.description || "",
        privacyType: (comm.privacyType || "PUBLIC") as "PUBLIC" | "PRIVATE" | "INVITE_ONLY",
        membersCount,
        isJoined,
        membershipStatus,
      };
    })
  );

  return <ExploreClient initialCommunities={communitiesWithMeta} />;
}
