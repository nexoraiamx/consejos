import React from "react";
import { db } from "@/db";
import { profiles, userReputation, userBadges, posts, comments, communities, communityMembers, attachments, follows } from "@/db/schema";
import { eq, and, isNull, sql, desc, inArray, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import { ProfileClient } from "./profile-client";

interface PageProps {
  params: Promise<{ username: string }>;
}

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const decodedUsername = decodeURIComponent(username);

  // 1. Consultar el perfil por username
  const targetProfile = await db.query.profiles.findFirst({
    where: eq(profiles.username, decodedUsername),
  });

  if (!targetProfile) {
    notFound();
  }

  // 2. Consultar reputación del usuario en Neon DB
  const rep = await db.query.userReputation.findFirst({
    where: eq(userReputation.userId, targetProfile.userId),
  });

  const reputation = {
    score: rep?.score || 0,
    level: rep?.level || 1,
  };

  // 3. Consultar estadísticas
  // - Cantidad de publicaciones activas
  const [postsCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .where(
      and(
        eq(posts.authorId, targetProfile.userId),
        eq(posts.status, "ACTIVE"),
        isNull(posts.deletedAt)
      )
    );
  const postsCount = postsCountRes?.count || 0;

  // - Cantidad de comentarios activos
  const [commentsCountRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(comments)
    .where(
      and(
        eq(comments.authorId, targetProfile.userId),
        eq(comments.status, "ACTIVE"),
        isNull(comments.deletedAt)
      )
    );
  const commentsCount = commentsCountRes?.count || 0;

  // - Respuestas aceptadas
  const [acceptedRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(posts)
    .innerJoin(comments, eq(posts.acceptedAnswerId, comments.id))
    .where(
      and(
        eq(comments.authorId, targetProfile.userId),
        isNull(comments.deletedAt),
        isNull(posts.deletedAt)
      )
    );
  const acceptedAnswersCount = acceptedRes?.count || 0;

  // - Comunidades creadas o administradas
  const [managedRes] = await db
    .select({ count: sql<number>`count(distinct ${communities.id})::int` })
    .from(communities)
    .leftJoin(communityMembers, eq(communityMembers.communityId, communities.id))
    .where(
      and(
        isNull(communities.deletedAt),
        or(
          eq(communities.creatorId, targetProfile.userId),
          and(
            eq(communityMembers.userId, targetProfile.userId),
            inArray(communityMembers.role, ["COMMUNITY_ADMIN", "owner", "community_admin"]),
            eq(communityMembers.status, "APPROVED")
          )
        )
      )
    );
  const managedCommunitiesCount = managedRes?.count || 0;

  // 3.5. Obtener estadísticas de follows
  const followersList = await db.query.follows.findMany({
    where: eq(follows.followingId, targetProfile.userId),
  });
  const followingList = await db.query.follows.findMany({
    where: eq(follows.followerId, targetProfile.userId),
  });

  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id || null;
  let isFollowing = false;
  if (currentUserId) {
    const match = await db.query.follows.findFirst({
      where: and(
        eq(follows.followerId, currentUserId),
        eq(follows.followingId, targetProfile.userId)
      ),
    });
    isFollowing = !!match;
  }

  // 4. Obtener insignias otorgadas al usuario
  const dbBadges = await db.query.userBadges.findMany({
    where: eq(userBadges.userId, targetProfile.userId),
    orderBy: desc(userBadges.awardedAt),
  });

  const badges = dbBadges.map((badge) => ({
    id: badge.id,
    badgeCode: badge.badgeCode,
    badgeName: badge.badgeName,
    badgeIcon: badge.badgeIcon,
    awardedAt: badge.awardedAt.toISOString(),
  }));

  // 5. Obtener aportes públicos de este usuario (solo en comunidades PUBLIC para no filtrar accesos privados)
  const dbPosts = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      postType: posts.postType,
      category: posts.category,
      tags: posts.tags,
      status: posts.status,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorName: profiles.displayName,
      authorAvatar: profiles.avatarUrl,
      authorReputation: userReputation.score,
      authorUsername: profiles.username,
      communitySlug: communities.slug,
      communityName: communities.displayName,
      commentsCount: sql<number>`(SELECT count(*)::int FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.deletedAt} IS NULL AND ${comments.status} = 'ACTIVE')`,
    })
    .from(posts)
    .innerJoin(communities, eq(posts.communityId, communities.id))
    .leftJoin(profiles, eq(profiles.userId, posts.authorId))
    .leftJoin(userReputation, eq(userReputation.userId, posts.authorId))
    .where(
      and(
        eq(posts.authorId, targetProfile.userId),
        eq(posts.status, "ACTIVE"),
        isNull(posts.deletedAt),
        eq(communities.privacyType, "PUBLIC")
      )
    )
    .orderBy(desc(posts.createdAt));

  // Obtener adjuntos
  const postIds = dbPosts.map((p) => p.id);
  const postAttachments = postIds.length > 0
    ? await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.targetType, "POST"),
            inArray(attachments.targetId, postIds)
          )
        )
    : [];

  const formattedPosts = dbPosts.map((post) => ({
    ...post,
    createdAt: post.createdAt.toISOString(),
    attachments: postAttachments
      .filter((att) => att.targetId === post.id)
      .map((att) => ({
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileUrl: att.fileUrl,
      })),
  }));

  return (
    <ProfileClient
      profile={{
        userId: targetProfile.userId,
        displayName: targetProfile.displayName,
        username: targetProfile.username,
        avatarUrl: targetProfile.avatarUrl || undefined,
        bio: targetProfile.bio || undefined,
        website: targetProfile.website || undefined,
        twitterUrl: targetProfile.twitterUrl || undefined,
        githubUrl: targetProfile.githubUrl || undefined,
        isExpert: targetProfile.isExpert,
        expertise: targetProfile.expertise,
        interests: targetProfile.interests,
        skillLevel: targetProfile.skillLevel || undefined,
        discoveryGoals: targetProfile.discoveryGoals,
        createdAt: targetProfile.createdAt.toISOString(),
      }}
      reputation={reputation}
      stats={{
        postsCount,
        commentsCount,
        acceptedAnswersCount,
        managedCommunitiesCount,
      }}
      badges={badges}
      postsList={formattedPosts}
      currentUserId={currentUser?.id}
      followersCountInitial={followersList.length}
      followingCountInitial={followingList.length}
      isFollowingInitial={isFollowing}
    />
  );
}
