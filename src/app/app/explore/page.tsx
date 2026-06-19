import { db } from "@/db";
import { communities, communityMembers } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import ExploreClient from "./explore-client";

// Forzar renderizado dinámico para leer siempre los datos más recientes de la base de datos
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const user = await getCurrentUser();

  // 1. Consultar todas las comunidades activas (no eliminadas)
  const dbCommunities = await db
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

  // 2. Construir la metadata de membresías y cantidad de miembros de forma paralela
  const communitiesWithMeta = await Promise.all(
    dbCommunities.map(async (comm) => {
      // Contador de miembros con estatus APPROVED
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, comm.id),
            eq(communityMembers.status, "APPROVED")
          )
        );

      let isJoined = false;
      let membershipStatus: "APPROVED" | "PENDING" | "BANNED" | null = null;

      // Si hay un usuario logueado, consultar si tiene membresía en esta comunidad
      if (user) {
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
      }

      return {
        id: comm.id,
        slug: comm.slug,
        displayName: comm.displayName,
        description: comm.description || "",
        privacyType: comm.privacyType as "PUBLIC" | "PRIVATE" | "INVITE_ONLY",
        membersCount: countResult?.count || 0,
        isJoined,
        membershipStatus,
      };
    })
  );

  return <ExploreClient initialCommunities={communitiesWithMeta} />;
}
