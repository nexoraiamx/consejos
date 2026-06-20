import React from "react";
import { db } from "@/db";
import { profiles, userReputation, reputationEvents, follows } from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { ExpertsClient } from "./experts-client";
import { getCurrentUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function ExpertsPage() {
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id || null;

  // Obtener follows del usuario actual
  const userFollows = currentUserId
    ? await db.query.follows.findMany({
        where: eq(follows.followerId, currentUserId)
      })
    : [];
  const followedUserIds = new Set(userFollows.map((f) => f.followingId));

  // Helper para añadir estado de follow
  const injectFollowStatus = (list: any[]) => {
    return list.map((item) => ({
      ...item,
      isFollowing: followedUserIds.has(item.userId),
    }));
  };

  // 1. Ranking Global (Histórico)
  const globalRankingRaw = await db
    .select({
      userId: profiles.userId,
      displayName: profiles.displayName,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      score: userReputation.score,
      level: userReputation.level,
      interests: profiles.interests,
      isExpert: profiles.isExpert,
    })
    .from(profiles)
    .innerJoin(userReputation, eq(profiles.userId, userReputation.userId))
    .where(sql`${userReputation.score} > 0`)
    .orderBy(desc(userReputation.score))
    .limit(50);

  const globalRanking = injectFollowStatus(globalRankingRaw);

  // 2. Ranking Semanal (Últimos 7 días)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyRankingRaw = await db
    .select({
      userId: profiles.userId,
      displayName: profiles.displayName,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      score: sql<number>`coalesce(sum(${reputationEvents.points}), 0)::int`,
      interests: profiles.interests,
      isExpert: profiles.isExpert,
      level: userReputation.level,
    })
    .from(profiles)
    .innerJoin(reputationEvents, eq(profiles.userId, reputationEvents.userId))
    .leftJoin(userReputation, eq(profiles.userId, userReputation.userId))
    .where(sql`${reputationEvents.createdAt} >= ${sevenDaysAgo}`)
    .groupBy(
      profiles.userId, 
      profiles.displayName, 
      profiles.username, 
      profiles.avatarUrl, 
      profiles.bio, 
      profiles.interests, 
      profiles.isExpert, 
      userReputation.level
    )
    .orderBy(desc(sql`coalesce(sum(${reputationEvents.points}), 0)::int`))
    .limit(50);

  const weeklyRanking = injectFollowStatus(weeklyRankingRaw);

  // 3. Ranking Mensual (Últimos 30 días)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monthlyRankingRaw = await db
    .select({
      userId: profiles.userId,
      displayName: profiles.displayName,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      score: sql<number>`coalesce(sum(${reputationEvents.points}), 0)::int`,
      interests: profiles.interests,
      isExpert: profiles.isExpert,
      level: userReputation.level,
    })
    .from(profiles)
    .innerJoin(reputationEvents, eq(profiles.userId, reputationEvents.userId))
    .leftJoin(userReputation, eq(profiles.userId, userReputation.userId))
    .where(sql`${reputationEvents.createdAt} >= ${thirtyDaysAgo}`)
    .groupBy(
      profiles.userId, 
      profiles.displayName, 
      profiles.username, 
      profiles.avatarUrl, 
      profiles.bio, 
      profiles.interests, 
      profiles.isExpert, 
      userReputation.level
    )
    .orderBy(desc(sql`coalesce(sum(${reputationEvents.points}), 0)::int`))
    .limit(50);

  const monthlyRanking = injectFollowStatus(monthlyRankingRaw);

  return (
    <ExpertsClient
      globalRanking={globalRanking}
      weeklyRanking={weeklyRanking}
      monthlyRanking={monthlyRanking}
      currentUserId={currentUserId}
    />
  );
}
