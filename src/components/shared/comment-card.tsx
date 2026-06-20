"use client";

import React, { useState } from "react";
import { 
  ArrowBigUp, 
  ArrowBigDown, 
  Reply, 
  Edit3, 
  Trash2, 
  EyeOff, 
  Eye, 
  Check, 
  CheckCircle2, 
  Award,
  Flag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ReportModal } from "./report-modal";
import { MediaPreview } from "./media-preview";
import { getUserLevel, getLevelBadge, getLevelColor } from "@/lib/reputation-rules";
import Link from "next/link";
import { Uploader } from "./uploader";
import { AttachmentInput } from "@/app/actions/posts";

export interface CommentCardProps {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorReputation?: number;
  authorUsername?: string;
  content: string;
  status: "ACTIVE" | "HIDDEN" | "DELETED";
  createdAt: string;
  currentUserId?: string;
  canModerate?: boolean;
  isPostAuthor?: boolean;
  isAccepted?: boolean;
  attachments?: AttachmentInput[];
  communityId: string;
  replies?: CommentCardProps[];
  onAcceptAnswer?: (commentId: string) => Promise<void>;
  onEditComment?: (commentId: string, newContent: string) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onHideToggleComment?: (commentId: string, hide: boolean) => Promise<void>;
  onReplyComment?: (parentId: string, content: string, attachments: AttachmentInput[]) => Promise<void>;
}

export function CommentCard({
  id,
  postId,
  parentId,
  authorId,
  authorName,
  authorAvatar,
  authorReputation = 0,
  authorUsername,
  content,
  status,
  createdAt,
  currentUserId,
  canModerate = false,
  isPostAuthor = false,
  isAccepted = false,
  attachments = [],
  communityId,
  replies = [],
  onAcceptAnswer,
  onEditComment,
  onDeleteComment,
  onHideToggleComment,
  onReplyComment,
}: CommentCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<AttachmentInput[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploadError, setHasUploadError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const isAuthor = currentUserId === authorId;
  const isHidden = status === "HIDDEN";

  const handleReplySubmit = async () => {
    if ((!replyText.trim() && replyAttachments.length === 0) || !onReplyComment || isUploading || hasUploadError) return;
    setIsSubmitting(true);
    try {
      await onReplyComment(id, replyText, replyAttachments);
      setReplyText("");
      setReplyAttachments([]);
      setShowReplyForm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    if ((!editText.trim() && attachments.length === 0) || !onEditComment) return;
    setIsSubmitting(true);
    try {
      await onEditComment(id, editText);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteComment || !confirm("¿Estás seguro de que deseas eliminar este comentario?")) return;
    try {
      await onDeleteComment(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleHideToggle = async () => {
    if (!onHideToggleComment) return;
    try {
      await onHideToggleComment(id, !isHidden);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptAnswer = async () => {
    if (!onAcceptAnswer) return;
    try {
      await onAcceptAnswer(id);
    } catch (err) {
      console.error(err);
    }
  };

  // Si está oculto y el usuario no puede moderar, renderizar versión censurada
  const shouldCensor = isHidden && !canModerate;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`flex flex-col gap-2.5 py-4 border-l border-neutral-900 pl-4 md:pl-6 ml-2 md:ml-4 text-left transition-all duration-350 ${
        isAccepted 
          ? "border-emerald-500/50 bg-emerald-950/5 rounded-r-2xl pr-4" 
          : isHidden 
          ? "border-red-950/40 bg-red-950/5 rounded-r-2xl pr-4" 
          : ""
      }`}
    >
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {authorUsername ? (
            <Link href={`/app/profile/${authorUsername}`} className="cursor-pointer shrink-0">
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  className="h-6 w-6 rounded-full border border-neutral-850 object-cover hover:border-neutral-500 transition-colors"
                />
              ) : (
                <div className="h-6 w-6 rounded-full border border-neutral-850 bg-neutral-900 flex items-center justify-center text-[10px] font-semibold text-white hover:border-neutral-500 transition-colors">
                  {authorName.charAt(0).toUpperCase()}
                </div>
              )}
            </Link>
          ) : (
            authorAvatar ? (
              <img
                src={authorAvatar}
                alt={authorName}
                className="h-6 w-6 rounded-full border border-neutral-850 object-cover shrink-0"
              />
            ) : (
              <div className="h-6 w-6 rounded-full border border-neutral-850 bg-neutral-900 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                {authorName.charAt(0).toUpperCase()}
              </div>
            )
          )}
          
          {authorUsername ? (
            <Link 
              href={`/app/profile/${authorUsername}`}
              className="text-xs font-semibold text-neutral-200 hover:text-white transition-colors"
            >
              {authorName}
            </Link>
          ) : (
            <span className="text-xs font-semibold text-neutral-200">{authorName}</span>
          )}
          
          {/* Nivel y Reputación */}
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${getLevelColor(authorReputation)}`}>
            <span>{getLevelBadge(authorReputation)}</span>
            <span>{getUserLevel(authorReputation)}</span>
            <span className="text-neutral-700 font-light select-none mx-0.5">&middot;</span>
            <span className="font-mono">{authorReputation} pts</span>
          </span>

          <span className="text-[10px] text-neutral-700">&bull;</span>
          <span className="text-[10px] text-neutral-500">{createdAt}</span>

          {/* Badges especiales */}
          {isAccepted && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
              <CheckCircle2 className="h-2.5 w-2.5" /> Respuesta aceptada
            </span>
          )}
          {isHidden && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-950/40 border border-red-900/60 px-2 py-0.5 text-[9px] font-medium text-red-450">
              Oculto por moderación
            </span>
          )}
        </div>

        {/* Acciones contextuales superiores */}
        {!shouldCensor && (
          <div className="flex items-center gap-1.5 text-neutral-500">
            {/* Aceptar respuesta (solo para autor del post) */}
            {isPostAuthor && onAcceptAnswer && (
              <button
                onClick={handleAcceptAnswer}
                title={isAccepted ? "Quitar respuesta aceptada" : "Marcar como respuesta aceptada"}
                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                  isAccepted
                    ? "text-emerald-400 bg-emerald-950/30 border-emerald-800/80"
                    : "text-neutral-500 border-neutral-850 hover:text-emerald-400 hover:bg-emerald-950/10 hover:border-emerald-900/40"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Ocultar/Mostrar (para moderadores) */}
            {canModerate && onHideToggleComment && (
              <button
                onClick={handleHideToggle}
                title={isHidden ? "Mostrar comentario" : "Ocultar comentario"}
                className={`p-1 rounded-lg border transition-all cursor-pointer ${
                  isHidden
                    ? "text-red-400 bg-red-950/30 border-red-900/60"
                    : "text-neutral-500 border-neutral-850 hover:text-red-400 hover:bg-red-950/10 hover:border-red-900/40"
                }`}
              >
                {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
            )}

            {/* Editar (para autor) */}
            {isAuthor && onEditComment && (
              <button
                onClick={() => {
                  setIsEditing(!isEditing);
                  setEditText(content);
                }}
                title="Editar comentario"
                className="p-1 rounded-lg border border-neutral-850 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-all cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Eliminar (para autor) */}
            {isAuthor && onDeleteComment && (
              <button
                onClick={handleDelete}
                title="Eliminar comentario"
                className="p-1 rounded-lg border border-neutral-850 text-neutral-500 hover:text-red-450 hover:bg-red-950/15 hover:border-red-900/30 transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Reportar (para no autor) */}
            {!isAuthor && currentUserId && (
              <button
                onClick={() => setReportModalOpen(true)}
                title="Reportar comentario"
                className="p-1 rounded-lg border border-neutral-850 text-neutral-500 hover:text-red-450 hover:bg-neutral-900 transition-all cursor-pointer font-semibold"
              >
                <Flag className="h-3.5 w-3.5 text-red-500/80" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contenido / Modo Edición / Censo */}
      <div className="pl-1 pr-2">
        {shouldCensor ? (
          <p className="text-xs text-neutral-550 italic font-light pl-1 py-1">
            Este comentario ha sido ocultado por moderación.
          </p>
        ) : isEditing ? (
          <div className="flex flex-col gap-2 mt-1">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Escribe algo o adjunta audio, imagen, video, PDF o enlace…"
              className="w-full min-h-[70px] p-3 text-xs bg-neutral-900 border border-neutral-800 rounded-2xl text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 resize-none font-light leading-relaxed"
            />
            <div className="flex gap-1.5 self-start">
              <button
                onClick={handleEditSubmit}
                disabled={isSubmitting || (!editText.trim() && attachments.length === 0)}
                className="rounded-full bg-white text-neutral-950 px-3.5 py-1 text-[11px] font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
                className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-450 px-3.5 py-1 text-[11px] font-semibold hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs sm:text-sm text-neutral-300 font-light leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
            {attachments && attachments.length > 0 && (
              <MediaPreview attachments={attachments} />
            )}
          </div>
        )}
      </div>

      {/* Acciones de Footer (Responder) */}
      {!shouldCensor && onReplyComment && (
        <div className="flex items-center gap-4 text-[11px] text-neutral-500 pl-1">
          <button
            onClick={() => setShowReplyForm(prev => !prev)}
            className="inline-flex items-center gap-1.5 hover:text-neutral-200 transition-colors cursor-pointer font-medium"
          >
            <Reply className="h-3.5 w-3.5" />
            <span>Responder</span>
          </button>
        </div>
      )}

      {/* Formulario de Respuesta */}
      <AnimatePresence>
        {showReplyForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-2 mt-2 pl-1 overflow-hidden"
          >
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Escribe algo o adjunta audio, imagen, video, PDF o enlace…"
              className="w-full max-w-xl min-h-[60px] p-3 text-xs bg-neutral-905 border border-neutral-850 rounded-2xl text-white placeholder-neutral-555 focus:outline-none focus:border-neutral-750 resize-none font-light leading-relaxed"
            />
            {/* Uploader para adjuntos en respuestas */}
            <div className="max-w-xl mt-1">
              <Uploader
                communityId={communityId}
                targetType="COMMENT"
                value={replyAttachments}
                onChange={setReplyAttachments}
                onUploadStatusChange={({ isUploading, hasError }) => {
                  setIsUploading(isUploading);
                  setHasUploadError(hasError);
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isUploading && (
                <span className="text-[10px] text-blue-450 animate-pulse font-light mr-auto">
                  Subiendo archivos...
                </span>
              )}
              {hasUploadError && (
                <span className="text-[10px] text-red-400 font-medium mr-auto">
                  Corrige los errores de subida.
                </span>
              )}
              <button
                onClick={handleReplySubmit}
                disabled={isSubmitting || isUploading || hasUploadError || (!replyText.trim() && replyAttachments.length === 0)}
                className="rounded-full bg-white text-neutral-950 px-3.5 py-1 text-[10px] font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isSubmitting ? "Enviando..." : isUploading ? "Subiendo..." : "Enviar"}
              </button>
              <button
                onClick={() => setShowReplyForm(false)}
                disabled={isSubmitting}
                className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-450 px-3.5 py-1 text-[10px] font-semibold hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Respuestas Hijas (Anidadas Recursivamente) */}
      {replies.length > 0 && (
        <div className="mt-2 space-y-1">
          {replies.map((reply) => (
            <CommentCard
              key={reply.id}
              {...reply}
              communityId={communityId}
              currentUserId={currentUserId}
              canModerate={canModerate}
              isPostAuthor={isPostAuthor}
              onAcceptAnswer={onAcceptAnswer}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
              onHideToggleComment={onHideToggleComment}
              onReplyComment={onReplyComment}
            />
          ))}
        </div>
      )}
      {/* Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetType="COMMENT"
        targetId={id}
      />
    </motion.div>
  );
}
