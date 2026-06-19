"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { toggleJoinCommunityAction } from "@/app/actions/communities";
import { useRouter } from "next/navigation";

interface JoinButtonProps {
  communityId: string;
  initialIsJoined: boolean;
  initialStatus: "APPROVED" | "PENDING" | "BANNED" | null;
}

export default function JoinButton({
  communityId,
  initialIsJoined,
  initialStatus,
}: JoinButtonProps) {
  const router = useRouter();
  const [isJoined, setIsJoined] = useState(initialIsJoined);
  const [status, setStatus] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (isLoading || status === "BANNED") return;

    setIsLoading(true);
    try {
      const res = await toggleJoinCommunityAction(communityId);
      if (res.success) {
        setIsJoined(res.joined || false);
        setStatus((res.status as "APPROVED" | "PENDING" | "BANNED" | null) || null);
        router.refresh(); // Refrescar los Server Components para actualizar contadores/permisos
      } else {
        alert(res.error || "No se pudo cambiar el estado de membresía.");
      }
    } catch (error) {
      console.error("Error al unirse/salir:", error);
      alert("Ocurrió un error inesperado. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonText = () => {
    if (isLoading) return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (status === "PENDING") return "Solicitud Pendiente";
    if (isJoined) return "Abandonar Comunidad";
    return "Unirse a la Comunidad";
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading || status === "BANNED"}
      className={`rounded-full px-5 py-2.5 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center min-w-[130px] border shadow-sm ${
        status === "PENDING"
          ? "bg-neutral-900 border-neutral-850 text-neutral-500 hover:text-neutral-400"
          : isJoined
          ? "bg-neutral-950 border-neutral-900 text-neutral-400 hover:bg-neutral-900 hover:text-white"
          : "bg-white border-white text-neutral-950 hover:bg-neutral-200"
      } disabled:opacity-50`}
    >
      {getButtonText()}
    </button>
  );
}
