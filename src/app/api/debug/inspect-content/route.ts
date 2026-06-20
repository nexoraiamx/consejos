import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { poolDb } from "@/db";
import { communities, posts, comments, attachments, communityMembers, profiles } from "@/db/schema";
import { count, eq, isNull, isNotNull, desc } from "drizzle-orm";

export async function GET() {
  try {
    // 1. Validar autenticación y rol GLOBAL_ADMIN
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.globalRole !== "GLOBAL_ADMIN") {
      return NextResponse.json({ error: "No autorizado: Requiere rol GLOBAL_ADMIN" }, { status: 403 });
    }

    // 2. Extraer host y db de DATABASE_URL de forma segura
    const rawDbUrl = process.env.DATABASE_URL || "";
    let maskedUrl = "No definida";
    if (rawDbUrl) {
      const match = rawDbUrl.match(/@([^/]+)\/([^?]+)/);
      if (match) {
        maskedUrl = `postgresql://***:***@${match[1]}/${match[2]}`;
      } else {
        maskedUrl = rawDbUrl.replace(/:[^:@]+@/, ":***@");
      }
    }

    // 3. Ejecutar conteos de forma segura en Neon
    const [commCount] = await poolDb.select({ value: count() }).from(communities);
    const [deletedCommCount] = await poolDb.select({ value: count() }).from(communities).where(isNotNull(communities.deletedAt));
    const [activeCommCount] = await poolDb.select({ value: count() }).from(communities).where(isNull(communities.deletedAt));

    const [postsCount] = await poolDb.select({ value: count() }).from(posts);
    const [activePostsCount] = await poolDb.select({ value: count() }).from(posts).where(eq(posts.status, "ACTIVE"));
    const [deletedPostsCount] = await poolDb.select({ value: count() }).from(posts).where(eq(posts.status, "DELETED"));
    const [deletedAtPostsCount] = await poolDb.select({ value: count() }).from(posts).where(isNotNull(posts.deletedAt));

    const [commentsCount] = await poolDb.select({ value: count() }).from(comments);
    const [activeCommentsCount] = await poolDb.select({ value: count() }).from(comments).where(eq(comments.status, "ACTIVE"));
    const [deletedCommentsCount] = await poolDb.select({ value: count() }).from(comments).where(eq(comments.status, "DELETED"));

    const [attachmentsCount] = await poolDb.select({ value: count() }).from(attachments);
    const [membersCount] = await poolDb.select({ value: count() }).from(communityMembers);

    // 4. Obtener las últimas 20 publicaciones
    const lastPosts = await poolDb.select({
      id: posts.id,
      title: posts.title,
      communityId: posts.communityId,
      authorId: posts.authorId,
      status: posts.status,
      deletedAt: posts.deletedAt,
      createdAt: posts.createdAt
    }).from(posts).orderBy(desc(posts.createdAt)).limit(20);

    // 5. Obtener los últimos 20 comentarios
    const lastComments = await poolDb.select({
      id: comments.id,
      postId: comments.postId,
      authorId: comments.authorId,
      status: comments.status,
      deletedAt: comments.deletedAt,
      createdAt: comments.createdAt
    }).from(comments).orderBy(desc(comments.createdAt)).limit(20);

    // 6. Obtener los últimos 20 adjuntos
    const lastAttachments = await poolDb.select({
      id: attachments.id,
      fileKey: attachments.fileKey,
      mimeType: attachments.mimeType,
      targetType: attachments.targetType,
      targetId: attachments.targetId,
      uploaderId: attachments.uploaderId,
      createdAt: attachments.createdAt
    }).from(attachments).orderBy(desc(attachments.createdAt)).limit(20);

    return NextResponse.json({
      environment: {
        DATABASE_URL: maskedUrl,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL || null,
        VERCEL_ENV: process.env.VERCEL_ENV || null
      },
      counts: {
        communities: {
          total: commCount.value,
          active: activeCommCount.value,
          deleted: deletedCommCount.value
        },
        posts: {
          total: postsCount.value,
          statusActive: activePostsCount.value,
          statusDeleted: deletedPostsCount.value,
          deletedAtNotNull: deletedAtPostsCount.value
        },
        comments: {
          total: commentsCount.value,
          statusActive: activeCommentsCount.value,
          statusDeleted: deletedCommentsCount.value
        },
        attachments: attachmentsCount.value,
        memberships: membersCount.value
      },
      last20Posts: lastPosts,
      last20Comments: lastComments,
      last20Attachments: lastAttachments
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });

  } catch (error: any) {
    console.error("Error en API debug inspect-content:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
