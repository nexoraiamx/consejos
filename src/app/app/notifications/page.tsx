"use client";

import React, { useState } from "react";
import { Bell, MessageSquare, ArrowUp, UserPlus, Inbox } from "lucide-react";
import { motion } from "framer-motion";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const mockNotifications = [
    {
      id: "not_1",
      type: "COMMENT",
      senderName: "Elena Rostova",
      targetTitle: "Diseñando interfaces al estilo Apple",
      content: "Excelente artículo Adrián, ¿cómo recomiendas manejar las fuentes customizadas?",
      time: "Hace 10 min",
      isRead: false,
    },
    {
      id: "not_2",
      type: "REACTION",
      senderName: "Juan Pérez",
      targetTitle: "Integración nativa de modelos Gemini",
      content: "le dio upvote a tu publicación.",
      time: "Hace 1 hora",
      isRead: true,
    },
    {
      id: "not_3",
      type: "INVITATION",
      senderName: "Carlos Gómez",
      targetTitle: "Finanzas Personales",
      content: "te invitó a unirte a su comunidad privada.",
      time: "Hace 1 día",
      isRead: true,
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "COMMENT":
        return <MessageSquare className="h-4 w-4 text-blue-400" />;
      case "REACTION":
        return <ArrowUp className="h-4 w-4 text-emerald-400" />;
      case "INVITATION":
        return <UserPlus className="h-4 w-4 text-purple-400" />;
      default:
        return <Bell className="h-4 w-4 text-neutral-400" />;
    }
  };

  const filteredNotifications = filter === "unread" 
    ? mockNotifications.filter(n => !n.isRead) 
    : mockNotifications;

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6 text-left">
      <div className="flex items-center justify-between border-b border-neutral-900 pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
            Notificaciones
          </h1>
          <p className="text-xs text-neutral-500 font-light">
            Recibe alertas sobre interacciones en tus posts, comentarios e invitaciones.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              filter === "all"
                ? "bg-neutral-900 border border-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              filter === "unread"
                ? "bg-neutral-900 border border-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            No leídas
          </button>
        </div>
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20">
          <Inbox className="h-10 w-10 text-neutral-700 mb-4" />
          <h3 className="text-sm font-semibold text-neutral-300">Todo al día</h3>
          <p className="text-xs text-neutral-500 max-w-[200px] mt-1 font-light">No tienes notificaciones pendientes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((not) => (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              key={not.id}
              className={`p-4 rounded-2xl border transition-all duration-300 flex gap-4 ${
                not.isRead 
                  ? "bg-neutral-950/10 border-neutral-900/60 hover:border-neutral-900" 
                  : "bg-neutral-900/20 border-neutral-850 hover:border-neutral-800 shadow-sm shadow-blue-500/2"
              }`}
            >
              <div className="h-8 w-8 rounded-lg bg-neutral-950 border border-neutral-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                {getIcon(not.type)}
              </div>

              <div className="flex-1 flex flex-col gap-1">
                <div className="text-xs font-light text-neutral-300">
                  <span className="font-semibold text-white mr-1">{not.senderName}</span>
                  {not.type === "COMMENT" ? "respondió a tu publicación" : not.content}
                  <span className="font-semibold text-neutral-200 ml-1">"{not.targetTitle}"</span>
                </div>
                {not.type === "COMMENT" && (
                  <p className="text-xs text-neutral-400 font-light border-l-2 border-neutral-850 pl-3 py-1 my-1 italic leading-relaxed">
                    "{not.content}"
                  </p>
                )}
                <span className="text-[10px] text-neutral-600 mt-0.5">{not.time}</span>
              </div>

              {!not.isRead && (
                <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 self-center" />
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
