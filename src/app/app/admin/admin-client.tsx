"use client";

import React, { useState } from "react";
import { 
  Shield, 
  Flag, 
  Users, 
  History, 
  Search, 
  EyeOff, 
  Check, 
  X, 
  UserMinus, 
  UserPlus, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  resolveReportAction, 
  dismissReportAction, 
  hideReportedContentAction,
  suspendUserAction,
  unsuspendUserAction
} from "@/app/actions/moderation";

interface ReportItem {
  id: string;
  targetType: "POST" | "COMMENT";
  targetId: string;
  reason: string;
  description: string | null;
  status: string;
  resolutionNotes: string | null;
  createdAt: Date;
  reporterId: string;
  contentPreview: string;
  contentAuthorId: string;
  contentStatus: string;
  communitySlug: string;
}

interface UserItem {
  id: string;
  email: string;
  globalRole: string;
  isSuspended: boolean;
  createdAt: Date;
  username: string | null;
  displayName: string | null;
}

interface AuditLogItem {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  description: string;
  createdAt: Date;
}

interface AdminClientProps {
  initialReports: ReportItem[];
  initialUsers: UserItem[];
  initialLogs: AuditLogItem[];
  currentAdminId: string;
}

export default function AdminClient({ initialReports, initialUsers, initialLogs, currentAdminId }: AdminClientProps) {
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [usersList, setUsersList] = useState<UserItem[]>(initialUsers);
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"reports" | "users" | "audit">("reports");
  
  // Report filter state
  const [reportFilter, setReportFilter] = useState<string>("PENDING");
  
  // User search query
  const [userQuery, setUserQuery] = useState<string>("");

  // Modals / Action states
  const [actioningReportId, setActioningReportId] = useState<string | null>(null);
  const [reportActionType, setReportActionType] = useState<"RESOLVE" | "DISMISS" | "HIDE" | null>(null);
  const [reportNotes, setReportNotes] = useState<string>("");

  const [suspendingUserId, setSuspendingUserId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filtered lists
  const filteredReports = reports.filter((r) => r.status === reportFilter);
  const filteredUsers = usersList.filter((u) => {
    const searchStr = `${u.email} ${u.username || ""} ${u.displayName || ""}`.toLowerCase();
    return searchStr.includes(userQuery.toLowerCase());
  });

  // Report handlers
  const handleReportActionClick = (reportId: string, type: "RESOLVE" | "DISMISS" | "HIDE") => {
    setActioningReportId(reportId);
    setReportActionType(type);
    setReportNotes("");
    setError(null);
  };

  const handleCancelReportAction = () => {
    setActioningReportId(null);
    setReportActionType(null);
    setReportNotes("");
    setError(null);
  };

  const handleConfirmReportAction = async () => {
    if (!actioningReportId || !reportActionType) return;
    setLoading(true);
    setError(null);

    try {
      let res;
      if (reportActionType === "HIDE") {
        res = await hideReportedContentAction(actioningReportId);
      } else if (reportActionType === "RESOLVE") {
        res = await resolveReportAction(actioningReportId, reportNotes.trim());
      } else {
        res = await dismissReportAction(actioningReportId, reportNotes.trim());
      }

      if (res.success) {
        setReports((prev) =>
          prev.map((r) => {
            if (r.id === actioningReportId) {
              return {
                ...r,
                status: reportActionType === "DISMISS" ? "DISMISSED" : "RESOLVED",
                resolutionNotes: reportActionType === "HIDE"
                  ? "Contenido ocultado por el Administrador Global."
                  : (reportNotes.trim() || (reportActionType === "RESOLVE" ? "Resuelto directamente." : "Reporte descartado.")),
                contentStatus: reportActionType === "HIDE" ? "HIDDEN" : r.contentStatus,
              };
            }
            return r;
          })
        );
        
        // Add local log entry simulation or re-fetch (we just update UI)
        setLogs((prev) => [
          {
            id: Math.random().toString(),
            actorId: currentAdminId,
            action: reportActionType === "HIDE" ? "REPORT_RESOLVE" : (reportActionType === "RESOLVE" ? "REPORT_RESOLVE" : "REPORT_DISMISS"),
            targetType: "REPORT",
            targetId: actioningReportId,
            description: `Administrador Global resolvió reporte ${actioningReportId} (${reportActionType})`,
            createdAt: new Date(),
          },
          ...prev
        ]);

        handleCancelReportAction();
      } else {
        setError(res.error || "Ocurrió un error.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error interno.");
    } finally {
      setLoading(false);
    }
  };

  // Suspension handlers
  const handleSuspendClick = (userId: string) => {
    setSuspendingUserId(userId);
    setSuspendReason("");
    setError(null);
  };

  const handleCancelSuspend = () => {
    setSuspendingUserId(null);
    setSuspendReason("");
    setError(null);
  };

  const handleConfirmSuspend = async () => {
    if (!suspendingUserId || !suspendReason.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await suspendUserAction(suspendingUserId, suspendReason.trim());
      if (res.success) {
        setUsersList((prev) =>
          prev.map((u) => (u.id === suspendingUserId ? { ...u, isSuspended: true } : u))
        );
        setLogs((prev) => [
          {
            id: Math.random().toString(),
            actorId: currentAdminId,
            action: "USER_SUSPEND",
            targetType: "USER",
            targetId: suspendingUserId,
            description: `Usuario suspendido. Razón: ${suspendReason}`,
            createdAt: new Date(),
          },
          ...prev
        ]);
        handleCancelSuspend();
      } else {
        setError(res.error || "No se pudo suspender al usuario.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error interno.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsuspend = async (userId: string) => {
    if (!confirm("¿Estás seguro de que deseas levantar la suspensión de este usuario?")) return;
    setLoading(true);
    setError(null);

    try {
      const res = await unsuspendUserAction(userId);
      if (res.success) {
        setUsersList((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isSuspended: false } : u))
        );
        setLogs((prev) => [
          {
            id: Math.random().toString(),
            actorId: currentAdminId,
            action: "USER_UNSUSPEND",
            targetType: "USER",
            targetId: userId,
            description: "Suspensión del usuario revocada",
            createdAt: new Date(),
          },
          ...prev
        ]);
      } else {
        alert(res.error || "No se pudo restaurar al usuario.");
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6 text-left">
      {/* Header Admin Title */}
      <div className="flex flex-col gap-1 border-b border-neutral-900 pb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" />
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Consola de Administración Global
          </h1>
        </div>
        <p className="text-xs text-neutral-500 mt-1 font-light">
          Gestión del sistema, moderación global de reportes, suspensiones y logs de auditoría.
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-neutral-900/60 pb-px gap-1">
        <button
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "reports" ? "border-white text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Flag className="h-4 w-4" />
          <span>Reportes Globales</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "users" ? "border-white text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Gestión de Usuarios</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "audit" ? "border-white text-white" : "border-transparent text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Auditoría de Acciones</span>
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      <div className="flex flex-col gap-6">
        {activeTab === "reports" && (
          <div className="flex flex-col gap-6">
            {/* Report sub-filters */}
            <div className="flex gap-2">
              {["PENDING", "RESOLVED", "DISMISSED"].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setReportFilter(s);
                    handleCancelReportAction();
                  }}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-semibold border transition-all cursor-pointer ${
                    reportFilter === s
                      ? "bg-white text-neutral-950 border-white"
                      : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  {s === "PENDING" ? "Pendientes" : s === "RESOLVED" ? "Resueltos" : "Descartados"}
                </button>
              ))}
            </div>

            {/* List */}
            <AnimatePresence mode="popLayout">
              {filteredReports.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 px-6 gap-3"
                >
                  <Clock className="h-9 w-9 text-neutral-700" />
                  <h3 className="text-sm font-semibold text-neutral-300">Sin reportes registrados</h3>
                  <p className="text-xs text-neutral-500 font-light max-w-xs">
                    No se encuentran reportes en el estado seleccionado.
                  </p>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredReports.map((item) => (
                    <motion.div
                      key={item.id}
                      layoutId={item.id}
                      className={`p-6 rounded-3xl border ${
                        item.contentStatus === "HIDDEN" ? "border-red-950/30 bg-red-950/5" : "border-neutral-900 bg-neutral-950/30"
                      } backdrop-blur-md flex flex-col gap-4`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900/60 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-200">
                            r/{item.communitySlug}
                          </span>
                          <span className="text-neutral-700">&bull;</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                            item.targetType === "POST"
                              ? "bg-purple-950/40 border border-purple-900/60 text-purple-400"
                              : "bg-blue-950/40 border border-blue-900/60 text-blue-400"
                          }`}>
                            {item.targetType === "POST" ? "Publicación" : "Comentario"}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-red-950/40 border border-red-900/50 px-2 py-0.5 text-[9px] font-semibold text-red-400">
                            Razón: {item.reason}
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                            Vista Previa de Contenido
                          </span>
                          <div className="p-3 rounded-2xl bg-neutral-900/50 border border-neutral-900 text-xs font-light text-neutral-300 leading-relaxed whitespace-pre-wrap">
                            {item.contentPreview}
                          </div>
                        </div>

                        {item.description && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                              Descripción del reporte
                            </span>
                            <p className="text-xs text-neutral-300 font-light italic">
                              "{item.description}"
                            </p>
                          </div>
                        )}
                      </div>

                      {item.status === "PENDING" ? (
                        <div className="border-t border-neutral-900/60 pt-4 flex flex-col gap-4">
                          {actioningReportId === item.id ? (
                            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-850 flex flex-col gap-3">
                              <div className="text-xs font-semibold text-white">
                                Confirmar Acción: {reportActionType}
                              </div>

                              {error && (
                                <div className="p-2 rounded-xl bg-red-950/15 border border-red-900/30 text-xs text-red-400 font-light">
                                  {error}
                                </div>
                              )}

                              {reportActionType !== "HIDE" && (
                                <textarea
                                  value={reportNotes}
                                  onChange={(e) => setReportNotes(e.target.value)}
                                  placeholder="Notas explicativas de resolución..."
                                  className="w-full min-h-[50px] p-3 text-xs bg-neutral-950 border border-neutral-850 rounded-xl text-white placeholder-neutral-500 focus:outline-none resize-none font-light"
                                />
                              )}

                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={handleCancelReportAction}
                                  className="rounded-full bg-neutral-950 border border-neutral-800 text-neutral-450 px-3.5 py-1.5 text-[10px] font-semibold hover:text-white cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleConfirmReportAction}
                                  className={`rounded-full px-3.5 py-1.5 text-[10px] font-semibold cursor-pointer ${
                                    reportActionType === "HIDE" ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                                  }`}
                                >
                                  Confirmar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => handleReportActionClick(item.id, "DISMISS")}
                                className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-450 px-3.5 py-1.5 text-[10px] font-semibold hover:text-white cursor-pointer"
                              >
                                Descartar
                              </button>
                              <button
                                onClick={() => handleReportActionClick(item.id, "RESOLVE")}
                                className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-450 px-3.5 py-1.5 text-[10px] font-semibold hover:text-white cursor-pointer"
                              >
                                Resolver Directo
                              </button>
                              <button
                                onClick={() => handleReportActionClick(item.id, "HIDE")}
                                className="rounded-full bg-red-950/20 border border-red-900/40 text-red-400 px-4 py-1.5 text-[10px] font-semibold hover:bg-red-950/30 hover:border-red-800 cursor-pointer shadow-sm shadow-red-950/10"
                              >
                                Ocultar Contenido
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="border-t border-neutral-900/60 pt-4 flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                            {item.status === "RESOLVED" ? (
                              <CheckCircle className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-neutral-500" />
                            )}
                            <span>Reporte {item.status === "RESOLVED" ? "Resuelto" : "Descartado"}</span>
                          </div>
                          {item.resolutionNotes && (
                            <p className="text-xs text-neutral-450 bg-neutral-900/10 border border-neutral-900 p-3 rounded-2xl font-light">
                              {item.resolutionNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {activeTab === "users" && (
          <div className="flex flex-col gap-4">
            {/* Search users */}
            <div className="relative">
              <Search className="absolute left-4.5 top-3.5 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Buscar usuarios por email, username o display name..."
                className="w-full pl-12 pr-4 py-3 text-xs bg-neutral-950 border border-neutral-900 rounded-2xl text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-800 font-light"
              />
            </div>

            {/* Users grid/list */}
            <div className="flex flex-col gap-3">
              {filteredUsers.length === 0 ? (
                <div className="py-20 text-center text-xs text-neutral-500">
                  Ningún usuario coincide con tu búsqueda.
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="p-5 rounded-3xl border border-neutral-900 bg-neutral-950/20 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-semibold text-white">
                        {(u.displayName || u.username || u.email).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-200">
                            {u.displayName || "Usuario sin perfil"}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            @{u.username || "sin_username"}
                          </span>
                          {u.isSuspended && (
                            <span className="rounded-full bg-red-950/40 border border-red-900/60 px-2 py-0.5 text-[8px] font-semibold text-red-400">
                              Suspendido
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-neutral-500 mt-0.5">
                          {u.email} &bull; Reg: {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Suspension Actions */}
                    <div>
                      {u.id === currentAdminId ? (
                        <span className="text-[10px] text-neutral-600 font-medium">Eres tú (Admin)</span>
                      ) : u.isSuspended ? (
                        <button
                          onClick={() => handleUnsuspend(u.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-neutral-900 border border-neutral-800 text-emerald-450 px-4 py-2 text-[10px] font-semibold hover:bg-neutral-850 hover:text-emerald-400 cursor-pointer"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Restaurar Cuenta</span>
                        </button>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {suspendingUserId === u.id ? (
                            <div className="flex flex-col gap-2 p-3 rounded-2xl bg-neutral-900 border border-neutral-850 w-72 text-left">
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                                Motivo de la suspensión
                              </span>
                              <textarea
                                value={suspendReason}
                                onChange={(e) => setSuspendReason(e.target.value)}
                                placeholder="Escribe el motivo..."
                                className="p-2 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-white resize-none h-14"
                              />
                              <div className="flex gap-1.5 justify-end">
                                <button
                                  onClick={handleCancelSuspend}
                                  className="rounded-full bg-neutral-950 border border-neutral-800 text-neutral-450 px-2.5 py-1 text-[9px] font-semibold"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleConfirmSuspend}
                                  disabled={!suspendReason.trim()}
                                  className="rounded-full bg-red-650 text-white px-2.5 py-1 text-[9px] font-semibold hover:bg-red-700"
                                >
                                  Suspender
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSuspendClick(u.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-red-950/10 border border-red-900/30 text-red-400 px-4 py-2 text-[10px] font-semibold hover:bg-red-950/20 hover:border-red-800 cursor-pointer"
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              <span>Suspender Cuenta</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
              <span className="text-xs font-semibold text-neutral-400 tracking-wider uppercase flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-neutral-500" />
                <span>Historial de Auditoría Reciente</span>
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl border border-neutral-900 bg-neutral-950/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                >
                  <div className="flex flex-col gap-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-[9px] font-mono text-neutral-400 uppercase">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-neutral-600">&bull;</span>
                      <span className="text-[10px] text-neutral-500">
                        Actor ID: <span className="font-mono text-neutral-450">{log.actorId || "System"}</span>
                      </span>
                    </div>
                    <p className="text-xs text-neutral-300 font-light">
                      {log.description}
                    </p>
                  </div>

                  <span className="text-[9px] text-neutral-500 font-mono self-start sm:self-center">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
