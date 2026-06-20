import React from "react";
import { db } from "@/db";
import { posts, communities, communityMembers, profiles, userReputation, attachments, comments, joinRequests } from "@/db/schema";
import { eq, and, isNull, sql, desc, inArray, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { PostCard } from "@/components/shared/post-card";
import { CommunityCard } from "@/components/shared/community-card";
import { Sparkles, TrendingUp, Award, Plus, Inbox } from "lucide-react";
import Link from "next/link";

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

  // 1. Consultar posts reales de Neon con leftJoins robustos y filtrado por privacidad
  let dbPosts: {
    id: string;
    title: string;
    content: string;
    postType: string;
    category: string | null;
    tags: string[];
    status: string;
    createdAt: Date;
    authorId: string;
    authorName: string | null;
    authorAvatar: string | null;
    authorReputation: number | null;
    communitySlug: string;
    communityName: string;
    commentsCount: number;
  }[] = [];
  try {
    const currentUserId = currentUser?.id || "";
    const isGlobalAdmin = currentUser?.globalRole === "GLOBAL_ADMIN";

    const whereClause = isGlobalAdmin
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
            // Private or invite-only active posts where user is approved member
            and(
              eq(posts.status, "ACTIVE"),
              or(
                eq(communities.privacyType, "PRIVATE"),
                eq(communities.privacyType, "INVITE_ONLY")
              ),
              or(
                eq(communityMembers.status, "APPROVED"),
                eq(communityMembers.status, "approved")
              )
            ),
            // Hidden posts where user is owner, community admin, moderator, or community creator
            currentUser
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
                    eq(communities.creatorId, currentUser.id)
                  )
                )
              : sql`false`
          )
        );

    dbPosts = await db
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
        communitySlug: communities.slug,
        communityName: communities.displayName,
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
      .limit(20);
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

  // 3. Consultar comunidades destacadas (hasta 5)
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
      if (currentUser) {
        try {
          const membership = await db.query.communityMembers.findFirst({
            where: and(
              eq(communityMembers.communityId, comm.id),
              eq(communityMembers.userId, currentUser.id)
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
                eq(joinRequests.userId, currentUser.id)
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

  // 4. Obtener reputación del usuario actual
  let userRep = { score: 0, level: 1 };
  if (currentUser) {
    try {
      const rep = await db.query.userReputation.findFirst({
        where: eq(userReputation.userId, currentUser.id),
      });
      if (rep) {
        userRep = { score: rep.score || 0, level: rep.level || 1 };
      }
    } catch (error) {
      console.error("Error al obtener reputación para Dashboard:", error);
    }
  }

  // Límite superior aproximado para barra de progreso
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

          {dbPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 px-6">
              <Inbox className="h-10 w-10 text-neutral-700 mb-4" />
              <h3 className="text-sm font-semibold text-neutral-300">Aún no hay publicaciones</h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1 font-light leading-relaxed">
                Únete a comunidades de tu interés y publica tus dudas o recursos para verlos en tu feed.
              </p>
            </div>
          ) : (
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
                    category={post.category || undefined}
                    tags={post.tags}
                    createdAt={timeAgo(post.createdAt)}
                    upvotesCount={0}
                    commentsCount={post.commentsCount || 0}
                    postType={post.postType as "QUESTION" | "RESOURCE" | "DISCUSSION" | "CASE_STUDY"}
                    status={post.status as "ACTIVE" | "HIDDEN" | "DELETED"}
                    currentUserId={currentUser?.id}
                    attachments={postAttachments}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMNA LATERAL (Desktop only) */}
        <div className="hidden lg:flex flex-col gap-8">
          
          {/* Tarjeta de Reputación */}
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

          {/* Comunidades Recomendadas */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-neutral-400" />
              <h3 className="text-sm font-semibold text-neutral-200">Comunidades Destacadas</h3>
            </div>

            <div className="space-y-4">
              {communitiesWithMeta.map((community) => (
                <CommunityCard key={community.id} {...community} />
              ))}
            </div>
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
