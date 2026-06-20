"use client";

import React, { useState } from "react";
import { 
  Award, 
  BookOpen, 
  MessageSquare, 
  CheckCircle2, 
  ExternalLink, 
  User, 
  Calendar, 
  Sparkles, 
  Shield, 
  Inbox,
  Globe,
  Check,
  UserPlus
} from "lucide-react";

const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={{ width: "1.2em", height: "1.2em" }} {...props}>
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className} style={{ width: "1.2em", height: "1.2em" }} {...props}>
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);
import { PostCard, PostCardProps } from "@/components/shared/post-card";
import { getUserLevel, getLevelBadge, getLevelColor } from "@/lib/reputation-rules";
import { followUserAction, unfollowUserAction } from "@/app/actions/follows";

interface BadgeItem {
  id: string;
  badgeCode: string;
  badgeName: string;
  badgeIcon: string;
  awardedAt: string;
}

interface ProfileClientProps {
  profile: {
    userId: string;
    displayName: string;
    username: string;
    avatarUrl?: string;
    bio?: string;
    website?: string;
    twitterUrl?: string;
    githubUrl?: string;
    isExpert: boolean;
    expertise: string[];
    interests: string[];
    skillLevel?: string;
    discoveryGoals: string[];
    createdAt: string;
  };
  reputation: {
    score: number;
    level: number;
  };
  stats: {
    postsCount: number;
    commentsCount: number;
    acceptedAnswersCount: number;
    managedCommunitiesCount: number;
  };
  badges: BadgeItem[];
  postsList: any[];
  currentUserId?: string;
  followersCountInitial: number;
  followingCountInitial: number;
  isFollowingInitial: boolean;
}

const BADGE_DETAILS: Record<string, { description: string }> = {
  FIRST_POST: { description: "Publicó su primera duda o recurso en la comunidad." },
  FIRST_COMMENT: { description: "Participó comentando en el aporte de otro miembro." },
  FIRST_ACCEPTED_ANSWER: { description: "Ayudó a resolver una duda marcándose su respuesta como aceptada." },
  TEN_ACCEPTED_ANSWERS: { description: "Logró solucionar 10 dudas o más dentro de la plataforma." },
  TOP_CONTRIBUTOR: { description: "Alcanzó más de 100 puntos de reputación por sus aportes." },
  COMMUNITY_FOUNDER: { description: "Fundó su propio espacio o comunidad en Consejos." },
  COMMUNITY_ADMIN: { description: "Nombrado administrador para gestionar y moderar comunidades." },
  MENTOR_LEVEL: { description: "Alcanzó la categoría de Mentor con más de 1,500 puntos de reputación." },
  REFERENTE_LEVEL: { description: "Consiguió el rango más alto de Referente superando los 5,000 puntos de reputación." }
};

export function ProfileClient({
  profile,
  reputation,
  stats,
  badges,
  postsList,
  currentUserId,
  followersCountInitial,
  followingCountInitial,
  isFollowingInitial,
}: ProfileClientProps) {
  const [activeTab, setActiveTab] = useState<"posts" | "badges">("posts");
  const [isFollowing, setIsFollowing] = useState(isFollowingInitial);
  const [followersCount, setFollowersCount] = useState(followersCountInitial);
  const [isPending, setIsPending] = useState(false);

  const handleFollowToggle = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      if (isFollowing) {
        const res = await unfollowUserAction(profile.userId);
        if (res.success) {
          setIsFollowing(false);
          setFollowersCount((prev) => Math.max(0, prev - 1));
        }
      } else {
        const res = await followUserAction(profile.userId);
        if (res.success) {
          setIsFollowing(true);
          setFollowersCount((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPending(false);
    }
  };

  const formattedDate = new Date(profile.createdAt).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long"
  });

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8 text-left">
      {/* 1. Tarjeta de Perfil Superior (Hero layout) */}
      <div className="relative p-6 sm:p-8 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md overflow-hidden flex flex-col md:flex-row gap-6 items-start md:items-center">
        {/* Glow Effects */}
        <div className="absolute top-[-50%] left-[-20%] w-[60%] h-[100%] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-50%] right-[-20%] w-[60%] h-[100%] bg-purple-900/5 rounded-full blur-[120px] pointer-events-none" />
        
        {/* Avatar */}
        <div className="relative z-10 shrink-0">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl border border-neutral-800 object-cover shadow-2xl"
            />
          ) : (
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl border border-neutral-850 bg-neutral-900 flex items-center justify-center text-4xl font-semibold text-white shadow-2xl">
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 z-10 flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between w-full gap-4 flex-wrap sm:flex-nowrap">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-heading font-semibold text-white tracking-tight">
                {profile.displayName}
              </h1>
              <span className="text-xs text-neutral-500 font-mono">@{profile.username}</span>

              {profile.isExpert && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/40 border border-blue-900/60 px-2.5 py-0.5 text-[9px] font-semibold text-blue-400">
                  <Sparkles className="h-2.5 w-2.5" /> Experto verificado
                </span>
              )}
            </div>

            {/* Follow/Unfollow Button */}
            {currentUserId && currentUserId !== profile.userId && (
              <button
                onClick={handleFollowToggle}
                disabled={isPending}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center shrink-0 ${
                  isFollowing
                    ? "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-red-950/20 hover:border-red-900/40 hover:text-red-400"
                    : "bg-white text-neutral-950 hover:bg-neutral-200"
                }`}
              >
                {isPending ? (
                  <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isFollowing ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Siguiendo</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Seguir</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Level Badges & Follower Counts */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-neutral-400 mt-0.5 font-light">
            <span className={`inline-flex items-center gap-0.5 font-medium ${getLevelColor(reputation.score)}`}>
              <span>{getLevelBadge(reputation.score)}</span>
              <span>{getUserLevel(reputation.score)}</span>
            </span>
            <span className="text-neutral-800 select-none">&bull;</span>
            <span className="font-mono text-neutral-300 font-medium">{reputation.score.toLocaleString()} pts</span>
            
            <span className="text-neutral-800 select-none">&bull;</span>
            <span className="text-neutral-300"><span className="font-semibold text-white">{followersCount}</span> seguidores</span>
            <span className="text-neutral-800 select-none">&bull;</span>
            <span className="text-neutral-300"><span className="font-semibold text-white">{followingCountInitial}</span> siguiendo</span>

            <span className="text-neutral-800 select-none">&bull;</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              <Calendar className="h-3.5 w-3.5" /> Miembro desde {formattedDate}
            </span>
          </div>

          {profile.bio ? (
            <p className="text-sm text-neutral-300 font-light leading-relaxed max-w-2xl mt-1">
              {profile.bio}
            </p>
          ) : (
            <p className="text-xs text-neutral-550 italic font-light mt-1">
              Sin biografía disponible.
            </p>
          )}

          {/* Links y redes sociales */}
          <div className="flex flex-wrap gap-3 mt-1.5">
            {profile.website && (
              <a
                href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors border border-neutral-900 bg-neutral-950 px-3 py-1.5 rounded-full hover:border-neutral-800"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Sitio Web</span>
                <ExternalLink className="h-2.5 w-2.5 text-neutral-600" />
              </a>
            )}
            {profile.githubUrl && (
              <a
                href={profile.githubUrl.startsWith("http") ? profile.githubUrl : `https://github.com/${profile.githubUrl.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors border border-neutral-900 bg-neutral-950 px-3 py-1.5 rounded-full hover:border-neutral-800"
              >
                <GithubIcon className="h-3.5 w-3.5" />
                <span>GitHub</span>
                <ExternalLink className="h-2.5 w-2.5 text-neutral-600" />
              </a>
            )}
            {profile.twitterUrl && (
              <a
                href={profile.twitterUrl.startsWith("http") ? profile.twitterUrl : `https://x.com/${profile.twitterUrl.replace("@", "")}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors border border-neutral-900 bg-neutral-950 px-3 py-1.5 rounded-full hover:border-neutral-800"
              >
                <TwitterIcon className="h-3.5 w-3.5" />
                <span>Twitter</span>
                <ExternalLink className="h-2.5 w-2.5 text-neutral-600" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 2. Grid de Estadísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl border border-neutral-900 bg-neutral-950/20 text-center flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Aportes</span>
          <span className="text-xl font-semibold text-white font-mono">{stats.postsCount}</span>
        </div>
        <div className="p-5 rounded-2xl border border-neutral-900 bg-neutral-950/20 text-center flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Comentarios</span>
          <span className="text-xl font-semibold text-white font-mono">{stats.commentsCount}</span>
        </div>
        <div className="p-5 rounded-2xl border border-neutral-900 bg-neutral-950/20 text-center flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Soluciones</span>
          <span className="text-xl font-semibold text-emerald-400 font-mono flex items-center justify-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            <span>{stats.acceptedAnswersCount}</span>
          </span>
        </div>
        <div className="p-5 rounded-2xl border border-neutral-900 bg-neutral-950/20 text-center flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Comunidades Admin</span>
          <span className="text-xl font-semibold text-white font-mono">{stats.managedCommunitiesCount}</span>
        </div>
      </div>

      {/* 3. Panel de Contenido Principal y Detalles Laterales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA DE CONTENIDO (Pestañas de Aportes/Insignias) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Tabs Selector */}
          <div className="flex border-b border-neutral-900">
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-5 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
                activeTab === "posts"
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Aportes ({postsList.length})
            </button>
            <button
              onClick={() => setActiveTab("badges")}
              className={`px-5 py-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
                activeTab === "badges"
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Insignias ({badges.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "posts" && (
            <div className="space-y-6">
              {postsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/10 px-6">
                  <Inbox className="h-10 w-10 text-neutral-700 mb-4" />
                  <h3 className="text-sm font-semibold text-neutral-300">Aún no hay publicaciones</h3>
                  <p className="text-xs text-neutral-500 max-w-sm mt-1 font-light leading-relaxed">
                    Este usuario no ha publicado nada en las comunidades públicas en las que participa.
                  </p>
                </div>
              ) : (
                postsList.map((post) => (
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
                    createdAt={new Date(post.createdAt).toLocaleDateString()}
                    upvotesCount={0}
                    commentsCount={post.commentsCount || 0}
                    postType={post.postType as any}
                    status={post.status as any}
                    currentUserId={currentUserId}
                    attachments={post.attachments || []}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === "badges" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {badges.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/10 px-6">
                  <Award className="h-10 w-10 text-neutral-700 mb-4" />
                  <h3 className="text-sm font-semibold text-neutral-300">Sin insignias aún</h3>
                  <p className="text-xs text-neutral-500 max-w-sm mt-1 font-light leading-relaxed">
                    Sigue participando y ganando reputación para desbloquear insignias automáticas.
                  </p>
                </div>
              ) : (
                badges.map((badge) => {
                  const definition = BADGE_DETAILS[badge.badgeCode] || { description: "Otorgado por méritos en Consejos." };
                  return (
                    <div
                      key={badge.id}
                      className="p-5 rounded-2xl border border-neutral-900 bg-neutral-950/30 hover:border-neutral-800 transition-all flex items-start gap-4"
                    >
                      <div className="text-3xl shrink-0 p-2.5 rounded-xl bg-neutral-900 border border-neutral-850">
                        {badge.badgeIcon}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="text-xs font-semibold text-neutral-200">{badge.badgeName}</span>
                        <p className="text-[11px] text-neutral-450 leading-relaxed font-light">
                          {definition.description}
                        </p>
                        <span className="text-[9px] text-neutral-600 mt-1">
                          Obtenida el {new Date(badge.awardedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </div>

        {/* COLUMNA LATERAL (Intereses y Preferencias) */}
        <div className="flex flex-col gap-6">
          
          {/* Nivel de Experto / Tags de Expertise */}
          {profile.isExpert && profile.expertise.length > 0 && (
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <span>Especialidades</span>
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {profile.expertise.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] text-blue-400 bg-blue-950/20 border border-blue-900/30 px-2.5 py-1 rounded-full font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Intereses del usuario */}
          <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-purple-400" />
              <span>Intereses</span>
            </h3>
            {profile.interests && profile.interests.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {profile.interests.map((interest) => (
                  <span
                    key={interest}
                    className="text-[10px] text-neutral-300 bg-neutral-900 border border-neutral-850 px-2.5 py-1 rounded-full font-light"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[11px] text-neutral-500 font-light italic">Ningún interés configurado.</span>
            )}
          </div>

          {/* Nivel de Habilidad */}
          {profile.skillLevel && (
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
                <User className="h-4 w-4 text-emerald-400" />
                <span>Nivel de Habilidad</span>
              </h3>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-light">Nivel declarado:</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                  {profile.skillLevel}
                </span>
              </div>
            </div>
          )}

          {/* Objetivos de Aprendizaje / discoveryGoals */}
          {profile.discoveryGoals && profile.discoveryGoals.length > 0 && (
            <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-amber-400" />
                <span>Objetivos en Consejos</span>
              </h3>
              <ul className="flex flex-col gap-2.5 mt-1 text-xs text-neutral-300 font-light">
                {profile.discoveryGoals.map((goal, idx) => (
                  <li key={idx} className="flex gap-2 items-start">
                    <span className="text-neutral-600 font-mono mt-0.5">{idx + 1}.</span>
                    <span>{goal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
