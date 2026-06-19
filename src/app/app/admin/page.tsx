import { db } from "@/db";
import { users, profiles, reports, posts, comments, communities, auditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import AdminClient from "./admin-client";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GlobalAdminPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/sign-in");
  }

  // Verificar que sea GLOBAL_ADMIN
  if (currentUser.globalRole !== "GLOBAL_ADMIN") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-red-400">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1 max-w-sm">
          <h2 className="text-base font-semibold text-neutral-200">Acceso Restringido</h2>
          <p className="text-xs text-neutral-500 font-light leading-relaxed">
            Esta zona es de uso exclusivo para Administradores Globales de la plataforma Consejos.
          </p>
        </div>
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al Feed</span>
        </Link>
      </div>
    );
  }

  // 1. Obtener todos los reportes de tipo POST
  const postReports = await db
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
      communitySlug: communities.slug,
    })
    .from(reports)
    .innerJoin(posts, eq(reports.targetId, posts.id))
    .innerJoin(communities, eq(posts.communityId, communities.id));

  // 2. Obtener todos los reportes de tipo COMMENT
  const commentReports = await db
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
      communitySlug: communities.slug,
    })
    .from(reports)
    .innerJoin(comments, eq(reports.targetId, comments.id))
    .innerJoin(posts, eq(comments.postId, posts.id))
    .innerJoin(communities, eq(posts.communityId, communities.id));

  // 3. Consolidar reportes
  const allReports = [
    ...postReports.map((pr) => ({
      id: pr.id,
      targetType: "POST" as const,
      targetId: pr.targetId,
      reason: pr.reason,
      description: pr.description,
      status: pr.status,
      resolutionNotes: pr.resolutionNotes,
      createdAt: pr.createdAt,
      reporterId: pr.reporterId,
      contentPreview: pr.postTitle,
      contentAuthorId: pr.postAuthorId,
      contentStatus: pr.postStatus,
      communitySlug: pr.communitySlug,
    })),
    ...commentReports.map((cr) => ({
      id: cr.id,
      targetType: "COMMENT" as const,
      targetId: cr.targetId,
      reason: cr.reason,
      description: cr.description,
      status: cr.status,
      resolutionNotes: cr.resolutionNotes,
      createdAt: cr.createdAt,
      reporterId: cr.reporterId,
      contentPreview: cr.commentContent,
      contentAuthorId: cr.commentAuthorId,
      contentStatus: cr.commentStatus,
      communitySlug: cr.communitySlug,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // 4. Obtener todos los usuarios del sistema para suspensión
  const allUsersList = await db
    .select({
      id: users.id,
      email: users.email,
      globalRole: users.globalRole,
      isSuspended: users.isSuspended,
      createdAt: users.createdAt,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(users)
    .leftJoin(profiles, eq(users.id, profiles.userId))
    .orderBy(desc(users.createdAt));

  // 5. Obtener logs de auditoría recientes (últimos 100)
  const recentLogs = await db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      description: auditLogs.description,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="px-6 pt-6">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al Feed</span>
        </Link>
      </div>

      <AdminClient
        initialReports={allReports}
        initialUsers={allUsersList}
        initialLogs={recentLogs}
        currentAdminId={currentUser.id}
      />
    </div>
  );
}
