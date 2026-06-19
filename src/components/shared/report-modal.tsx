"use client";

import React, { useState } from "react";
import { Flag, X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createReportAction } from "@/app/actions/moderation";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: "POST" | "COMMENT";
  targetId: string;
}

const REASONS = [
  { value: "SPAM", label: "Spam", desc: "Publicidad no deseada, enlaces repetitivos o estafas." },
  { value: "HARASSMENT", label: "Acoso / Hostigamiento", desc: "Ataques directos, insultos, lenguaje de odio o intimidación." },
  { value: "MISINFORMATION", label: "Información errónea", desc: "Datos falsos, engaños o teorías sin sustento real." },
  { value: "OFF_TOPIC", label: "Fuera de tema", desc: "Contenido que no corresponde a la temática del espacio." },
  { value: "ILLEGAL", label: "Contenido ilegal", desc: "Infracción de derechos, piratería o actividades delictivas." },
  { value: "OTHER", label: "Otro motivo", desc: "Cualquier otra razón que viole las normas comunitarias." },
];

export function ReportModal({ isOpen, onClose, targetType, targetId }: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      setError("Por favor selecciona un motivo.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await createReportAction({
        targetType,
        targetId,
        reason: selectedReason,
        description: description.trim() || undefined,
      });

      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1800);
      } else {
        setError(res.error || "No se pudo enviar el reporte.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Ocurrió un error inesperado al enviar el reporte.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason("");
    setDescription("");
    setError(null);
    setSuccess(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl z-10 text-left"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-900 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Flag className="h-4.5 w-4.5 text-red-500" />
                <h2 className="text-base font-semibold text-white">
                  Reportar {targetType === "POST" ? "Publicación" : "Comentario"}
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-all cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {success ? (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-emerald-950/40 border border-emerald-900/60 flex items-center justify-center text-emerald-400">
                  <Flag className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-neutral-250">Reporte enviado con éxito</h3>
                <p className="text-xs text-neutral-500 max-w-xs leading-relaxed font-light">
                  Agradecemos tu reporte. Nuestro equipo de moderación lo revisará lo antes posible.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                  <div className="p-3 rounded-2xl bg-red-950/15 border border-red-900/30 text-xs text-red-400 font-light flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Reason Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Selecciona un motivo
                  </label>
                  <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                    {REASONS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setSelectedReason(r.value)}
                        className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                          selectedReason === r.value
                            ? "bg-neutral-900 border-neutral-700"
                            : "bg-neutral-950/40 border-neutral-900 hover:border-neutral-850 hover:bg-neutral-950/80"
                        }`}
                      >
                        <span className="text-xs font-semibold text-neutral-200">{r.label}</span>
                        <span className="text-[10px] text-neutral-500 font-light leading-relaxed">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    Detalles adicionales (opcional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe brevemente por qué consideras que este contenido infringe las normas..."
                    className="w-full min-h-[80px] p-3 text-xs bg-neutral-900 border border-neutral-850 rounded-2xl text-white placeholder-neutral-550 focus:outline-none focus:border-neutral-750 resize-none font-light leading-relaxed"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-2 justify-end border-t border-neutral-900 pt-4 mt-1">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-450 px-4 py-2 text-xs font-semibold hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !selectedReason}
                    className="rounded-full bg-white text-neutral-950 px-4 py-2 text-xs font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {isSubmitting ? "Enviando..." : "Enviar Reporte"}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
