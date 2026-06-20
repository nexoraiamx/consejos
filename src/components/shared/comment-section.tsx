"use client";

import React, { useState, useTransition } from "react";
import { MessageSquare, AlertCircle } from "lucide-react";
import { CommentCard } from "./comment-card";
import { Uploader } from "./uploader";
import { AttachmentInput } from "@/app/actions/posts";
import { 
  createCommentAction, 
  updateCommentAction, 
  softDeleteCommentAction, 
  hideCommentAction, 
  unhideCommentAction, 
  acceptAnswerAction 
} from "@/app/actions/comments";

interface DBComment {
  id: string;
  postId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorReputation?: number;
  content: string;
  status: "ACTIVE" | "HIDDEN" | "DELETED";
  createdAt: string;
  attachments?: AttachmentInput[];
}

interface DBCommentTreeItem extends DBComment {
  communityId: string;
  replies: DBCommentTreeItem[];
}

interface CommentSectionProps {
  postId: string;
  postAuthorId: string;
  communityId: string;
  initialComments: DBComment[];
  currentUserId?: string;
  currentUserRole?: string;
  canModerate?: boolean;
  isMember?: boolean;
  isSuspended?: boolean;
  acceptedAnswerId?: string | null;
  postStatus?: string;
}

export function CommentSection({
  postId,
  postAuthorId,
  communityId,
  initialComments,
  currentUserId,
  canModerate = false,
  isMember = false,
  isSuspended = false,
  acceptedAnswerId: initialAcceptedAnswerId = null,
  postStatus = "ACTIVE",
}: CommentSectionProps) {
  const [commentsList, setCommentsList] = useState<DBComment[]>(initialComments || []);
  const [acceptedAnswerId, setAcceptedAnswerId] = useState<string | null>(initialAcceptedAnswerId);
  const [rootCommentText, setRootCommentText] = useState("");
  const [rootAttachments, setRootAttachments] = useState<AttachmentInput[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploadError, setHasUploadError] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  
  const isPostAuthor = currentUserId === postAuthorId;
  const isPostInactive = postStatus === "DELETED" || postStatus === "HIDDEN";
 
  // Construir árbol de comentarios
  const buildCommentTree = (flat: DBComment[]) => {
    const map: Record<string, DBCommentTreeItem> = {};
    const roots: DBCommentTreeItem[] = [];
    if (!flat || !Array.isArray(flat)) return [];
 
    flat.forEach((c) => {
      map[c.id] = { ...c, communityId, replies: [] };
    });
 
    flat.forEach((c) => {
      const mapped = map[c.id];
      if (c.parentId && map[c.parentId]) {
        map[c.parentId].replies.push(mapped);
      } else {
        roots.push(mapped);
      }
    });
 
    return roots;
  };
 
  const commentTree = buildCommentTree(commentsList || []);

  const handlePostRootComment = async () => {
    if (!rootCommentText.trim()) return;
    if (isUploading) {
      setErrorMsg("Espera a que terminen de subirse los archivos.");
      return;
    }
    if (hasUploadError) {
      setErrorMsg("Corrige las subidas fallidas antes de comentar.");
      return;
    }
    setErrorMsg(null);

    startTransition(async () => {
      try {
        const res = await createCommentAction({
          postId,
          content: rootCommentText,
          attachments: rootAttachments,
        });

        if (res.success && res.commentId) {
          // Agregar optimísticamente / actualizar localmente el comentario creado
          const now = new Date();
          const newComment: DBComment = {
            id: res.commentId,
            postId,
            parentId: null,
            authorId: currentUserId || "",
            authorName: "Tú",
            authorReputation: 0, // En la siguiente carga mostrará real
            content: rootCommentText,
            status: "ACTIVE",
            createdAt: now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            attachments: rootAttachments,
          };
          setCommentsList((prev) => [...prev, newComment]);
          setRootCommentText("");
          setRootAttachments([]);
        } else {
          setErrorMsg(res.error || "No se pudo publicar el comentario.");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Error al procesar el comentario.";
        setErrorMsg(errorMsg);
      }
    });
  };

  const handleReplyComment = async (parentId: string, replyText: string, replyAttachments: AttachmentInput[]) => {
    setErrorMsg(null);
    try {
      const res = await createCommentAction({
        postId,
        content: replyText,
        parentId,
        attachments: replyAttachments,
      });

      if (res.success && res.commentId) {
        const now = new Date();
        const newReply: DBComment = {
          id: res.commentId,
          postId,
          parentId,
          authorId: currentUserId || "",
          authorName: "Tú",
          authorReputation: 0,
          content: replyText,
          status: "ACTIVE",
          createdAt: now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          attachments: replyAttachments,
        };
        setCommentsList((prev) => [...prev, newReply]);
      } else {
        setErrorMsg(res.error || "No se pudo publicar la respuesta.");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al enviar la respuesta.";
      setErrorMsg(errorMsg);
    }
  };

  const handleEditComment = async (commentId: string, newContent: string) => {
    setErrorMsg(null);
    try {
      const res = await updateCommentAction(commentId, newContent);
      if (res.success) {
        setCommentsList((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, content: newContent } : c))
        );
      } else {
        setErrorMsg(res.error || "No se pudo editar el comentario.");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al actualizar comentario.";
      setErrorMsg(errorMsg);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setErrorMsg(null);
    try {
      const res = await softDeleteCommentAction(commentId);
      if (res.success) {
        setCommentsList((prev) => prev.filter((c) => c.id !== commentId));
        // Si el comentario eliminado era la respuesta aceptada, quitarla localmente
        if (acceptedAnswerId === commentId) {
          setAcceptedAnswerId(null);
        }
      } else {
        setErrorMsg(res.error || "No se pudo eliminar el comentario.");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al eliminar el comentario.";
      setErrorMsg(errorMsg);
    }
  };

  const handleHideToggleComment = async (commentId: string, hide: boolean) => {
    setErrorMsg(null);
    try {
      const action = hide ? hideCommentAction : unhideCommentAction;
      const res = await action(commentId);
      if (res.success) {
        setCommentsList((prev) =>
          prev.map((c) =>
            c.id === commentId
              ? { ...c, status: (hide ? "HIDDEN" : "ACTIVE") as "HIDDEN" | "ACTIVE" }
              : c
          )
        );
      } else {
        setErrorMsg(res.error || "No se pudo moderar el comentario.");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al moderar.";
      setErrorMsg(errorMsg);
    }
  };

  const handleAcceptAnswer = async (commentId: string) => {
    setErrorMsg(null);
    try {
      const res = await acceptAnswerAction(postId, commentId);
      if (res.success) {
        // Toggle: si ya estaba aceptada, desmarcar. Si no, marcar.
        setAcceptedAnswerId((prev) => (prev === commentId ? null : commentId));
      } else {
        setErrorMsg(res.error || "No se pudo cambiar la respuesta aceptada.");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al aceptar la respuesta.";
      setErrorMsg(errorMsg);
    }
  };

  // Determinar si el usuario tiene permiso para comentar
  const canComment = !isSuspended && (isMember || canModerate || currentUserId === postAuthorId);

  return (
    <div className="border-t border-neutral-900 pt-8 mt-4 flex flex-col gap-6 text-left">
      <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
        <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase flex items-center gap-2">
          <span>Comentarios</span>
          <span className="font-mono text-[10px] bg-neutral-900 border border-neutral-800 text-neutral-500 rounded-full px-1.5 py-0.5">
            {commentsList.filter(c => c.status !== "DELETED").length}
          </span>
        </h3>
      </div>

      {/* Alerta de Error */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-red-950/15 border border-red-900/30 text-red-400 text-xs">
          <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-medium">Ocurrió un inconveniente: </span>
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="hover:text-red-300 font-bold ml-2 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Caja de Comentario Principal */}
      {currentUserId ? (
        canComment ? (
          isPostInactive ? (
            <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-900 text-xs text-neutral-500 text-center font-light">
              La publicación ha sido ocultada o eliminada. No se admiten nuevos comentarios.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={rootCommentText}
                onChange={(e) => setRootCommentText(e.target.value)}
                placeholder="Comparte tu opinión experta o aporta al debate..."
                className="w-full min-h-[90px] p-4 text-xs sm:text-sm bg-neutral-955 border border-neutral-900 rounded-2xl text-white placeholder-neutral-550 focus:outline-none focus:border-neutral-800 focus:ring-0 resize-none font-light leading-relaxed transition-colors duration-300"
              />
              <Uploader
                communityId={communityId}
                targetType="COMMENT"
                value={rootAttachments}
                onChange={setRootAttachments}
                onUploadStatusChange={({ isUploading, hasError }) => {
                  setIsUploading(isUploading);
                  setHasUploadError(hasError);
                }}
              />
              <div className="flex items-center justify-end gap-3 mt-1">
                {isUploading && (
                  <span className="text-[11px] text-blue-450 animate-pulse font-light mr-auto">
                    Subiendo archivos...
                  </span>
                )}
                {hasUploadError && (
                  <span className="text-[11px] text-red-400 font-medium mr-auto">
                    Corrige los errores de subida.
                  </span>
                )}
                <button
                  onClick={handlePostRootComment}
                  disabled={isPending || isUploading || hasUploadError || !rootCommentText.trim()}
                  className="rounded-full bg-white text-neutral-950 px-5 py-2 text-xs font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-all cursor-pointer shadow-md"
                >
                  {isPending ? "Publicando..." : isUploading ? "Subiendo..." : "Comentar"}
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="p-4 rounded-2xl bg-neutral-955 border border-neutral-900 text-xs text-neutral-500 text-center font-light">
            {isSuspended 
              ? "Tu cuenta está suspendida. No puedes comentar." 
              : "Debes unirte a esta comunidad como miembro aprobado para poder comentar."}
          </div>
        )
      ) : (
        <div className="p-4 rounded-2xl bg-neutral-955 border border-neutral-900 text-xs text-neutral-500 text-center font-light">
          Debes iniciar sesión para comentar en esta publicación.
        </div>
      )}

      {/* Listado de Comentarios */}
      <div className="mt-2 space-y-1">
        {commentTree.length > 0 ? (
          commentTree.map((comment) => (
            <CommentCard
              key={comment.id}
              {...comment}
              communityId={communityId}
              currentUserId={currentUserId}
              canModerate={canModerate}
              isPostAuthor={isPostAuthor}
              isAccepted={acceptedAnswerId === comment.id}
              onAcceptAnswer={handleAcceptAnswer}
              onEditComment={handleEditComment}
              onDeleteComment={handleDeleteComment}
              onHideToggleComment={handleHideToggleComment}
              onReplyComment={handleReplyComment}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 px-6">
            <MessageSquare className="h-8 w-8 text-neutral-700 mb-3" />
            <h4 className="text-xs font-semibold text-neutral-400">Sin comentarios aún</h4>
            <p className="text-[10px] text-neutral-500 max-w-[280px] mt-1 font-light leading-relaxed">
              Nadie ha respondido a esta publicación. ¡Sé el primero en compartir tu conocimiento!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
