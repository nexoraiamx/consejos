import { db } from "@/db";
import { communities, communityMembers, profiles, posts, userReputation } from "@/db/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { ArrowLeft, Inbox, Globe, Lock, ShieldAlert, Calendar, User, EyeOff, Shield, Plus } from "lucide-react";
import Link from "next/link";
import JoinButton from "./join-button";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/shared/post-card";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

// Función auxiliar para formatear fechas relativas
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

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params;
  const currentUser = await getCurrentUser();

  // 1. Consultar la comunidad en Neon DB
  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.slug, slug),
      isNull(communities.deletedAt)
    ),
  });

  if (!community) {
    notFound();
  }

  // 2. Cantidad de miembros con APPROVED
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, community.id),
        eq(communityMembers.status, "APPROVED")
      )
    );

  const membersCount = countResult?.count || 0;

  // 3. Consultar membresía del usuario actual
  let isJoined = false;
  let membershipStatus: "APPROVED" | "PENDING" | "BANNED" | null = null;
  let userRole: "COMMUNITY_ADMIN" | "MODERATOR" | "MEMBER" | null = null;

  if (currentUser) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, community.id),
        eq(communityMembers.userId, currentUser.id)
      ),
    });

    if (membership) {
      isJoined = membership.status === "APPROVED";
      membershipStatus = membership.status as "APPROVED" | "PENDING" | "BANNED";
      userRole = membership.role as "COMMUNITY_ADMIN" | "MODERATOR" | "MEMBER";
    }
  }

  const isGlobalAdmin = currentUser?.globalRole === "GLOBAL_ADMIN";
  const hasAccess = community.privacyType === "PUBLIC" || isJoined || isGlobalAdmin;
  const canModerate = isGlobalAdmin || userRole === "COMMUNITY_ADMIN" || userRole === "MODERATOR";

  // 4. Nombre del creador
  let creatorName = "Sistema";
  if (community.creatorId) {
    const creator = await db.query.profiles.findFirst({
      where: eq(profiles.userId, community.creatorId),
    });
    if (creator) {
      creatorName = creator.displayName;
    }
  }

  // 5. Consultar posts reales de la comunidad con sus autores y reputaciones
  const postConditions = [
    eq(posts.communityId, community.id),
    isNull(posts.deletedAt),
  ];

  if (!canModerate) {
    postConditions.push(eq(posts.status, "ACTIVE"));
  } else {
    // Los moderadores ven ACTIVE y HIDDEN, pero no DELETED
    postConditions.push(sql`${posts.status} != 'DELETED'`);
  }

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
    })
    .from(posts)
    .innerJoin(profiles, eq(profiles.userId, posts.authorId))
    .leftJoin(userReputation, eq(userReputation.userId, posts.authorId))
    .where(and(...postConditions))
    .orderBy(desc(posts.createdAt));

  const getPrivacyIcon = () => {
    switch (community.privacyType) {
      case "PUBLIC":
        return <Globe className="h-4 w-4 text-blue-400" />;
      case "PRIVATE":
        return <Lock className="h-4 w-4 text-emerald-400" />;
      case "INVITE_ONLY":
        return <ShieldAlert className="h-4 w-4 text-purple-400" />;
    }
  };

  const getPrivacyText = () => {
    switch (community.privacyType) {
      case "PUBLIC":
        return "Público";
      case "PRIVATE":
        return "Privado";
      case "INVITE_ONLY":
        return "Sólo Invitación";
    }
  };

  const getPrivacyDescription = () => {
    switch (community.privacyType) {
      case "PUBLIC":
        return "Cualquier persona en la plataforma puede ver las publicaciones y miembros de este espacio.";
      case "PRIVATE":
        return "El contenido de este espacio es de acceso restringido. Debes ser un miembro aprobado para ver publicaciones.";
      case "INVITE_ONLY":
        return "Solo usuarios invitados o aquellos cuyas solicitudes de ingreso hayan sido aprobadas pueden ver el contenido.";
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Botón de regreso */}
      <Link
        href="/app/explore"
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Volver a Explorar</span>
      </Link>

      {/* Header Banner - Gradiente premium */}
      <div className="h-40 w-full rounded-3xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border border-neutral-900 relative overflow-hidden flex items-end p-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(120,119,198,0.08),rgba(255,255,255,0))]" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
          <div className="flex items-center gap-4 text-left">
            <div className="h-16 w-16 rounded-2xl border border-neutral-800 bg-neutral-950 flex items-center justify-center text-2xl font-bold text-white shadow-xl shadow-black/40">
              {community.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-heading font-semibold text-white tracking-tight">
                  {community.displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-[9px] font-semibold text-neutral-400">
                  {getPrivacyText()}
                </span>
              </div>
              <span className="text-xs text-neutral-400 mt-1 font-light">
                r/{community.slug} &bull; {membersCount} {membersCount === 1 ? "miembro" : "miembros"}
              </span>
            </div>
          </div>

          {/* Join Button */}
          {currentUser && (
            <div className="flex items-center gap-2">
              <JoinButton
                communityId={community.id}
                initialIsJoined={isJoined}
                initialStatus={membershipStatus}
              />
            </div>
          )}
        </div>
      </div>

      {/* Caso: Sin acceso por privacidad */}
      {!hasAccess ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-neutral-900 rounded-3xl bg-neutral-950/20 px-6 gap-4">
          <div className="h-12 w-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
            <EyeOff className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-base font-semibold text-neutral-200">Esta comunidad es Privada</h3>
            <p className="text-xs text-neutral-500 max-w-md mt-1 font-light leading-relaxed">
              {getPrivacyDescription()} Únete a la comunidad enviando una solicitud para poder ver y interactuar con las publicaciones.
            </p>
          </div>
          
          {membershipStatus === "PENDING" ? (
            <span className="inline-flex items-center rounded-full bg-neutral-900 border border-neutral-850 px-4 py-2 text-xs font-semibold text-neutral-400">
              Solicitud de ingreso pendiente
            </span>
          ) : (
            <JoinButton
              communityId={community.id}
              initialIsJoined={isJoined}
              initialStatus={membershipStatus}
            />
          )}
        </div>
      ) : (
        /* Caso: Sí tiene acceso */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left mt-2">
          
          {/* COLUMNA PRINCIPAL: Feed de posts */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
              <span className="text-xs font-semibold text-neutral-400 tracking-wider uppercase">Publicaciones</span>
              
              {/* Botón de Nueva Publicación */}
              {currentUser && (isJoined || isGlobalAdmin) && (
                <Link
                  href={`/app/r/${community.slug}/new`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-200 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-800 hover:text-white transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Publicar</span>
                </Link>
              )}
            </div>

            {/* Listado de posts */}
            {dbPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 px-6">
                <Inbox className="h-10 w-10 text-neutral-700 mb-4" />
                <h3 className="text-sm font-semibold text-neutral-300">Aún no hay publicaciones</h3>
                <p className="text-xs text-neutral-500 max-w-sm mt-1 font-light leading-relaxed">
                  Sé el primero en iniciar una conversación compartiendo un aporte o realizando una pregunta en esta comunidad.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {dbPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    id={post.id}
                    title={post.title}
                    content={post.content}
                    communitySlug={community.slug}
                    communityName={community.displayName}
                    authorId={post.authorId}
                    authorName={post.authorName}
                    authorAvatar={post.authorAvatar || undefined}
                    authorReputation={post.authorReputation || 0}
                    category={post.category || undefined}
                    tags={post.tags}
                    createdAt={timeAgo(post.createdAt)}
                    upvotesCount={0}
                    commentsCount={0}
                    postType={post.postType as any}
                    status={post.status as any}
                    currentUserId={currentUser?.id}
                    canModerate={canModerate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* COLUMNA LATERAL: Detalles y Reglas */}
          <div className="flex flex-col gap-6">
            {/* Panel Acerca de */}
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
              <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3">
                Acerca de la comunidad
              </h3>

              <p className="text-xs text-neutral-300 font-light leading-relaxed">
                {community.description || "Esta comunidad aún no cuenta con una descripción."}
              </p>

              <div className="flex flex-col gap-3 mt-2 text-xs text-neutral-400 font-light">
                <div className="flex items-center gap-2">
                  {getPrivacyIcon()}
                  <span>Privacidad: <strong>{getPrivacyText()}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-neutral-500" />
                  <span>Creado por: <strong>{creatorName}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-neutral-500" />
                  <span>
                    Creado el: <strong>{community.createdAt.toLocaleDateString()}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Panel de Roles del Usuario */}
            {currentUser && membershipStatus === "APPROVED" && (
              <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3">
                  Tu membresía
                </h3>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-neutral-400 font-light">Rol local:</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/40 border border-blue-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400">
                    {userRole === "COMMUNITY_ADMIN" ? "Administrador" : userRole === "MODERATOR" ? "Moderador" : "Miembro"}
                  </span>
                </div>
                {userRole === "COMMUNITY_ADMIN" && (
                  <div className="mt-2 p-3 rounded-2xl bg-blue-950/10 border border-blue-900/20 text-[10px] text-blue-400 font-light flex items-center gap-2">
                    <Shield className="h-4 w-4 flex-shrink-0" />
                    <span>Tienes acceso para administrar este espacio y moderar el contenido.</span>
                  </div>
                )}
              </div>
            )}

            {/* Panel de Moderación para Admins/Mods */}
            {canModerate && (
              <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-3">
                <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span>Herramientas de Moderación</span>
                </h3>
                <p className="text-[11px] text-neutral-500 font-light leading-relaxed">
                  Tienes privilegios de moderación en este espacio. Puedes resolver reportes y ocultar publicaciones o comentarios.
                </p>
                <Link
                  href={`/app/r/${community.slug}/moderation`}
                  className="mt-1.5 inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-200 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 hover:text-white transition-all w-full cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>Ver Reportes</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
