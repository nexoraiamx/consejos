"use client";

import React, { useState } from "react";
import { 
  Bell, 
  MessageSquare, 
  ArrowUp, 
  UserPlus, 
  Inbox, 
  Check, 
  Trash2, 
  ShieldAlert,
  CheckCircle,
  EyeOff,
  UserX
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  markNotificationAsReadAction, 
  markAllNotificationsAsReadAction, 
  deleteNotificationAction 
} from "@/app/actions/notifications";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
  targetType: string;
  targetId: string;
  senderId: string | null;
  senderName: string;
  senderUsername: string;
  targetTitle: string;
  content: string;
  communitySlug: string;
}

interface NotificationsClientProps {
  initialNotifications: NotificationItem[];
}

const timeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "año" : "años"}`;
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "mes" : "meses"}`;
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "día" : "días"}`;
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "hora" : "horas"}`;
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `Hace ${interval} ${interval === 1 ? "minuto" : "minutos"}`;
  return "Hace unos segundos";
};

export default function NotificationsClient({ initialNotifications }: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await markNotificationAsReadAction(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        // Refresh server layout/badge
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setLoading(true);
    try {
      const res = await markAllNotificationsAsReadAction();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteNotificationAction(id);
      if (res.success) {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const hasUnread = notifications.some((n) => !n.isRead);

  const getIcon = (type: string, targetType: string) => {
    if (type === "COMMENT") {
      return <MessageSquare className="h-4 w-4 text-blue-400" />;
    }
    if (type === "REACTION") {
      return <ArrowUp className="h-4 w-4 text-emerald-400" />;
    }
    if (type === "INVITATION") {
      return <UserPlus className="h-4 w-4 text-purple-400" />;
    }
    // Moderation/Suspension types
    return <ShieldAlert className="h-4 w-4 text-red-400" />;
  };

  const getLinkUrl = (not: NotificationItem) => {
    if (not.targetType === "COMMUNITY" && not.communitySlug) {
      return `/app/r/${not.communitySlug}`;
    }
    if (not.communitySlug) {
      // Find comment's post or direct post
      const postId = not.targetType === "POST" ? not.targetId : "";
      if (postId) {
        return `/app/r/${not.communitySlug}/post/${postId}`;
      }
      // If comment, we link to the post detail as well
      // The enriched targetId for comment replies might be the comment id.
      // But in notifications page we can still navigate using post information if enriched.
      // For now, let's link to the community page as fallback or post if we have the communitySlug.
    }
    return "/app";
  };

  const getNotificationText = (not: NotificationItem) => {
    const sender = not.senderName || "Sistema";

    switch (not.type) {
      case "COMMENT":
        if (not.targetType === "COMMENT") {
          return (
            <>
              <span className="font-semibold text-white mr-1">{sender}</span>
              respondió a tu comentario en la publicación
              <span className="font-semibold text-neutral-200 ml-1">"{not.targetTitle}"</span>
            </>
          );
        }
        return (
          <>
            <span className="font-semibold text-white mr-1">{sender}</span>
            comentó en tu publicación
            <span className="font-semibold text-neutral-200 ml-1">"{not.targetTitle}"</span>
          </>
        );
      case "REACTION":
        return (
          <>
            <span className="font-semibold text-white mr-1">{sender}</span>
            marcó tu respuesta como aceptada en
            <span className="font-semibold text-neutral-200 ml-1">"{not.targetTitle}"</span>
          </>
        );
      case "INVITATION":
        return (
          <>
            Te has unido a la comunidad
            <span className="font-semibold text-neutral-200 ml-1">"{not.targetTitle}"</span>
          </>
        );
      case "MODERATION":
        // Check reported, hidden, or suspended
        if (not.targetId === "00000000-0000-0000-0000-000000000000") {
          // Account status notification (dummy nil UUID)
          return (
            <>
              Tu estado de cuenta ha sido modificado por el equipo de administración.
            </>
          );
        }
        return (
          <>
            Tu contenido en la publicación
            <span className="font-semibold text-neutral-200 mx-1">"{not.targetTitle}"</span>
            fue procesado por moderación.
          </>
        );
      default:
        return (
          <>
            Nueva alerta del sistema.
          </>
        );
    }
  };

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6 text-left">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-900 pb-5 gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
            Notificaciones
          </h1>
          <p className="text-xs text-neutral-500 font-light">
            Recibe alertas en tiempo real de comentarios, reputación y moderación.
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          {hasUnread && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={loading}
              className="text-[10px] font-semibold tracking-wide uppercase text-neutral-450 hover:text-white transition-colors cursor-pointer"
            >
              Marcar todo como leído
            </button>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-900 rounded-full p-1 shadow-inner">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                filter === "all"
                  ? "bg-neutral-900 border border-neutral-850 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                filter === "unread"
                  ? "bg-neutral-900 border border-neutral-850 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              No leídas
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4">
        <AnimatePresence mode="popLayout">
          {filteredNotifications.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20"
            >
              <Inbox className="h-10 w-10 text-neutral-700 mb-4" />
              <h3 className="text-sm font-semibold text-neutral-300">Todo al día</h3>
              <p className="text-xs text-neutral-500 max-w-[220px] mt-1 font-light">
                No tienes notificaciones {filter === "unread" ? "sin leer" : ""} en este momento.
              </p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredNotifications.map((not) => {
                const linkUrl = getLinkUrl(not);
                return (
                  <motion.div
                    key={not.id}
                    layoutId={not.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-2xl border transition-all duration-300 flex gap-4 ${
                      not.isRead 
                        ? "bg-neutral-950/10 border-neutral-900/60 hover:border-neutral-900" 
                        : "bg-neutral-900/10 border-neutral-850 hover:border-neutral-800 shadow-sm shadow-blue-500/2"
                    }`}
                  >
                    {/* Icon */}
                    <div className="h-8 w-8 rounded-lg bg-neutral-950 border border-neutral-900 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-inner">
                      {getIcon(not.type, not.targetType)}
                    </div>

                    {/* Text content & link */}
                    <div className="flex-1 flex flex-col gap-1 text-left">
                      <div className="text-xs font-light text-neutral-300">
                        {linkUrl !== "/app" ? (
                          <Link 
                            href={linkUrl}
                            onClick={() => {
                              if (!not.isRead) handleMarkAsRead(not.id);
                            }}
                            className="hover:underline"
                          >
                            {getNotificationText(not)}
                          </Link>
                        ) : (
                          getNotificationText(not)
                        )}
                      </div>
                      
                      {not.type === "COMMENT" && not.content && (
                        <p className="text-xs text-neutral-400 font-light border-l-2 border-neutral-850 pl-3 py-1 my-1 italic leading-relaxed">
                          "{not.content}"
                        </p>
                      )}

                      <span className="text-[10px] text-neutral-600 mt-0.5">
                        {timeAgo(not.createdAt)}
                      </span>
                    </div>

                    {/* Quick actions (Check & Delete) */}
                    <div className="flex items-center gap-1.5 self-center">
                      {!not.isRead && (
                        <button
                          onClick={() => handleMarkAsRead(not.id)}
                          title="Marcar como leída"
                          className="p-1.5 rounded-lg border border-neutral-850 text-neutral-500 hover:text-emerald-400 hover:bg-neutral-900 transition-colors cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDelete(not.id)}
                        title="Eliminar notificación"
                        className="p-1.5 rounded-lg border border-neutral-850 text-neutral-500 hover:text-red-400 hover:bg-neutral-900 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
