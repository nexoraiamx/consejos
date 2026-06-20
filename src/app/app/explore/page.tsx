import React, { Suspense } from "react";
import { db } from "@/db";
import { communities, communityMembers, joinRequests, profiles } from "@/db/schema";
import { eq, and, isNull, sql, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import ExploreClient from "./explore-client";
import { CommunityCardSkeleton } from "@/components/shared/skeletons";

// Forzar renderizado dinámico pero permitir streaming
export const dynamic = "force-dynamic";

function ExploreSkeleton() {
  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6 text-left">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 bg-neutral-900 animate-pulse rounded-md" />
        <div className="h-4 w-72 bg-neutral-900 animate-pulse rounded-md" />
      </div>
      
      {/* Buscador de mentira (Skeleton) */}
      <div className="h-11 w-full bg-neutral-900 animate-pulse rounded-2xl border border-neutral-800" />
      
      {/* Grid de comunidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <CommunityCardSkeleton />
        <CommunityCardSkeleton />
        <CommunityCardSkeleton />
        <CommunityCardSkeleton />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<ExploreSkeleton />}>
      <ExploreContent />
    </Suspense>
  );
}

async function ExploreContent() {
  const user = await getCurrentUser();
  let dbCommunities: {
    id: string;
    slug: string;
    displayName: string;
    description: string | null;
    privacyType: string;
    createdAt: Date;
    avatarUrl: string | null;
    bannerUrl: string | null;
    logoUrl: string | null;
    category: string | null;
  }[] = [];

  let showPreferencesCTA = false;
  let interests: string[] = [];

  if (user) {
    try {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, user.id),
      });
      if (profile) {
        interests = profile.interests || [];
        if (interests.length === 0) {
          showPreferencesCTA = true;
        }
      }
    } catch (err) {
      console.error("Error al consultar perfil del usuario para intereses:", err);
    }
  }

  try {
    dbCommunities = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        displayName: communities.displayName,
        description: communities.description,
        privacyType: communities.privacyType,
        createdAt: communities.createdAt,
        avatarUrl: communities.avatarUrl,
        bannerUrl: communities.bannerUrl,
        logoUrl: communities.logoUrl,
        category: communities.category,
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
              or(
                eq(communityMembers.status, "APPROVED"),
                eq(communityMembers.status, "approved")
              )
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
            const statusUpper = membership.status.toUpperCase();
            isJoined = statusUpper === "APPROVED";
            membershipStatus = statusUpper as "APPROVED" | "PENDING" | "BANNED";
          } else {
            const joinRequest = await db.query.joinRequests.findFirst({
              where: and(
                eq(joinRequests.communityId, comm.id),
                eq(joinRequests.userId, user.id)
              ),
            });
            if (joinRequest) {
              membershipStatus = "PENDING";
            }
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
        avatarUrl: comm.avatarUrl || null,
        bannerUrl: comm.bannerUrl || null,
        logoUrl: comm.logoUrl || null,
        category: comm.category || null,
        membersCount,
        isJoined,
        membershipStatus,
      };
    })
  );

  // Ordenar comunidades por coincidencia con intereses del usuario
  let sortedCommunities = [...communitiesWithMeta];
  if (interests.length > 0) {
    sortedCommunities.sort((a, b) => {
      const getMatchScore = (comm: typeof a) => {
        let score = 0;
        const searchArea = `${comm.displayName} ${comm.slug} ${comm.description || ""}`.toLowerCase();

        interests.forEach(interest => {
          const lowerInterest = interest.toLowerCase();
          if (searchArea.includes(lowerInterest)) {
            score += 10; // Coincidencia exacta
          }
          // Coincidencias de palabras individuales
          const words = lowerInterest.split(" ");
          if (words.length > 1) {
            words.forEach(word => {
              if (word.length > 3 && searchArea.includes(word)) {
                score += 3;
              }
            });
          }
        });
        return score;
      };

      return getMatchScore(b) - getMatchScore(a);
    });
  }

  return <ExploreClient initialCommunities={sortedCommunities} showPreferencesCTA={showPreferencesCTA} />;
}
