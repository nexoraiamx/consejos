"use client";

import React, { useState } from "react";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Settings as SettingsIcon, 
  Loader2, 
  Copy, 
  Check, 
  Trash2, 
  UserMinus, 
  ShieldCheck, 
  Lock, 
  Globe, 
  ShieldAlert, 
  UserCog
} from "lucide-react";
import { 
  processJoinRequestAction, 
  updateMemberRoleAction, 
  expelMemberAction, 
  createInvitationAction, 
  deactivateInvitationAction,
  updateCommunitySettingsAction
} from "@/app/actions/communities";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  userId: string;
  role: string;
  status: string;
  createdAt: Date;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

interface Request {
  id: string;
  userId: string;
  createdAt: Date;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
}

interface Invitation {
  id: string;
  communityId: string;
  code: string;
  creatorId: string;
  usesCount: number;
  maxUses: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AdminClientProps {
  community: {
    id: string;
    slug: string;
    displayName: string;
    description: string | null;
    privacyType: string;
  };
  initialMembers: Member[];
  initialRequests: Request[];
  initialInvitations: Invitation[];
  currentUserId: string;
}

type TabType = "requests" | "members" | "invitations" | "settings";

export default function AdminClient({
  community,
  initialMembers,
  initialRequests,
  initialInvitations,
  currentUserId
}: AdminClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("requests");
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [requests, setRequests] = useState<Request[]>(initialRequests);
  const [invitationsList, setInvitationsList] = useState<Invitation[]>(initialInvitations);
  
  // Settings Form State
  const [displayName, setDisplayName] = useState(community.displayName);
  const [description, setDescription] = useState(community.description || "");
  const [privacyType, setPrivacyType] = useState<"PUBLIC" | "PRIVATE" | "INVITE_ONLY">(
    community.privacyType as "PUBLIC" | "PRIVATE" | "INVITE_ONLY"
  );
  
  // UI States
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Helper to handle clipboard copy
  const copyToClipboard = (code: string) => {
    const inviteUrl = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // 1. Process join request (Approve/Reject)
  const handleProcessRequest = async (requestId: string, action: "APPROVE" | "REJECT") => {
    setIsActionLoading(requestId);
    try {
      const res = await processJoinRequestAction(requestId, action);
      if (res.success) {
        setRequests(prev => prev.filter(r => r.id !== requestId));
        if (action === "APPROVE") {
          // Refresh page data or just let Next.js refresh handle it
          router.refresh();
        }
      } else {
        alert(res.error || "Ocurrió un error al procesar la solicitud.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al procesar la solicitud.");
    } finally {
      setIsActionLoading(null);
    }
  };

  // 2. Change member role (Promote/Demote)
  const handleUpdateRole = async (memberUserId: string, currentRole: string) => {
    const newRole = currentRole === "MODERATOR" ? "MEMBER" : "MODERATOR";
    const loadingKey = `role-${memberUserId}`;
    setIsActionLoading(loadingKey);
    try {
      const res = await updateMemberRoleAction(community.id, memberUserId, newRole);
      if (res.success) {
        setMembers(prev => 
          prev.map(m => m.userId === memberUserId ? { ...m, role: newRole } : m)
        );
        router.refresh();
      } else {
        alert(res.error || "No se pudo cambiar el rol.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al actualizar rol.");
    } finally {
      setIsActionLoading(null);
    }
  };

  // 3. Expel member
  const handleExpelMember = async (memberUserId: string) => {
    if (!confirm("¿Estás seguro de que deseas expulsar a este miembro de la comunidad?")) return;

    const loadingKey = `expel-${memberUserId}`;
    setIsActionLoading(loadingKey);
    try {
      const res = await expelMemberAction(community.id, memberUserId);
      if (res.success) {
        setMembers(prev => prev.filter(m => m.userId !== memberUserId));
        router.refresh();
      } else {
        alert(res.error || "No se pudo expulsar al miembro.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al expulsar al miembro.");
    } finally {
      setIsActionLoading(null);
    }
  };

  // 4. Create new invitation link
  const handleCreateInvitation = async () => {
    setIsActionLoading("create-invite");
    try {
      const res = await createInvitationAction(community.id);
      if (res.success && res.invitation) {
        setInvitationsList(prev => [res.invitation!, ...prev]);
      } else {
        alert(res.error || "No se pudo crear la invitación.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al crear el código de invitación.");
    } finally {
      setIsActionLoading(null);
    }
  };

  // 5. Deactivate invitation
  const handleDeactivateInvitation = async (invitationId: string) => {
    if (!confirm("¿Estás seguro de que deseas desactivar este enlace de invitación? Ningún usuario podrá ingresar a través de él en el futuro.")) return;

    setIsActionLoading(invitationId);
    try {
      const res = await deactivateInvitationAction(invitationId);
      if (res.success) {
        setInvitationsList(prev => 
          prev.map(i => i.id === invitationId ? { ...i, isActive: false } : i)
        );
      } else {
        alert(res.error || "No se pudo desactivar la invitación.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al desactivar la invitación.");
    } finally {
      setIsActionLoading(null);
    }
  };

  // 6. Save community settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.length < 3) {
      alert("El nombre debe tener al menos 3 caracteres.");
      return;
    }
    setIsSavingSettings(true);
    try {
      const res = await updateCommunitySettingsAction(community.id, displayName, description, privacyType);
      if (res.success) {
        alert("Configuración guardada correctamente.");
        router.refresh();
      } else {
        alert(res.error || "No se pudo guardar la configuración.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar la configuración.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Check if current user is owner
  const currentUserMembership = members.find(m => m.userId === currentUserId);
  const isOwner = currentUserMembership?.role === "owner";

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
      {/* TABS SIDEBAR (Navegación Izquierda) */}
      <div className="md:col-span-1 flex flex-col gap-2 bg-neutral-950/20 border border-neutral-900 rounded-3xl p-4 h-fit text-left">
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-all ${
            activeTab === "requests"
              ? "bg-neutral-900 text-white border border-neutral-850"
              : "text-neutral-400 hover:text-white hover:bg-neutral-900/40 border border-transparent"
          }`}
        >
          <UserPlus className="h-4 w-4" />
          <span>Solicitudes</span>
          {requests.length > 0 && (
            <span className="ml-auto bg-blue-600 text-white rounded-full text-[10px] px-2 py-0.5 font-bold">
              {requests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("members")}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-all ${
            activeTab === "members"
              ? "bg-neutral-900 text-white border border-neutral-850"
              : "text-neutral-400 hover:text-white hover:bg-neutral-900/40 border border-transparent"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Miembros</span>
          <span className="ml-auto text-[10px] text-neutral-500 font-light">
            {members.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("invitations")}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-all ${
            activeTab === "invitations"
              ? "bg-neutral-900 text-white border border-neutral-850"
              : "text-neutral-400 hover:text-white hover:bg-neutral-900/40 border border-transparent"
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Invitaciones</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-medium transition-all ${
            activeTab === "settings"
              ? "bg-neutral-900 text-white border border-neutral-850"
              : "text-neutral-400 hover:text-white hover:bg-neutral-900/40 border border-transparent"
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
          <span>Configuración</span>
        </button>
      </div>

      {/* CONTENT AREA (Lado Derecho) */}
      <div className="md:col-span-3 min-h-[50vh] bg-neutral-950/40 border border-neutral-900 rounded-3xl p-6 md:p-8 flex flex-col text-left">
        
        {/* 1. SOLICITUDES PENDIENTES */}
        {activeTab === "requests" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-neutral-200">Solicitudes de Ingreso</h2>
              <p className="text-xs text-neutral-500 font-light">
                Usuarios que han solicitado unirse a esta comunidad privada. Al aprobarlos tendrán acceso inmediato.
              </p>
            </div>

            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/10">
                <UserPlus className="h-8 w-8 text-neutral-700 mb-3" />
                <p className="text-xs text-neutral-500 font-light">No hay solicitudes de ingreso pendientes.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((req) => (
                  <div 
                    key={req.id} 
                    className="flex items-center justify-between p-4 border border-neutral-900 rounded-2xl bg-neutral-950/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center overflow-hidden">
                        {req.avatarUrl ? (
                          <img src={req.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-neutral-400">
                            {req.displayName?.charAt(0).toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-semibold text-neutral-200">
                          {req.displayName || "Usuario"}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-light">
                          @{req.username || "sin-username"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleProcessRequest(req.id, "APPROVE")}
                        disabled={isActionLoading === req.id}
                        className="rounded-full bg-blue-600 border border-blue-500 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-500/10"
                      >
                        {isActionLoading === req.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <span>Aceptar</span>
                        )}
                      </button>
                      <button
                        onClick={() => handleProcessRequest(req.id, "REJECT")}
                        disabled={isActionLoading === req.id}
                        className="rounded-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 px-4 py-2 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
                      >
                        <span>Rechazar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. GESTIÓN DE MIEMBROS */}
        {activeTab === "members" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-neutral-200">Miembros del Espacio</h2>
              <p className="text-xs text-neutral-500 font-light">
                Listado de todos los miembros aprobados. El propietario puede ascender/degradar moderadores y expulsar usuarios.
              </p>
            </div>

            <div className="space-y-3">
              {members.map((member) => {
                const isMemberOwner = member.role === "owner";
                const isSelf = member.userId === currentUserId;

                return (
                  <div 
                    key={member.id} 
                    className="flex items-center justify-between p-4 border border-neutral-900 rounded-2xl bg-neutral-950/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center overflow-hidden">
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm font-semibold text-neutral-400">
                            {member.displayName?.charAt(0).toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-neutral-200">
                            {member.displayName || "Usuario"}
                          </span>
                          {member.role === "owner" ? (
                            <span className="inline-flex items-center rounded-full bg-blue-950/45 border border-blue-900/60 px-2 py-0.5 text-[8px] font-bold text-blue-400 uppercase tracking-wider">
                              Owner
                            </span>
                          ) : member.role === "COMMUNITY_ADMIN" ? (
                            <span className="inline-flex items-center rounded-full bg-indigo-950/45 border border-indigo-900/60 px-2 py-0.5 text-[8px] font-bold text-indigo-400 uppercase tracking-wider">
                              Admin
                            </span>
                          ) : member.role === "MODERATOR" ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-950/45 border border-emerald-900/60 px-2 py-0.5 text-[8px] font-bold text-emerald-400 uppercase tracking-wider">
                              Mod
                            </span>
                          ) : null}
                          {isSelf && (
                            <span className="text-[9px] text-neutral-500 italic">(tú)</span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500 font-light">
                          @{member.username || "sin-username"}
                        </span>
                      </div>
                    </div>

                    {/* Controles de administración (sólo propietario o administradores, protegiendo al propietario) */}
                    {!isMemberOwner && !isSelf && (isOwner || currentUserId === community.id) && (
                      <div className="flex items-center gap-2">
                        {/* Promote/Demote Moderator (Only Owner) */}
                        {isOwner && (
                          <button
                            onClick={() => handleUpdateRole(member.userId, member.role)}
                            disabled={isActionLoading === `role-${member.userId}`}
                            className="rounded-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer"
                            title={member.role === "MODERATOR" ? "Quitar moderación" : "Dar moderación"}
                          >
                            {isActionLoading === `role-${member.userId}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <UserCog className="h-3.5 w-3.5 text-neutral-400" />
                                <span>{member.role === "MODERATOR" ? "Degradar" : "Hacer Mod"}</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Expel Member */}
                        <button
                          onClick={() => handleExpelMember(member.userId)}
                          disabled={isActionLoading === `expel-${member.userId}`}
                          className="rounded-full bg-neutral-950 border border-neutral-900 hover:bg-red-950/20 hover:border-red-900/40 text-neutral-500 hover:text-red-400 p-2 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
                          title="Expulsar de la comunidad"
                        >
                          {isActionLoading === `expel-${member.userId}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. SISTEMA DE INVITACIONES */}
        {activeTab === "invitations" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
              <div className="flex flex-col gap-1 text-left">
                <h2 className="text-base font-semibold text-neutral-200">Enlaces de Invitación</h2>
                <p className="text-xs text-neutral-500 font-light">
                  Genera enlaces únicos para saltarse el flujo de aprobación y unirse instantáneamente.
                </p>
              </div>

              <button
                onClick={handleCreateInvitation}
                disabled={isActionLoading === "create-invite"}
                className="rounded-full bg-blue-600 border border-blue-500 hover:bg-blue-700 text-white px-4 py-2 text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shadow-blue-500/10"
              >
                {isActionLoading === "create-invite" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Crear Enlace</span>
                  </>
                )}
              </button>
            </div>

            {invitationsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-2xl bg-neutral-950/10">
                <Mail className="h-8 w-8 text-neutral-700 mb-3" />
                <p className="text-xs text-neutral-500 font-light">No has generado enlaces de invitación aún.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {invitationsList.map((invite) => {
                  const inviteUrl = typeof window !== "undefined" 
                    ? `${window.location.origin}/invite/${invite.code}` 
                    : `/invite/${invite.code}`;

                  return (
                    <div 
                      key={invite.id} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-2xl transition-all gap-4 text-left ${
                        invite.isActive 
                          ? "border-neutral-900 bg-neutral-950/20" 
                          : "border-neutral-950 bg-neutral-950/5 opacity-55"
                      }`}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2.5">
                          <code className="text-xs font-mono font-semibold text-neutral-300 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-850">
                            {invite.code}
                          </code>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${
                            invite.isActive
                              ? "bg-emerald-950/30 border-emerald-900/60 text-emerald-400"
                              : "bg-neutral-900 border-neutral-800 text-neutral-500"
                          }`}>
                            {invite.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500 font-mono select-all select-none">
                          {inviteUrl}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-light">
                          Ingresaron: <strong className="text-neutral-300">{invite.usesCount}</strong> usuarios &bull; Creado el {new Date(invite.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 self-end sm:self-center">
                        {invite.isActive && (
                          <>
                            <button
                              onClick={() => copyToClipboard(invite.code)}
                              className="rounded-full bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                              title="Copiar enlace"
                            >
                              {copiedCode === invite.code ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  <span className="text-emerald-400">Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 text-neutral-400" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleDeactivateInvitation(invite.id)}
                              disabled={isActionLoading === invite.id}
                              className="rounded-full bg-neutral-950 border border-neutral-900 hover:bg-red-950/20 hover:border-red-900/40 text-neutral-500 hover:text-red-400 p-2 text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
                              title="Desactivar / Revocar invitación"
                            >
                              {isActionLoading === invite.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. CONFIGURACIÓN DE PRIVACIDAD */}
        {activeTab === "settings" && (
          <form onSubmit={handleSaveSettings} className="flex flex-col gap-6 text-left">
            <div className="flex flex-col gap-1 border-b border-neutral-900 pb-4">
              <h2 className="text-base font-semibold text-neutral-200">Ajustes de la Comunidad</h2>
              <p className="text-xs text-neutral-500 font-light">
                Modifica el nombre público, la descripción y el nivel de acceso/privacidad del espacio.
              </p>
            </div>

            {/* Nombre público */}
            <div className="flex flex-col gap-2">
              <label htmlFor="displayName" className="text-xs font-semibold text-neutral-400">
                Nombre de la comunidad
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-2xl bg-neutral-950 border border-neutral-900 px-4 py-3 text-xs font-medium text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-all"
                placeholder="Ej. Programadores Next.js"
              />
            </div>

            {/* Descripción */}
            <div className="flex flex-col gap-2">
              <label htmlFor="description" className="text-xs font-semibold text-neutral-400">
                Descripción / Bio
              </label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-2xl bg-neutral-950 border border-neutral-900 px-4 py-3 text-xs font-medium text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700 transition-all resize-none leading-relaxed"
                placeholder="Describe el propósito del espacio..."
              />
            </div>

            {/* Privacidad */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-neutral-400 mb-1">
                Nivel de Privacidad
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPrivacyType("PUBLIC")}
                  className={`flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    privacyType === "PUBLIC"
                      ? "border-blue-500 bg-blue-950/10 text-white"
                      : "border-neutral-900 bg-neutral-950/20 text-neutral-400 hover:border-neutral-850 hover:text-white"
                  }`}
                >
                  <Globe className={`h-4 w-4 ${privacyType === "PUBLIC" ? "text-blue-400" : "text-neutral-500"}`} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Público</span>
                    <span className="text-[9px] text-neutral-500 mt-1 font-light leading-relaxed">
                      Cualquier persona puede unirse y ver posts.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrivacyType("PRIVATE")}
                  className={`flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    privacyType === "PRIVATE"
                      ? "border-emerald-500 bg-emerald-950/10 text-white"
                      : "border-neutral-900 bg-neutral-950/20 text-neutral-400 hover:border-neutral-850 hover:text-white"
                  }`}
                >
                  <Lock className={`h-4 w-4 ${privacyType === "PRIVATE" ? "text-emerald-400" : "text-neutral-500"}`} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Privado</span>
                    <span className="text-[9px] text-neutral-500 mt-1 font-light leading-relaxed">
                      Se requiere enviar solicitud de aprobación para acceder.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrivacyType("INVITE_ONLY")}
                  className={`flex flex-col gap-2 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    privacyType === "INVITE_ONLY"
                      ? "border-purple-500 bg-purple-950/10 text-white"
                      : "border-neutral-900 bg-neutral-950/20 text-neutral-400 hover:border-neutral-850 hover:text-white"
                  }`}
                >
                  <ShieldAlert className={`h-4 w-4 ${privacyType === "INVITE_ONLY" ? "text-purple-400" : "text-neutral-500"}`} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold">Sólo Invitación</span>
                    <span className="text-[9px] text-neutral-500 mt-1 font-light leading-relaxed">
                      Sólo es posible unirse mediante enlace o si eres agregado.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSavingSettings}
              className="rounded-full bg-blue-600 border border-blue-500 hover:bg-blue-700 text-white px-6 py-3 text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all w-fit cursor-pointer mt-4 shadow-sm shadow-blue-500/10"
            >
              {isSavingSettings ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>Guardar Cambios</span>
              )}
            </button>
          </form>
        )}
        
      </div>
    </div>
  );
}
