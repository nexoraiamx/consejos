import React from "react";
import { db } from "@/db";
import { profiles, userReputation, reputationEvents } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { ExpertsClient } from "./experts-client";

export const dynamic = "force-dynamic";

export default async function ExpertsPage() {
  // 1. Ranking Global (Histórico)
  const globalRanking = await db
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

  // 2. Ranking Semanal (Últimos 7 días)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyRanking = await db
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

  // 3. Ranking Mensual (Últimos 30 días)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const monthlyRanking = await db
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

  return (
    <ExpertsClient
      globalRanking={globalRanking}
      weeklyRanking={weeklyRanking}
      monthlyRanking={monthlyRanking}
    />
  );
}
