import { db } from "@/db";
import { posts, communities } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect, notFound } from "next/navigation";
import PostEditClient from "./post-edit-client";

interface Props {
  params: Promise<{ slug: string; postId: string }>;
}

export const dynamic = "force-dynamic";

export default async function EditPostPage({ params }: Props) {
  const { slug, postId } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(postId)) {
    notFound();
  }

  const user = await getCurrentUser();

  // Forzar login
  if (!user) {
    redirect("/sign-in");
  }

  // Buscar comunidad
  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.slug, slug),
      isNull(communities.deletedAt)
    ),
  });

  if (!community) {
    notFound();
  }

  // Buscar publicación y validar autoría
  const post = await db.query.posts.findFirst({
    where: and(
      eq(posts.id, postId),
      eq(posts.communityId, community.id),
      isNull(posts.deletedAt)
    ),
  });

  if (!post) {
    notFound();
  }

  if (post.authorId !== user.id) {
    return (
      <div className="flex-1 w-full max-w-md mx-auto px-6 py-20 flex flex-col items-center justify-center text-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-red-950/20 border border-red-900/40 flex items-center justify-center text-red-400 font-bold">
          !
        </div>
        <h3 className="text-base font-semibold text-neutral-200">Acceso Denegado</h3>
        <p className="text-xs text-neutral-500 font-light leading-relaxed">
          Solo el creador original de esta publicación está autorizado para editar su contenido.
        </p>
        <a
          href={`/app/r/${slug}/post/${postId}`}
          className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 transition-colors mt-2"
        >
          Volver al Post
        </a>
      </div>
    );
  }

  return (
    <PostEditClient
      postId={post.id}
      communitySlug={community.slug}
      initialTitle={post.title}
      initialContent={post.content}
      initialPostType={post.postType as "DISCUSSION" | "QUESTION" | "RESOURCE" | "CASE_STUDY"}
      initialCategory={post.category || ""}
      initialTags={post.tags}
    />
  );
}
