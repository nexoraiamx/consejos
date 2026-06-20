import React from "react";
import { db } from "@/db";
import { communities, communityMembers, joinRequests, invitations, profiles } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getCurrentUser, getUserCommunityRole } from "@/lib/auth-helpers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import AdminClient from "./admin-client";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function CommunityAdminPage({ params }: Props) {
  const { slug } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/sign-in");
  }

  // 1. Obtener la comunidad
  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.slug, slug),
      isNull(communities.deletedAt)
    ),
  });

  if (!community) {
    notFound();
  }

  // 2. Validar rol y permisos del usuario (owner, COMMUNITY_ADMIN o GLOBAL_ADMIN)
  const isGlobalAdmin = currentUser.globalRole === "GLOBAL_ADMIN";
  let canManage = isGlobalAdmin;

  const roleInfo = await getUserCommunityRole(currentUser.id, community.id);
  if (roleInfo) {
    const roleUpper = roleInfo.role.toUpperCase();
    const statusUpper = roleInfo.status.toUpperCase();
    
    if (roleUpper === "COMMUNITY_ADMIN" && statusUpper === "APPROVED") {
      canManage = true;
    }
  }

  if (!canManage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4 min-h-[50vh]">
        <div className="h-12 w-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-red-400">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-1 max-w-sm">
          <h2 className="text-base font-semibold text-neutral-200">Acceso Denegado</h2>
          <p className="text-xs text-neutral-500 font-light leading-relaxed">
            No tienes los permisos de propietario o administrador necesarios para gestionar esta comunidad.
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

  // 3. Consultar miembros de la comunidad con sus perfiles
  const members = await db
    .select({
      id: communityMembers.id,
      userId: communityMembers.userId,
      role: communityMembers.role,
      status: communityMembers.status,
      createdAt: communityMembers.createdAt,
      displayName: profiles.displayName,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
    })
    .from(communityMembers)
    .leftJoin(profiles, eq(profiles.userId, communityMembers.userId))
    .where(eq(communityMembers.communityId, community.id))
    .orderBy(desc(communityMembers.createdAt));

  // 4. Consultar solicitudes pendientes (joinRequests) con perfiles
  const requests = await db
    .select({
      id: joinRequests.id,
      userId: joinRequests.userId,
      createdAt: joinRequests.createdAt,
      displayName: profiles.displayName,
      username: profiles.username,
      avatarUrl: profiles.avatarUrl,
    })
    .from(joinRequests)
    .leftJoin(profiles, eq(profiles.userId, joinRequests.userId))
    .where(eq(joinRequests.communityId, community.id))
    .orderBy(desc(joinRequests.createdAt));

  // 5. Consultar invitaciones de esta comunidad
  const invites = await db.query.invitations.findMany({
    where: eq(invitations.communityId, community.id),
    orderBy: desc(invitations.createdAt),
  });

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Botón de regreso */}
      <Link
        href={`/app/r/${community.slug}`}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Volver a r/{community.slug}</span>
      </Link>

      <div className="flex flex-col text-left gap-1">
        <h1 className="text-2xl font-heading font-semibold text-white tracking-tight">
          Administrar Comunidad
        </h1>
        <p className="text-xs text-neutral-400 font-light">
          Gestiona los miembros, solicitudes de ingreso, códigos de invitación y configuraciones de <strong>{community.displayName}</strong>.
        </p>
      </div>

      <AdminClient
        community={community}
        initialMembers={members}
        initialRequests={requests}
        initialInvitations={invites}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
