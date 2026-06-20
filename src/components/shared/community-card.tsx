"use client";

import React, { useState } from "react";
import { Users, Globe, Lock, ShieldAlert, ChevronRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toggleJoinCommunityAction } from "@/app/actions/communities";

export interface CommunityCardProps {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  logoUrl?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  privacyType: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  membersCount: number;
  isJoined?: boolean;
  membershipStatus?: "APPROVED" | "PENDING" | "BANNED" | null;
  category?: string | null;
}

export function CommunityCard({
  id,
  slug,
  displayName,
  description,
  logoUrl,
  avatarUrl,
  bannerUrl,
  privacyType,
  membersCount: initialMembers,
  isJoined: initialJoined = false,
  membershipStatus: initialStatus = null,
  category,
}: CommunityCardProps) {
  const [isJoined, setIsJoined] = useState(initialJoined);
  const [status, setStatus] = useState<"APPROVED" | "PENDING" | "BANNED" | null>(initialStatus);
  const [members, setMembers] = useState(initialMembers);
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLoading || (privacyType === "INVITE_ONLY" && !isJoined)) return;

    setIsLoading(true);
    try {
      const res = await toggleJoinCommunityAction(id);
      if (res.success) {
        // En base a la respuesta del servidor actualizamos estado local
        setIsJoined(res.joined || false);
        setStatus((res.status as "APPROVED" | "PENDING" | "BANNED" | null) || null);
        
        // Ajustar contador local de miembros
        if (res.joined) {
          setMembers((prev) => prev + 1);
        } else if (res.joined === false && status === "APPROVED") {
          setMembers((prev) => Math.max(0, prev - 1));
        }
      } else {
        alert(res.error || "No se pudo cambiar el estado de membresía.");
      }
    } catch (error) {
      console.error("Error en toggleJoinCommunityAction:", error);
      alert("Ocurrió un error inesperado al intentar unirse.");
    } finally {
      setIsLoading(false);
    }
  };

  const getPrivacyIcon = () => {
    switch (privacyType) {
      case "PUBLIC":
        return <Globe className="h-3 w-3" />;
      case "PRIVATE":
        return <Lock className="h-3 w-3" />;
      case "INVITE_ONLY":
        return <ShieldAlert className="h-3 w-3" />;
    }
  };

  const getPrivacyText = () => {
    switch (privacyType) {
      case "PUBLIC":
        return "Público";
      case "PRIVATE":
        return "Privado";
      case "INVITE_ONLY":
        return "Sólo Invitación";
    }
  };

  const getButtonText = () => {
    if (isLoading) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (isJoined) return "Abandonar";
    if (status === "PENDING") {
      return privacyType === "PRIVATE" ? "Cancelar" : "Pendiente";
    }
    if (privacyType === "PRIVATE") return "Solicitar";
    if (privacyType === "INVITE_ONLY") return "Solo invitación";
    return "Unirse";
  };

  const isButtonDisabled = isLoading || status === "BANNED" || (privacyType === "INVITE_ONLY" && !isJoined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group p-5 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md hover:border-neutral-800/80 hover:bg-neutral-950/60 transition-all duration-300 flex flex-col justify-between gap-4 text-left shadow-sm shadow-black/10"
    >
      {/* Header Info */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {avatarUrl || logoUrl ? (
            <img
              src={avatarUrl || logoUrl || undefined}
              alt={displayName}
              className="h-10 w-10 rounded-full border border-neutral-800 object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center text-sm font-semibold text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold text-neutral-100 group-hover:text-white transition-colors">
              {displayName}
            </h3>
            <span className="text-[11px] text-neutral-500">r/{slug}</span>
          </div>
        </div>

        {/* Join button */}
        <button
          onClick={handleJoinToggle}
          disabled={isButtonDisabled}
          className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all cursor-pointer min-w-[84px] shrink-0 flex items-center justify-center ${
            status === "PENDING"
              ? "bg-neutral-900 border border-neutral-850 text-neutral-500 hover:text-neutral-400"
              : isJoined
              ? "bg-neutral-900 border border-neutral-800 text-red-450 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/50"
              : privacyType === "INVITE_ONLY"
              ? "bg-neutral-900/50 border border-neutral-900 text-neutral-600 cursor-not-allowed"
              : "bg-white text-neutral-950 hover:bg-neutral-200"
          } disabled:opacity-50`}
        >
          {getButtonText()}
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-neutral-400 font-light leading-relaxed line-clamp-2 min-h-[32px]">
        {description || "Sin descripción proporcionada."}
      </p>

      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-neutral-900/60 pt-3 text-[10px] text-neutral-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-neutral-600" />
            <span>{members}</span>
          </span>
          <span className="flex items-center gap-1.5">
            {getPrivacyIcon()}
            <span>{getPrivacyText()}</span>
          </span>
          {category && (
            <span className="inline-flex items-center rounded-full bg-neutral-900 px-2.5 py-0.5 text-[9px] font-medium text-neutral-400 border border-neutral-850">
              {category}
            </span>
          )}
        </div>

        <a
          href={`/app/r/${slug}`}
          className="inline-flex items-center gap-0.5 text-neutral-400 hover:text-white transition-colors text-xs font-medium cursor-pointer"
        >
          <span>Ir</span>
          <ChevronRight className="h-3 w-3" />
        </a>
      </div>
    </motion.div>
  );
}
