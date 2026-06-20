import React from "react";
import { db } from "@/db";
import { invitations, communityMembers, communities, auditLogs } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const currentUser = await getCurrentUser();

  // 1. Si el usuario no está logueado, redirigir a Login de Clerk
  // Clerk redirigirá de vuelta a /invite/[code] tras iniciar sesión
  if (!currentUser) {
    redirect(`/sign-in?redirect_url=/invite/${code}`);
  }

  // 2. Buscar invitación por código
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.code, code),
  });

  // Validaciones
  if (!invitation || !invitation.isActive) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,rgba(120,119,198,0.12),rgba(255,255,255,0))]" />
        
        <div className="relative z-10 max-w-sm w-full p-8 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-xl flex flex-col items-center gap-6 shadow-2xl">
          <div className="h-14 w-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-heading font-semibold text-neutral-200">Invitación Inválida</h2>
            <p className="text-xs text-neutral-500 font-light leading-relaxed">
              El enlace de invitación que intentas usar no existe, ha sido desactivado o ya expiró.
            </p>
          </div>
          <Link
            href="/app/explore"
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-200 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-800 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver a Explorar</span>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Buscar comunidad asociada
  const community = await db.query.communities.findFirst({
    where: and(
      eq(communities.id, invitation.communityId),
      isNull(communities.deletedAt)
    ),
  });

  if (!community) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="relative z-10 max-w-sm w-full p-8 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-xl flex flex-col items-center gap-6 shadow-2xl">
          <div className="h-14 w-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-heading font-semibold text-neutral-200">Espacio no disponible</h2>
            <p className="text-xs text-neutral-500 font-light leading-relaxed">
              La comunidad a la que has sido invitado ya no está disponible en la plataforma.
            </p>
          </div>
          <Link
            href="/app/explore"
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-200 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-800 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver a Explorar</span>
          </Link>
        </div>
      </div>
    );
  }

  // 4. Verificar si ya tiene membresía activa
  const existingMembership = await db.query.communityMembers.findFirst({
    where: and(
      eq(communityMembers.communityId, community.id),
      eq(communityMembers.userId, currentUser.id)
    ),
  });

  if (existingMembership) {
    // Si ya es miembro, simplemente redirigir a la comunidad
    redirect(`/app/r/${community.slug}`);
  }

  // 5. Unir al usuario como miembro aprobado usando el código de invitación
  try {
    await db.transaction(async (tx) => {
      // Registrar membresía
      await tx.insert(communityMembers).values({
        communityId: community.id,
        userId: currentUser.id,
        role: "MEMBER",
        status: "APPROVED",
      });

      // Incrementar contador de usos de la invitación
      await tx.update(invitations)
        .set({
          usesCount: invitation.usesCount + 1,
          updatedAt: new Date()
        })
        .where(eq(invitations.id, invitation.id));

      // Guardar log
      await tx.insert(auditLogs).values({
        actorId: currentUser.id,
        action: "COMMUNITY_JOIN_BY_INVITE",
        targetType: "COMMUNITY",
        targetId: community.id,
        description: `El usuario se unió a la comunidad mediante código de invitación: ${code}`,
      });
    });

    // Redirigir a la comunidad
    redirect(`/app/r/${community.slug}?welcome=true`);
  } catch (error) {
    console.error("Error al procesar la unión por invitación:", error);
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="relative z-10 max-w-sm w-full p-8 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-xl flex flex-col items-center gap-6 shadow-2xl">
          <div className="h-14 w-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-red-400">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-heading font-semibold text-neutral-200">Error de Procesamiento</h2>
            <p className="text-xs text-neutral-500 font-light leading-relaxed">
              Ocurrió un error inesperado al intentar unirse al espacio. Por favor intenta de nuevo.
            </p>
          </div>
          <Link
            href="/app/explore"
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-200 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-800 hover:text-white transition-all cursor-pointer"
          >
            <span>Ir a Explorar</span>
          </Link>
        </div>
      </div>
    );
  }
}
