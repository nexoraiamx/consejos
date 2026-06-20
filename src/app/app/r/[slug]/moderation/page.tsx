import { db } from "@/db";
import { communities, communityMembers, posts, comments, reports } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { notFound, redirect } from "next/navigation";
import ModerationClient from "./moderation-client";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function CommunityModerationPage({ params }: Props) {
  const { slug } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/sign-in");
  }

  // 1. Obtener comunidad
  const community = await db.query.communities.findFirst({
    where: and(eq(communities.slug, slug), isNull(communities.deletedAt)),
  });

  if (!community) {
    notFound();
  }

  // 2. Validar rol y permisos de moderación
  const isGlobalAdmin = currentUser.globalRole === "GLOBAL_ADMIN";
  let canModerate = isGlobalAdmin;

  if (!isGlobalAdmin) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, community.id),
        eq(communityMembers.userId, currentUser.id)
      ),
    });

    if (
      membership &&
      (membership.role.toLowerCase() === "owner" || membership.role === "COMMUNITY_ADMIN" || membership.role === "MODERATOR") &&
      membership.status.toUpperCase() === "APPROVED"
    ) {
      canModerate = true;
    }
  }

  if (!canModerate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-red-400">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1 max-w-sm">
          <h2 className="text-base font-semibold text-neutral-200">Acceso Denegado</h2>
          <p className="text-xs text-neutral-500 font-light leading-relaxed">
            No cuentas con los privilegios de moderación o administración necesarios para gestionar esta comunidad.
          </p>
        </div>
        <Link
          href={`/app/r/${community.slug}`}
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver a la Comunidad</span>
        </Link>
      </div>
    );
  }

  // 3. Consultar reportes tipo POST vinculados a esta comunidad
  const postReportsResult = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      description: reports.description,
      status: reports.status,
      resolutionNotes: reports.resolutionNotes,
      createdAt: reports.createdAt,
      reporterId: reports.reporterId,
      postTitle: posts.title,
      postAuthorId: posts.authorId,
      postStatus: posts.status,
    })
    .from(reports)
    .innerJoin(posts, eq(reports.targetId, posts.id))
    .where(
      and(
        eq(reports.targetType, "POST"),
        eq(posts.communityId, community.id)
      )
    );

  // 4. Consultar reportes tipo COMMENT vinculados a esta comunidad (a través del post)
  const commentReportsResult = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      description: reports.description,
      status: reports.status,
      resolutionNotes: reports.resolutionNotes,
      createdAt: reports.createdAt,
      reporterId: reports.reporterId,
      commentContent: comments.content,
      commentAuthorId: comments.authorId,
      commentStatus: comments.status,
    })
    .from(reports)
    .innerJoin(comments, eq(reports.targetId, comments.id))
    .innerJoin(posts, eq(comments.postId, posts.id))
    .where(
      and(
        eq(reports.targetType, "COMMENT"),
        eq(posts.communityId, community.id)
      )
    );

  // 5. Mapear y unificar reportes
  const initialReports = [
    ...postReportsResult.map((pr) => ({
      id: pr.id,
      targetType: "POST" as const,
      targetId: pr.targetId,
      reason: pr.reason,
      description: pr.description,
      status: pr.status as "PENDING" | "RESOLVED" | "DISMISSED",
      resolutionNotes: pr.resolutionNotes,
      createdAt: pr.createdAt,
      reporterId: pr.reporterId,
      contentPreview: pr.postTitle,
      contentAuthorId: pr.postAuthorId,
      contentStatus: pr.postStatus as "ACTIVE" | "HIDDEN" | "DELETED",
    })),
    ...commentReportsResult.map((cr) => ({
      id: cr.id,
      targetType: "COMMENT" as const,
      targetId: cr.targetId,
      reason: cr.reason,
      description: cr.description,
      status: cr.status as "PENDING" | "RESOLVED" | "DISMISSED",
      resolutionNotes: cr.resolutionNotes,
      createdAt: cr.createdAt,
      reporterId: cr.reporterId,
      contentPreview: cr.commentContent,
      contentAuthorId: cr.commentAuthorId,
      contentStatus: cr.commentStatus as "ACTIVE" | "HIDDEN" | "DELETED",
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="flex-1 flex flex-col gap-6">
      {/* Botón de regreso */}
      <div className="px-6 pt-6">
        <Link
          href={`/app/r/${community.slug}`}
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver a la Comunidad</span>
        </Link>
      </div>

      <ModerationClient
        initialReports={initialReports}
        communitySlug={community.slug}
        communityName={community.displayName}
      />
    </div>
  );
}
