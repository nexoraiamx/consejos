import { db } from "@/db";
import { communities, communityMembers } from "@/db/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import LandingClient from "./landing-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const currentUser = await getCurrentUser();
  const isSignedIn = !!currentUser;

  let featuredCommunities: {
    id: string;
    slug: string;
    displayName: string;
    description: string | null;
    privacyType: string;
    avatarUrl: string | null;
    category: string | null;
    membersCount: number;
  }[] = [];

  try {
    featuredCommunities = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        displayName: communities.displayName,
        description: communities.description,
        privacyType: communities.privacyType,
        avatarUrl: communities.avatarUrl,
        category: communities.category,
        membersCount: sql<number>`(SELECT count(*)::int FROM ${communityMembers} WHERE ${communityMembers.communityId} = ${communities.id} AND (${communityMembers.status} = 'APPROVED' OR ${communityMembers.status} = 'approved'))`,
      })
      .from(communities)
      .where(
        and(
          eq(communities.privacyType, "PUBLIC"),
          isNull(communities.deletedAt)
        )
      )
      .orderBy(desc(communities.createdAt))
      .limit(3);
  } catch (error) {
    console.error("Error al consultar comunidades para la landing page:", error);
  }

  return (
    <LandingClient 
      isSignedIn={isSignedIn} 
      featuredCommunities={featuredCommunities} 
    />
  );
}
