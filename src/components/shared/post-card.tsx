"use client";

import React, { useState } from "react";
import { 
  ArrowBigUp, 
  ArrowBigDown, 
  MessageSquare, 
  Bookmark, 
  CheckCircle2, 
  Edit3, 
  Trash2, 
  EyeOff, 
  Eye, 
  MoreHorizontal,
  FileQuestion,
  BookOpen,
  MessageCircle,
  FileCode,
  Award,
  Flag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { softDeletePostAction, hidePostAction, unhidePostAction } from "@/app/actions/posts";
import Link from "next/link";
import { ReportModal } from "./report-modal";

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileUrl: string;
}

export interface PostCardProps {
  id: string;
  title: string;
  content: string;
  communitySlug: string;
  communityName: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorReputation?: number;
  category?: string;
  tags?: string[];
  createdAt: string;
  upvotesCount: number;
  commentsCount: number;
  hasAcceptedAnswer?: boolean;
  attachments?: Attachment[];
  postType: "QUESTION" | "RESOURCE" | "DISCUSSION" | "CASE_STUDY";
  status: "ACTIVE" | "HIDDEN" | "DELETED";
  currentUserId?: string;
  canModerate?: boolean;
}

export function PostCard({
  id,
  title,
  content,
  communitySlug,
  communityName,
  authorId,
  authorName,
  authorAvatar,
  authorReputation = 0,
  category,
  tags = [],
  createdAt,
  upvotesCount: initialUpvotes,
  commentsCount,
  hasAcceptedAnswer = false,
  attachments = [],
  postType,
  status: initialStatus,
  currentUserId,
  canModerate = false,
}: PostCardProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [status, setStatus] = useState<"ACTIVE" | "HIDDEN" | "DELETED">(initialStatus);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const isAuthor = currentUserId === authorId;
  const showMenu = isAuthor || canModerate;

  const handleVote = (type: "up" | "down") => {
    if (userVote === type) {
      setUpvotes(prev => (type === "up" ? prev - 1 : prev + 1));
      setUserVote(null);
    } else {
      const difference = type === "up"
        ? (userVote === "down" ? 2 : 1)
        : (userVote === "up" ? -2 : -1);
      setUpvotes(prev => prev + difference);
      setUserVote(type);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar esta publicación?")) return;
    try {
      const res = await softDeletePostAction(id);
      if (res.success) {
        setStatus("DELETED");
      } else {
        alert(res.error || "No se pudo eliminar la publicación.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al eliminar.");
    } finally {
      setMenuOpen(false);
    }
  };

  const handleToggleHide = async () => {
    try {
      const action = status === "HIDDEN" ? unhidePostAction : hidePostAction;
      const res = await action(id);
      if (res.success) {
        setStatus(res.status as any);
      } else {
        alert(res.error || "No se pudo cambiar el estado de moderación.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al cambiar el estado de visibilidad.");
    } finally {
      setMenuOpen(false);
    }
  };

  const getTypeBadge = () => {
    switch (postType) {
      case "QUESTION":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-950/40 border border-purple-900/60 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
            <FileQuestion className="h-3 w-3" /> Pregunta
          </span>
        );
      case "RESOURCE":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/40 border border-blue-900/60 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
            <BookOpen className="h-3 w-3" /> Recurso
          </span>
        );
      case "CASE_STUDY":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/40 border border-amber-900/60 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
            <FileCode className="h-3 w-3" /> Caso de Estudio
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-[10px] font-semibold text-neutral-400">
            <MessageCircle className="h-3 w-3" /> Debate
          </span>
        );
    }
  };

  // Si está eliminada, no renderizar nada localmente
  if (status === "DELETED") {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`group relative p-6 rounded-3xl border ${
        status === "HIDDEN" 
          ? "border-red-950/50 bg-red-950/5 hover:border-red-900/40" 
          : "border-neutral-900 bg-neutral-950/40 hover:border-neutral-800/80 hover:bg-neutral-950/60"
      } backdrop-blur-md transition-all duration-300 flex flex-col gap-4 text-left shadow-sm shadow-black/10`}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              className="h-8 w-8 rounded-full border border-neutral-800 object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center text-xs font-semibold text-white">
              {authorName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Link 
                href={`/app/r/${communitySlug}`}
                className="text-xs font-semibold text-neutral-200 hover:text-white transition-colors"
              >
                r/{communitySlug}
              </Link>
              <span className="text-[10px] text-neutral-600">&bull;</span>
              <span className="text-xs text-neutral-400">{authorName}</span>
              
              {/* Reputación del Autor */}
              <span className="inline-flex items-center gap-0.5 text-[9px] text-neutral-500 font-mono">
                <Award className="h-2.5 w-2.5 text-blue-500/60" />
                <span>{authorReputation} rep</span>
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 mt-0.5">{createdAt}</span>
          </div>
        </div>

        {/* Badges / Status */}
        <div className="flex items-center gap-2 relative">
          {status === "HIDDEN" && (
            <span className="inline-flex items-center rounded-full bg-red-950/60 border border-red-900/60 px-2 py-0.5 text-[9px] font-semibold text-red-400">
              Oculto
            </span>
          )}
          {getTypeBadge()}
          {category && (
            <span className="inline-flex items-center rounded-full bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
              {category}
            </span>
          )}
          {hasAcceptedAnswer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-900/60 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Resuelto
            </span>
          )}

          {/* Menú de Acciones (Tres puntos) */}
          {showMenu && (
            <div className="relative ml-1">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setMenuOpen(!menuOpen);
                }}
                className="p-1 rounded-lg text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 transition-all cursor-pointer"
              >
                <MoreHorizontal className="h-4.5 w-4.5" />
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <>
                    {/* Backdrop invisible para cerrar al hacer clic fuera */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 mt-1.5 w-40 rounded-xl border border-neutral-850 bg-neutral-950 p-1 shadow-lg z-50 text-xs text-left"
                    >
                      {isAuthor && (
                        <>
                          <Link
                            href={`/app/r/${communitySlug}/post/${id}/edit`}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors w-full"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </Link>
                          <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/15 transition-colors w-full cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </>
                      )}
                      {!isAuthor && currentUserId && (
                        <button
                          onClick={() => {
                            setReportModalOpen(true);
                            setMenuOpen(false);
                          }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors w-full cursor-pointer"
                        >
                          <Flag className="h-3.5 w-3.5 text-red-400" />
                          <span>Reportar</span>
                        </button>
                      )}
                      {canModerate && (
                        <button
                          onClick={handleToggleHide}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-900 transition-colors w-full cursor-pointer"
                        >
                          {status === "HIDDEN" ? (
                            <>
                              <Eye className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Mostrar</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3.5 w-3.5 text-amber-400" />
                              <span>Ocultar</span>
                            </>
                          )}
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Link href={`/app/r/${communitySlug}/post/${id}`} className="flex flex-col gap-2 group/link">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-100 group-hover/link:text-white transition-colors leading-snug">
          {title}
        </h2>
        <p className="text-sm text-neutral-400 font-light leading-relaxed line-clamp-3">
          {content}
        </p>
      </Link>

      {/* Tags List */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] text-neutral-500 bg-neutral-900/60 border border-neutral-900 px-2 py-0.5 rounded-full font-light"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-neutral-900/60 pt-4 mt-2">
        {/* Vote buttons */}
        <div className="flex items-center rounded-full bg-neutral-950 border border-neutral-900 p-0.5 shadow-inner">
          <button
            onClick={() => handleVote("up")}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              userVote === "up"
                ? "text-blue-500 bg-blue-950/20"
                : "text-neutral-500 hover:text-neutral-200"
            }`}
          >
            <ArrowBigUp className="h-4.5 w-4.5" />
          </button>
          <span className="px-2 text-xs font-semibold text-neutral-300 min-w-[20px] text-center font-mono">
            {upvotes}
          </span>
          <button
            onClick={() => handleVote("down")}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              userVote === "down"
                ? "text-red-500 bg-red-950/20"
                : "text-neutral-500 hover:text-neutral-200"
            }`}
          >
            <ArrowBigDown className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Comment and Bookmark */}
        <div className="flex items-center gap-3">
          <Link 
            href={`/app/r/${communitySlug}/post/${id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 border border-neutral-900 px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:border-neutral-800 transition-all cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="font-mono">{commentsCount}</span>
          </Link>
          <button
            onClick={() => setIsBookmarked(prev => !prev)}
            className={`p-1.5 rounded-full bg-neutral-950 border border-neutral-900 transition-all cursor-pointer ${
              isBookmarked
                ? "text-yellow-500 border-yellow-950 bg-yellow-950/20"
                : "text-neutral-400 hover:text-white hover:border-neutral-850"
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>
      </div>
      {/* Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        targetType="POST"
        targetId={id}
      />
    </motion.div>
  );
}
