import { db } from "@/db";
import { communities, communityMembers } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect, notFound } from "next/navigation";
import PostFormClient from "./post-form-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function NewPostPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();

  // Forzar inicio de sesión
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

  // Validar permisos
  const isGlobalAdmin = user.globalRole === "GLOBAL_ADMIN";
  if (!isGlobalAdmin) {
    const membership = await db.query.communityMembers.findFirst({
      where: and(
        eq(communityMembers.communityId, community.id),
        eq(communityMembers.userId, user.id)
      ),
    });

    if (!membership || membership.status.toUpperCase() !== "APPROVED") {
      return (
        <div className="flex-1 w-full max-w-md mx-auto px-6 py-20 flex flex-col items-center justify-center text-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-red-950/20 border border-red-900/40 flex items-center justify-center text-red-400 font-bold">
            !
          </div>
          <h3 className="text-base font-semibold text-neutral-200">Acceso No Autorizado</h3>
          <p className="text-xs text-neutral-500 font-light leading-relaxed">
            Solo miembros aprobados de la comunidad pueden crear publicaciones en este espacio.
          </p>
          <a
            href={`/app/r/${slug}`}
            className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 transition-colors mt-2 animate-pulse"
          >
            Volver a la Comunidad
          </a>
        </div>
      );
    }
  }

  return (
    <PostFormClient
      communityId={community.id}
      communitySlug={community.slug}
      communityName={community.displayName}
    />
  );
}
