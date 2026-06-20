import React, { Suspense } from "react";
import { db } from "@/db";
import { posts, communities, communityMembers, profiles, userReputation, attachments, comments, joinRequests, users, follows } from "@/db/schema";
import { eq, and, isNull, sql, desc, inArray, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { PostCard } from "@/components/shared/post-card";
import { CommunityCard } from "@/components/shared/community-card";
import { Sparkles, TrendingUp, Award, Plus, Inbox } from "lucide-react";
import Link from "next/link";
import { FeedSkeleton, CommunityCardSkeleton, Skeleton } from "@/components/shared/skeletons";

export const dynamic = "force-dynamic";

const timeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "año" : "años"}`;
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "mes" : "meses"}`;
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "día" : "días"}`;
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "hora" : "horas"}`;
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "minuto" : "minutos"}`;
  return "Hace unos segundos";
};

export default async function AppDashboard() {
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id || "";

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA PRINCIPAL: Feed de Publicaciones */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
              Tu Feed
            </h1>
            
            <Link
              href="/app/explore"
              className="inline-flex items-center gap-1.5 rounded-full bg-white text-neutral-950 px-4 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md shadow-white/5"
            >
              <Plus className="h-4 w-4" />
              <span>Publicar</span>
            </Link>
          </div>

          <Suspense fallback={<FeedSkeleton />}>
            <FeedSection currentUserId={currentUserId} />
          </Suspense>
        </div>

        {/* COLUMNA LATERAL (Desktop only) */}
        <div className="hidden lg:flex flex-col gap-8">
          
          {/* Tarjeta de Reputación */}
          <Suspense fallback={<Skeleton className="h-44 w-full rounded-3xl bg-neutral-950/40 border border-neutral-900" />}>
            <ReputationSection currentUserId={currentUserId} />
          </Suspense>

          {/* Comunidades Recomendadas */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-neutral-400" />
              <h3 className="text-sm font-semibold text-neutral-200">Comunidades Destacadas</h3>
            </div>

            <Suspense fallback={
              <div className="space-y-4">
                <CommunityCardSkeleton />
                <CommunityCardSkeleton />
                <CommunityCardSkeleton />
              </div>
            }>
              <RecommendedCommunitiesSection currentUserId={currentUserId} />
            </Suspense>
          </div>

          {/* Reglas de la comunidad / Tip del día */}
          <div className="p-6 rounded-3xl border border-neutral-900/40 bg-neutral-950/20 text-left flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Consejo de moderación
            </h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed font-light">
              Respeta las directrices del sistema de reputación. Marcar la respuesta aceptada en tus dudas ayuda a los expertos a ganar visibilidad y puntos.
            </p>
          </div>
          
        </div>

      </div>
    </div>
  );
}

// 1. Componente Asíncrono para el Feed de Publicaciones
async function FeedSection({ currentUserId }: { currentUserId: string }) {
  let dbPosts: any[] = [];

  try {
    let isUserAdmin = false;
    let followedUserIds = new Set<string>();
    let userInterests: string[] = [];

    if (currentUserId) {
      const userObj = await db.query.users.findFirst({
        where: eq(users.id, currentUserId)
      });
      if (userObj?.globalRole === "GLOBAL_ADMIN") {
        isUserAdmin = true;
      }

      // Obtener seguidos e intereses
      const userFollows = await db.query.follows.findMany({
        where: eq(follows.followerId, currentUserId),
      });
      followedUserIds = new Set(userFollows.map((f) => f.followingId));

      const userProfile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, currentUserId),
      });
      userInterests = userProfile?.interests || [];
    }

    const whereClause = isUserAdmin
      ? and(
          isNull(posts.deletedAt),
          isNull(communities.deletedAt),
          or(
            eq(posts.status, "ACTIVE"),
            eq(posts.status, "HIDDEN")
          )
        )
      : and(
          isNull(posts.deletedAt),
          isNull(communities.deletedAt),
          or(
            // Public active posts
            and(
              eq(posts.status, "ACTIVE"),
              eq(communities.privacyType, "PUBLIC")
            ),
            // Private or invite-only active posts where user is approved member or community creator
            and(
              eq(posts.status, "ACTIVE"),
              or(
                eq(communities.privacyType, "PRIVATE"),
                eq(communities.privacyType, "INVITE_ONLY")
              ),
              or(
                eq(communityMembers.status, "APPROVED"),
                eq(communityMembers.status, "approved"),
                eq(communities.creatorId, currentUserId)
              )
            ),
            // Hidden posts where user is owner, community admin, moderator, or community creator
            currentUserId
              ? and(
                  eq(posts.status, "HIDDEN"),
                  or(
                    and(
                      or(
                        eq(communityMembers.role, "owner"),
                        eq(communityMembers.role, "COMMUNITY_ADMIN"),
                        eq(communityMembers.role, "community_admin"),
                        eq(communityMembers.role, "MODERATOR"),
                        eq(communityMembers.role, "moderator")
                      ),
                      or(
                        eq(communityMembers.status, "APPROVED"),
                        eq(communityMembers.status, "approved")
                      )
                    ),
                    eq(communities.creatorId, currentUserId)
                  )
                )
              : sql`false`
          )
        );

    const rawPosts = await db
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
        memberStatus: communityMembers.status,
        communityPrivacy: communities.privacyType,
        communityCategory: communities.category,
        commentsCount: sql<number>`(SELECT count(*)::int FROM ${comments} WHERE ${comments.postId} = ${posts.id} AND ${comments.deletedAt} IS NULL AND ${comments.status} = 'ACTIVE')`,
      })
      .from(posts)
      .innerJoin(communities, eq(posts.communityId, communities.id))
      .leftJoin(profiles, eq(profiles.userId, posts.authorId))
      .leftJoin(userReputation, eq(userReputation.userId, posts.authorId))
      .leftJoin(
        communityMembers,
        and(
          eq(communityMembers.communityId, posts.communityId),
          eq(communityMembers.userId, currentUserId)
        )
      )
      .where(whereClause)
      .orderBy(desc(posts.createdAt))
      .limit(100);

    // Priorizar en memoria
    if (currentUserId && rawPosts.length > 0) {
      const getPostScore = (post: any) => {
        let score = 0;
        
        // 1. Miembro aprobado de la comunidad
        const isApprovedMember = post.memberStatus?.toUpperCase() === "APPROVED";
        if (isApprovedMember) {
          score += 1000;
        }
        
        // 2. Autor seguido por el usuario actual
        const isAuthorFollowed = followedUserIds.has(post.authorId);
        if (isAuthorFollowed) {
          score += 500;
        }
        
        // 3. Coincidencia de intereses (solo para comunidades públicas)
        const isPublic = post.communityPrivacy === "PUBLIC";
        if (isPublic && userInterests.length > 0) {
          const categoryMatch = post.communityCategory && userInterests.some(
            (interest) => interest.toLowerCase() === post.communityCategory.toLowerCase()
          );
          const tagsMatch = post.tags && post.tags.some(
            (tag: string) => userInterests.some((interest) => interest.toLowerCase() === tag.toLowerCase())
          );
          if (categoryMatch || tagsMatch) {
            score += 200;
          }
        }
        
        // 4. Peso de recencia (frescura del post en las últimas horas)
        const ageInHours = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60 * 60);
        const recencyScore = Math.max(0, 100 - ageInHours);
        score += recencyScore;
        
        return score;
      };

      rawPosts.sort((a, b) => getPostScore(b) - getPostScore(a));
    }

    dbPosts = rawPosts.slice(0, 20);
  } catch (error) {
    console.error("Error al consultar posts para el Dashboard:", error);
  }

  // 2. Obtener adjuntos para los posts
  const postIds = dbPosts.map((p) => p.id);
  let feedAttachments: (typeof attachments.$inferSelect)[] = [];
  if (postIds.length > 0) {
    try {
      feedAttachments = await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.targetType, "POST"),
            inArray(attachments.targetId, postIds)
          )
        );
    } catch (error) {
      console.error("Error al consultar adjuntos para el feed:", error);
    }
  }

  if (dbPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 px-6">
        <Inbox className="h-10 w-10 text-neutral-700 mb-4" />
        <h3 className="text-sm font-semibold text-neutral-300">Aún no hay publicaciones</h3>
        <p className="text-xs text-neutral-500 max-w-sm mt-1 font-light leading-relaxed">
          Únete a comunidades de tu interés y publica tus dudas o recursos para verlos en tu feed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dbPosts.map((post) => {
        const postAttachments = feedAttachments.filter(
          (att) => att.targetId === post.id
        );
        return (
          <PostCard
            key={post.id}
            id={post.id}
            title={post.title}
            content={post.content}
            communitySlug={post.communitySlug}
            communityName={post.communityName}
            authorId={post.authorId}
            authorName={post.authorName || "Usuario"}
            authorAvatar={post.authorAvatar || undefined}
            authorReputation={post.authorReputation || 0}
            authorUsername={post.authorUsername || undefined}
            category={post.category || undefined}
            tags={post.tags}
            createdAt={timeAgo(post.createdAt)}
            upvotesCount={0}
            commentsCount={post.commentsCount || 0}
            postType={post.postType as "QUESTION" | "RESOURCE" | "DISCUSSION" | "CASE_STUDY"}
            status={post.status as "ACTIVE" | "HIDDEN" | "DELETED"}
            currentUserId={currentUserId}
            attachments={postAttachments}
          />
        );
      })}
    </div>
  );
}

// 2. Componente Asíncrono para la sección de Reputación
async function ReputationSection({ currentUserId }: { currentUserId: string }) {
  let userRep = { score: 0, level: 1 };
  
  if (currentUserId) {
    try {
      const rep = await db.query.userReputation.findFirst({
        where: eq(userReputation.userId, currentUserId),
      });
      if (rep) {
        userRep = { score: rep.score || 0, level: rep.level || 1 };
      }
    } catch (error) {
      console.error("Error al obtener reputación para Dashboard:", error);
    }
  }

  const nextLevelScore = userRep.level * 150;
  const prevLevelScore = (userRep.level - 1) * 150;
  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      userRep.score > 0
        ? ((userRep.score - prevLevelScore) / (nextLevelScore - prevLevelScore)) * 100
        : 0
    )
  );

  return (
    <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4 text-left">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white">
          <Award className="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">Tu Reputación</h3>
          <span className="text-[10px] text-neutral-500">Nivel {userRep.level} de Experto</span>
        </div>
      </div>

      <div className="flex items-end gap-2 mt-1">
        <span className="text-2xl font-semibold tracking-tight text-white">{userRep.score}</span>
        <span className="text-[11px] text-neutral-500 mb-1">puntos totales</span>
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all duration-500" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-neutral-500">
          <span>{prevLevelScore} pts (Lvl {userRep.level})</span>
          <span>{nextLevelScore} pts (Lvl {userRep.level + 1})</span>
        </div>
      </div>
    </div>
  );
}

// 3. Componente Asíncrono para las Comunidades Recomendadas
async function RecommendedCommunitiesSection({ currentUserId }: { currentUserId: string }) {
  let dbCommunities: {
    id: string;
    slug: string;
    displayName: string;
    description: string | null;
    privacyType: string;
    avatarUrl: string | null;
    category: string | null;
  }[] = [];

  try {
    dbCommunities = await db
      .select({
        id: communities.id,
        slug: communities.slug,
        displayName: communities.displayName,
        description: communities.description,
        privacyType: communities.privacyType,
        avatarUrl: communities.avatarUrl,
        category: communities.category,
      })
      .from(communities)
      .where(isNull(communities.deletedAt))
      .limit(5);
  } catch (error) {
    console.error("Error al consultar comunidades destacadas:", error);
  }

  const communitiesWithMeta = await Promise.all(
    dbCommunities.map(async (comm) => {
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
        console.error(`Error al contar miembros en Dashboard para ${comm.id}:`, err);
      }

      let isJoined = false;
      let membershipStatus: "APPROVED" | "PENDING" | "BANNED" | null = null;
      if (currentUserId) {
        try {
          const membership = await db.query.communityMembers.findFirst({
            where: and(
              eq(communityMembers.communityId, comm.id),
              eq(communityMembers.userId, currentUserId)
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
                eq(joinRequests.userId, currentUserId)
              ),
            });
            if (joinRequest) {
              membershipStatus = "PENDING";
            }
          }
        } catch (err) {
          console.error(`Error al consultar membresía para ${comm.id}:`, err);
        }
      }

      return {
        id: comm.id,
        slug: comm.slug || "",
        displayName: comm.displayName || "Comunidad sin nombre",
        description: comm.description || "",
        privacyType: (comm.privacyType || "PUBLIC") as "PUBLIC" | "PRIVATE" | "INVITE_ONLY",
        avatarUrl: comm.avatarUrl || null,
        category: comm.category || null,
        membersCount,
        isJoined,
        membershipStatus,
      };
    })
  );

  return (
    <div className="space-y-4">
      {communitiesWithMeta.map((community) => (
        <CommunityCard key={community.id} {...community} />
      ))}
    </div>
  );
}
