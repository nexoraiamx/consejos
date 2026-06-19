"use client";

import React, { useState } from "react";
import { Flag, Shield, EyeOff, Check, X, AlertTriangle, ShieldAlert, Clock, CheckCircle, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveReportAction, dismissReportAction, hideReportedContentAction } from "@/app/actions/moderation";

interface ReportItem {
  id: string;
  targetType: "POST" | "COMMENT";
  targetId: string;
  reason: string;
  description: string | null;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  resolutionNotes: string | null;
  createdAt: Date;
  reporterId: string;
  contentPreview: string;
  contentAuthorId: string;
  contentStatus: "ACTIVE" | "HIDDEN" | "DELETED";
}

interface ModerationClientProps {
  initialReports: ReportItem[];
  communitySlug: string;
  communityName: string;
}

export default function ModerationClient({ initialReports, communitySlug, communityName }: ModerationClientProps) {
  const [reports, setReports] = useState<ReportItem[]>(initialReports);
  const [filter, setFilter] = useState<"PENDING" | "RESOLVED" | "DISMISSED">("PENDING");
  
  // Note input states for specific report ID
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"RESOLVE" | "DISMISS" | "HIDE" | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const filteredReports = reports.filter((r) => r.status === filter);

  const handleActionClick = (reportId: string, type: "RESOLVE" | "DISMISS" | "HIDE") => {
    setActioningId(reportId);
    setActionType(type);
    setNotes("");
    setError(null);
  };

  const handleCancelAction = () => {
    setActioningId(null);
    setActionType(null);
    setNotes("");
    setError(null);
  };

  const handleConfirmAction = async () => {
    if (!actioningId || !actionType) return;
    setLoading(true);
    setError(null);

    try {
      let res;
      if (actionType === "HIDE") {
        res = await hideReportedContentAction(actioningId);
      } else if (actionType === "RESOLVE") {
        res = await resolveReportAction(actioningId, notes.trim());
      } else {
        res = await dismissReportAction(actioningId, notes.trim());
      }

      if (res.success) {
        // Update local state
        setReports((prev) =>
          prev.map((r) => {
            if (r.id === actioningId) {
              return {
                ...r,
                status: actionType === "DISMISS" ? "DISMISSED" : "RESOLVED",
                resolutionNotes: actionType === "HIDE" 
                  ? "Contenido ocultado por moderación." 
                  : (notes.trim() || (actionType === "RESOLVE" ? "Resuelto directamente." : "Reporte descartado.")),
                contentStatus: actionType === "HIDE" ? "HIDDEN" : r.contentStatus,
              };
            }
            return r;
          })
        );
        handleCancelAction();
      } else {
        setError(res.error || "Ocurrió un error al procesar el reporte.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Error interno al procesar tu solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case "SPAM": return "Spam";
      case "HARASSMENT": return "Acoso / Hostigamiento";
      case "MISINFORMATION": return "Información errónea";
      case "OFF_TOPIC": return "Fuera de tema";
      case "ILLEGAL": return "Contenido ilegal";
      default: return "Otro";
    }
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-6 text-left">
      {/* Title Header */}
      <div className="flex flex-col gap-1 border-b border-neutral-900 pb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Panel de Moderación
          </h1>
        </div>
        <p className="text-xs text-neutral-500 mt-1 font-light">
          Espacio de revisión de reportes para <strong>{communityName}</strong> (r/{communitySlug})
        </p>
      </div>

      {/* Tabs / Filters */}
      <div className="flex border-b border-neutral-900/60 pb-px gap-1">
        {(["PENDING", "RESOLVED", "DISMISSED"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setFilter(tab);
              handleCancelAction();
            }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              filter === tab
                ? "border-white text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab === "PENDING" ? "Pendientes" : tab === "RESOLVED" ? "Resueltos" : "Descartados"}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex flex-col gap-6">
        <AnimatePresence mode="popLayout">
          {filteredReports.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 px-6 gap-3"
            >
              <Clock className="h-9 w-9 text-neutral-700" />
              <h3 className="text-sm font-semibold text-neutral-300">
                No hay reportes {filter === "PENDING" ? "pendientes" : filter === "RESOLVED" ? "resueltos" : "descartados"}
              </h3>
              <p className="text-xs text-neutral-500 max-w-xs leading-relaxed font-light">
                Todo se encuentra al día. Las notificaciones y denuncias comunitarias aparecerán aquí.
              </p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredReports.map((item) => (
                <motion.div
                  key={item.id}
                  layoutId={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-6 rounded-3xl border ${
                    item.contentStatus === "HIDDEN" 
                      ? "border-red-950/30 bg-red-950/5" 
                      : "border-neutral-900 bg-neutral-950/30"
                  } backdrop-blur-md flex flex-col gap-4`}
                >
                  {/* Top Bar Report Info */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.targetType === "POST"
                          ? "bg-purple-950/40 border border-purple-900/60 text-purple-400"
                          : "bg-blue-950/40 border border-blue-900/60 text-blue-400"
                      }`}>
                        {item.targetType === "POST" ? "Publicación" : "Comentario"}
                      </span>
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-950/40 border border-red-900/50 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                        Motivo: {getReasonLabel(item.reason)}
                      </span>
                    </div>

                    <span className="text-[10px] text-neutral-500 font-mono">
                      Reportado el: {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Body: Report content & preview */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                        Contenido Reportado
                      </span>
                      <div className="p-3.5 rounded-2xl bg-neutral-900/50 border border-neutral-900 text-xs font-light text-neutral-300 leading-relaxed max-h-[120px] overflow-y-auto whitespace-pre-wrap">
                        {item.contentPreview}
                      </div>
                      <span className="text-[10px] text-neutral-500 font-light mt-0.5">
                        ID Contenido: <span className="font-mono">{item.targetId}</span> | Autor: <span className="font-mono">{item.contentAuthorId}</span>
                      </span>
                    </div>

                    {item.description && (
                      <div className="flex flex-col gap-1 mt-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                          Comentario del Denunciante
                        </span>
                        <p className="text-xs text-neutral-300 font-light italic leading-relaxed">
                          "{item.description}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions or resolution notes */}
                  {item.status === "PENDING" ? (
                    <div className="border-t border-neutral-900/60 pt-4 flex flex-col gap-4">
                      {actioningId === item.id ? (
                        /* Modal-like inner action workflow */
                        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-850 flex flex-col gap-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-white">
                            {actionType === "HIDE" && <EyeOff className="h-4 w-4 text-amber-500" />}
                            {actionType === "RESOLVE" && <Check className="h-4 w-4 text-emerald-500" />}
                            {actionType === "DISMISS" && <X className="h-4 w-4 text-neutral-400" />}
                            <span>
                              {actionType === "HIDE" && "Ocultar Contenido y Resolver Reporte"}
                              {actionType === "RESOLVE" && "Resolver Reporte Directamente (Sin Ocultar)"}
                              {actionType === "DISMISS" && "Descartar Reporte (Reporte falso/inválido)"}
                            </span>
                          </div>

                          {error && (
                            <div className="p-2.5 rounded-xl bg-red-950/15 border border-red-900/30 text-xs text-red-400 font-light">
                              {error}
                            </div>
                          )}

                          {actionType !== "HIDE" && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                                Notas de Resolución
                              </label>
                              <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Escribe notas explicativas para la auditoría..."
                                className="w-full min-h-[60px] p-3 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-550 focus:outline-none resize-none font-light leading-relaxed"
                              />
                            </div>
                          )}

                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={handleCancelAction}
                              disabled={loading}
                              className="rounded-full bg-neutral-950 border border-neutral-800 text-neutral-400 px-3.5 py-1.5 text-[10px] font-semibold hover:text-white transition-colors cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleConfirmAction}
                              disabled={loading}
                              className={`rounded-full px-3.5 py-1.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                                actionType === "HIDE"
                                  ? "bg-red-500 text-white hover:bg-red-650"
                                  : actionType === "RESOLVE"
                                  ? "bg-emerald-500 text-white hover:bg-emerald-650"
                                  : "bg-white text-neutral-950 hover:bg-neutral-250"
                              }`}
                            >
                              {loading ? "Procesando..." : "Confirmar"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Default Action buttons */
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            onClick={() => handleActionClick(item.id, "DISMISS")}
                            className="inline-flex items-center gap-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 px-3.5 py-1.5 text-[10px] font-semibold hover:text-white transition-all cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Descartar Reporte</span>
                          </button>

                          <button
                            onClick={() => handleActionClick(item.id, "RESOLVE")}
                            className="inline-flex items-center gap-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 px-3.5 py-1.5 text-[10px] font-semibold hover:text-white transition-all cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Resolver Directo</span>
                          </button>

                          <button
                            onClick={() => handleActionClick(item.id, "HIDE")}
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-950/20 border border-red-900/40 text-red-400 px-4 py-1.5 text-[10px] font-semibold hover:bg-red-950/30 hover:border-red-800 transition-all cursor-pointer shadow-sm shadow-red-950/20"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            <span>Ocultar Contenido</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Resolved status bar info */
                    <div className="border-t border-neutral-900/60 pt-4 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        {item.status === "RESOLVED" ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                            <span>Resuelto</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-neutral-500" />
                            <span>Descartado</span>
                          </>
                        )}
                        <span className="text-[10px] text-neutral-600">&bull;</span>
                        <span className="text-[10px] text-neutral-500 font-light">
                          Moderador: <span className="font-mono text-neutral-400">{item.reporterId}</span>
                        </span>
                      </div>
                      {item.resolutionNotes && (
                        <p className="text-xs text-neutral-400 bg-neutral-900/30 border border-neutral-900 p-3 rounded-2xl font-light">
                          <strong>Notas de resolución:</strong> {item.resolutionNotes}
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
    </div>
  );
}
