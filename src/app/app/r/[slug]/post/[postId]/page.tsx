import { db } from "@/db";
import { posts, communities, communityMembers, profiles, userReputation, comments, attachments } from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { CommentSection } from "@/components/shared/comment-section";
import { MediaPreview } from "@/components/shared/media-preview";
import { redirect, notFound } from "next/navigation";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  EyeOff, 
  Award, 
  MessageSquare, 
  Globe, 
  Lock, 
  ShieldAlert, 
  FileQuestion,
  BookOpen,
  MessageCircle,
  FileCode,
  Globe2,
  LockKeyhole
} from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string; postId: string }>;
}

export const dynamic = "force-dynamic";

export default async function PostDetailPage({ params }: Props) {
  const { slug, postId } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(postId)) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  // 1. Obtener detalles de la comunidad
  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.slug, slug),
      isNull(communities.deletedAt)
    ),
  });

  if (!community) {
    notFound();
  }

  // 2. Obtener detalles del post con autor y reputación
  const [postResult] = await db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      postType: posts.postType,
      category: posts.category,
      tags: posts.tags,
      status: posts.status,
      acceptedAnswerId: posts.acceptedAnswerId,
      createdAt: posts.createdAt,
      authorId: posts.authorId,
      authorName: profiles.displayName,
      authorAvatar: profiles.avatarUrl,
      authorBio: profiles.bio,
      authorWebsite: profiles.website,
      authorReputation: userReputation.score,
    })
    .from(posts)
    .leftJoin(profiles, eq(profiles.userId, posts.authorId))
    .leftJoin(userReputation, eq(userReputation.userId, posts.authorId))
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.communityId, community.id),
        isNull(posts.deletedAt)
      )
    )
    .limit(1);

  if (!postResult) {
    notFound();
  }

  const authorName = postResult.authorName || "Usuario Desconocido";
  const authorAvatar = postResult.authorAvatar || undefined;
  const authorBio = postResult.authorBio || "";
  const authorWebsite = postResult.authorWebsite || "";
  const authorReputation = postResult.authorReputation || 0;

  // 3. Validar accesibilidad de privacidad
  let isJoined = false;
  let membershipStatus: string | null = null;
  
  if (currentUser) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, community.id),
        eq(communityMembers.userId, currentUser.id)
      ),
    });
    if (membership) {
      isJoined = membership.status === "APPROVED";
      membershipStatus = membership.status;
    }
  }

  const isGlobalAdmin = currentUser?.globalRole === "GLOBAL_ADMIN";
  const hasAccess = community.privacyType === "PUBLIC" || isJoined || isGlobalAdmin;

  if (!hasAccess) {
    return (
      <div className="flex-1 w-full max-w-md mx-auto px-6 py-20 flex flex-col items-center justify-center text-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-red-950/20 border border-red-900/40 flex items-center justify-center text-red-450">
          <EyeOff className="h-5 w-5 text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-neutral-200">Publicación Restringida</h3>
        <p className="text-xs text-neutral-500 font-light leading-relaxed">
          Esta publicación pertenece a una comunidad privada. Debes unirte y ser aprobado antes de poder leer este contenido.
        </p>
        <Link
          href={`/app/r/${slug}`}
          className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 transition-colors mt-2"
        >
          Ir a r/{slug}
        </Link>
      </div>
    );
  }

  // 4. Obtener comentarios del post
  const dbComments = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      parentId: comments.parentId,
      authorId: comments.authorId,
      content: comments.content,
      status: comments.status,
      createdAt: comments.createdAt,
      authorName: profiles.displayName,
      authorAvatar: profiles.avatarUrl,
      authorReputation: userReputation.score,
    })
    .from(comments)
    .leftJoin(profiles, eq(profiles.userId, comments.authorId))
    .leftJoin(userReputation, eq(userReputation.userId, comments.authorId))
    .where(
      and(
        eq(comments.postId, postId),
        isNull(comments.deletedAt)
      )
    )
    .orderBy(comments.createdAt);

  // Obtener adjuntos para el post
  const postAttachments = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.targetType, "POST"),
        eq(attachments.targetId, postId)
      )
    );

  // Obtener adjuntos para los comentarios
  const commentIds = dbComments.map((c) => c.id);
  const commentAttachmentsResult = commentIds.length > 0
    ? await db
        .select()
        .from(attachments)
        .where(
          and(
            eq(attachments.targetType, "COMMENT"),
            inArray(attachments.targetId, commentIds)
          )
        )
    : [];

  // Calcular si el usuario actual es moderador o administrador local
  let canModerate = isGlobalAdmin;
  if (currentUser && !isGlobalAdmin) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, community.id),
        eq(communityMembers.userId, currentUser.id)
      ),
    });
    if (
      membership &&
      (membership.role === "COMMUNITY_ADMIN" || membership.role === "MODERATOR") &&
      membership.status === "APPROVED"
    ) {
      canModerate = true;
    }
  }

  const formattedComments = dbComments.map((c) => ({
    id: c.id,
    postId: c.postId,
    parentId: c.parentId,
    authorId: c.authorId,
    content: c.content,
    status: c.status as "ACTIVE" | "HIDDEN" | "DELETED",
    createdAt: c.createdAt.toLocaleDateString() + " " + c.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    authorName: c.authorName || "Usuario Desconocido",
    authorAvatar: c.authorAvatar || undefined,
    authorReputation: c.authorReputation || 0,
    attachments: commentAttachmentsResult
      .filter((att) => att.targetId === c.id)
      .map((att) => ({
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileUrl: att.fileUrl,
        fileSize: att.fileSize,
        fileKey: att.fileKey,
      })),
  }));

  const getTypeBadge = () => {
    switch (postResult.postType) {
      case "QUESTION":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-950/40 border border-purple-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-purple-400">
            <FileQuestion className="h-3 w-3" /> Pregunta
          </span>
        );
      case "RESOURCE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/40 border border-blue-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400">
            <BookOpen className="h-3 w-3" /> Recurso
          </span>
        );
      case "CASE_STUDY":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/40 border border-amber-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
            <FileCode className="h-3 w-3" /> Caso de Estudio
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 border border-neutral-800 px-2.5 py-0.5 text-[10px] font-semibold text-neutral-400">
            <MessageCircle className="h-3 w-3" /> Debate
          </span>
        );
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6 text-left">
      {/* Botón volver */}
      <Link
        href={`/app/r/${slug}`}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Volver a r/{slug}</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-2">
        {/* COLUMNA PRINCIPAL: Detalle de publicación */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Post Header Info */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-900 pb-5">
            <div className="flex items-center gap-2.5">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  className="h-9 w-9 rounded-full border border-neutral-850 object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full border border-neutral-850 bg-neutral-900 flex items-center justify-center text-sm font-semibold text-white">
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">
                  {authorName}
                </span>
                <span className="text-[10px] text-neutral-500 mt-0.5">
                  Publicado el {postResult.createdAt.toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getTypeBadge()}
              {postResult.category && (
                <span className="inline-flex items-center rounded-full bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-450">
                  {postResult.category}
                </span>
              )}
            </div>
          </div>

          {/* Post Content */}
          <article className="flex flex-col gap-4 py-2">
            <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-white tracking-tight leading-snug">
              {postResult.title}
            </h1>
            
            {/* Cuerpo del contenido (Soporte de saltos de línea con whitespace-pre-wrap) */}
            <div className="text-sm text-neutral-300 font-light leading-relaxed whitespace-pre-wrap font-sans mt-2">
              {postResult.content}
            </div>

            {/* Adjuntos del Post */}
            {postAttachments.length > 0 && (
              <div className="mt-2">
                <MediaPreview attachments={postAttachments} />
              </div>
            )}

            {/* Tags */}
            {postResult.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral-900/60">
                {postResult.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-neutral-500 bg-neutral-900/60 border border-neutral-900 px-3 py-1 rounded-full font-light"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          {/* Comentarios interactivos */}
          <CommentSection
            postId={postResult.id}
            postAuthorId={postResult.authorId || ""}
            communityId={community.id}
            initialComments={formattedComments}
            currentUserId={currentUser?.id}
            canModerate={canModerate}
            isMember={isJoined}
            isSuspended={currentUser?.isSuspended}
            acceptedAnswerId={postResult.acceptedAnswerId}
            postStatus={postResult.status}
          />

        </div>

        {/* COLUMNA LATERAL: Detalles del Autor e Información de Comunidad */}
        <div className="flex flex-col gap-6">
          
          {/* Card del Autor */}
          <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3">
              Sobre el autor
            </h3>

            <div className="flex items-center gap-3">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  className="h-10 w-10 rounded-full border border-neutral-850 object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full border border-neutral-850 bg-neutral-900 flex items-center justify-center text-sm font-semibold text-white">
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">{authorName}</span>
                <span className="inline-flex items-center gap-1 text-[9px] text-neutral-500 font-mono mt-0.5">
                  <Award className="h-3 w-3 text-blue-500" />
                  <span>{authorReputation} reputación</span>
                </span>
              </div>
            </div>

            {authorBio && (
              <p className="text-xs text-neutral-400 font-light leading-relaxed mt-1">
                {authorBio}
              </p>
            )}

            {authorWebsite && (
              <a
                href={authorWebsite}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-400 hover:underline mt-1 truncate"
              >
                {authorWebsite.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          {/* Card de la Comunidad */}
          <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3">
              Publicado en
            </h3>

            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-center text-xs font-semibold text-white">
                {community.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <Link
                  href={`/app/r/${community.slug}`}
                  className="text-xs font-semibold text-white hover:underline"
                >
                  {community.displayName}
                </Link>
                <span className="text-[10px] text-neutral-500 mt-0.5">r/{community.slug}</span>
              </div>
            </div>

            <p className="text-xs text-neutral-400 font-light leading-relaxed">
              {community.description || "Esta comunidad no tiene descripción disponible."}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
