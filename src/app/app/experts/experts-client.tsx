"use client";

import React, { useState } from "react";
import { Award, Sparkles, User, Inbox, Flame, TrendingUp, Filter, Check, UserPlus } from "lucide-react";
import Link from "next/link";
import { getUserLevel, getLevelBadge, getLevelColor } from "@/lib/reputation-rules";
import { followUserAction, unfollowUserAction } from "@/app/actions/follows";

interface ExpertData {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  score: number;
  level: number | null;
  interests: string[];
  isExpert: boolean;
  isFollowing?: boolean;
}

interface ExpertsClientProps {
  globalRanking: ExpertData[];
  weeklyRanking: ExpertData[];
  monthlyRanking: ExpertData[];
  currentUserId?: string | null;
}

const INTERESTS = [
  { id: "all", label: "Todos los temas" },
  { id: "IA", label: "Inteligencia Artificial" },
  { id: "Desarrollo", label: "Desarrollo" },
  { id: "Marketing", label: "Marketing" },
  { id: "Negocios", label: "Negocios" },
  { id: "Diseño", label: "Diseño" },
  { id: "Finanzas", label: "Finanzas" }
];

export function ExpertsClient({
  globalRanking,
  weeklyRanking,
  monthlyRanking,
  currentUserId
}: ExpertsClientProps) {
  const [timeframe, setTimeframe] = useState<"global" | "weekly" | "monthly">("global");
  const [selectedInterest, setSelectedInterest] = useState<string>("all");

  const [followedIds, setFollowedIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const processItem = (e: ExpertData) => {
      if (e.isFollowing) initial[e.userId] = true;
    };
    globalRanking.forEach(processItem);
    weeklyRanking.forEach(processItem);
    monthlyRanking.forEach(processItem);
    return initial;
  });

  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});

  const handleFollowToggle = async (userId: string) => {
    if (pendingIds[userId]) return;
    setPendingIds((prev) => ({ ...prev, [userId]: true }));
    const isCurrentlyFollowing = !!followedIds[userId];
    try {
      if (isCurrentlyFollowing) {
        const res = await unfollowUserAction(userId);
        if (res.success) {
          setFollowedIds((prev) => ({ ...prev, [userId]: false }));
        }
      } else {
        const res = await followUserAction(userId);
        if (res.success) {
          setFollowedIds((prev) => ({ ...prev, [userId]: true }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPendingIds((prev) => ({ ...prev, [userId]: false }));
    }
  };

  // Obtener ranking actual según la pestaña
  const currentRanking = 
    timeframe === "global" 
      ? globalRanking 
      : timeframe === "weekly" 
      ? weeklyRanking 
      : monthlyRanking;

  // Filtrar según el interés seleccionado
  const filteredRanking = currentRanking.filter((expert) => {
    if (selectedInterest === "all") return true;
    return expert.interests && expert.interests.some(
      (interest) => interest.toLowerCase() === selectedInterest.toLowerCase()
    );
  });

  // Dividir en Top 3 (Podium) y el resto
  const podium = filteredRanking.slice(0, 3);
  const remaining = filteredRanking.slice(3);

  // Mapeo de estilos para el podium
  const podiumStyles = [
    {
      borderColor: "border-amber-400/50",
      bgGlow: "bg-amber-400/5",
      badgeColor: "bg-amber-400 text-neutral-950",
      shadow: "shadow-amber-500/10",
      rankSymbol: "🥇",
      title: "1er Lugar"
    },
    {
      borderColor: "border-neutral-300/50",
      bgGlow: "bg-neutral-300/5",
      badgeColor: "bg-neutral-300 text-neutral-950",
      shadow: "shadow-neutral-400/10",
      rankSymbol: "🥈",
      title: "2do Lugar"
    },
    {
      borderColor: "border-amber-700/50",
      bgGlow: "bg-amber-700/5",
      badgeColor: "bg-amber-700 text-white",
      shadow: "shadow-amber-800/10",
      rankSymbol: "🥉",
      title: "3er Lugar"
    }
  ];

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8 text-left">
      
      {/* Header */}
      <div className="flex flex-col gap-2 relative">
        <div className="absolute top-[-50px] right-[-100px] w-96 h-96 bg-blue-900/10 rounded-full blur-[120px] pointer-events-none" />
        <h1 className="text-2xl font-heading font-semibold text-white tracking-tight flex items-center gap-2.5">
          <Award className="h-7 w-7 text-blue-400" />
          Líderes y Expertos de Consejos
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed max-w-2xl">
          Conoce a los miembros más activos y con mayor reputación. Ayuda respondiendo dudas o compartiendo recursos valiosos para ganar tu lugar en el ranking.
        </p>
      </div>

      {/* Selectores de Período y Filtros */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-neutral-900 pb-4">
        
        {/* Timeframe Tabs */}
        <div className="flex rounded-full bg-neutral-950 border border-neutral-900 p-1">
          <button
            onClick={() => setTimeframe("global")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              timeframe === "global"
                ? "bg-white text-neutral-950 shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Histórico Global
          </button>
          <button
            onClick={() => setTimeframe("monthly")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              timeframe === "monthly"
                ? "bg-white text-neutral-950 shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setTimeframe("weekly")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              timeframe === "weekly"
                ? "bg-white text-neutral-950 shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Semanal
          </button>
        </div>

        {/* Interests dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
          <select
            value={selectedInterest}
            onChange={(e) => setSelectedInterest(e.target.value)}
            className="w-full md:w-48 bg-neutral-950 border border-neutral-900 rounded-full px-4 py-2 text-xs font-semibold text-neutral-300 focus:outline-none focus:border-neutral-800 cursor-pointer"
          >
            {INTERESTS.map((interest) => (
              <option key={interest.id} value={interest.id}>
                {interest.label}
              </option>
            ))}
          </select>
        </div>

      </div>

      {/* Condición: Ranking vacío */}
      {filteredRanking.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20 px-6">
          <Inbox className="h-10 w-10 text-neutral-700 mb-4" />
          <h3 className="text-sm font-semibold text-neutral-300">No hay expertos en este ranking</h3>
          <p className="text-xs text-neutral-500 max-w-sm mt-1 font-light leading-relaxed">
            Ningún miembro cumple con reputación registrada en este tema y período de tiempo actualmente.
          </p>
        </div>
      ) : (
        <>
          {/* 1. Podio de Ganadores (Top 3) */}
          {podium.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* Renderizar en orden: 2do Lugar (Izquierda), 1er Lugar (Centro), 3er Lugar (Derecha) en desktop */}
              {(() => {
                const order = [];
                if (podium[1]) order.push({ data: podium[1], index: 1 });
                if (podium[0]) order.push({ data: podium[0], index: 0 });
                if (podium[2]) order.push({ data: podium[2], index: 2 });
                
                const itemsToRender = mdMatches() ? order : podium.map((p, idx) => ({ data: p, index: idx }));

                return itemsToRender.map(({ data, index }) => {
                  const style = podiumStyles[index];
                  const pointsLabel = timeframe === "global" ? "pts totales" : "pts recientes";
                  
                  return (
                    <div
                      key={data.userId}
                      className={`relative p-6 rounded-3xl border ${style.borderColor} ${style.bgGlow} shadow-lg ${style.shadow} flex flex-col items-center text-center gap-4 transition-all duration-300 hover:scale-[1.02] ${
                        index === 0 ? "md:pb-10 md:pt-8" : "md:pb-6"
                      }`}
                    >
                      {/* Rank Tag */}
                      <span className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase ${style.badgeColor}`}>
                        {style.rankSymbol} {style.title}
                      </span>

                      {/* Avatar */}
                      <Link href={`/app/profile/${data.username}`} className="mt-2 shrink-0">
                        {data.avatarUrl ? (
                          <img
                            src={data.avatarUrl}
                            alt={data.displayName}
                            className={`rounded-2xl border object-cover shadow-md ${
                              index === 0 
                                ? "h-16 w-16 md:h-20 md:w-20 border-amber-400/30" 
                                : index === 1 
                                ? "h-14 w-14 md:h-16 md:w-16 border-neutral-350/30" 
                                : "h-14 w-14 border-amber-700/30"
                            }`}
                          />
                        ) : (
                          <div className={`rounded-2xl border bg-neutral-900 flex items-center justify-center font-bold text-white shadow-md ${
                            index === 0 
                              ? "h-16 w-16 md:h-20 md:w-20 text-3xl border-amber-400/30" 
                              : index === 1 
                              ? "h-14 w-14 md:h-16 md:w-16 text-2xl border-neutral-350/30" 
                              : "h-14 w-14 text-2xl border-amber-700/30"
                          }`}>
                            {data.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </Link>

                      {/* Name / User */}
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/app/profile/${data.username}`}
                          className="text-base font-semibold text-white hover:underline flex items-center justify-center gap-1"
                        >
                          <span>{data.displayName}</span>
                          {data.isExpert && <Sparkles className="h-3 w-3 text-blue-400 shrink-0" />}
                        </Link>
                        <span className="text-[10px] text-neutral-500 font-mono">@{data.username}</span>
                      </div>

                      {/* Level and Score */}
                      <div className="flex flex-col items-center gap-1 bg-neutral-950/60 border border-neutral-900 rounded-2xl px-4 py-2 w-full">
                        <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${getLevelColor(data.score)}`}>
                          {getLevelBadge(data.score)} {getUserLevel(data.score)}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-semibold text-white font-mono">{data.score.toLocaleString()}</span>
                          <span className="text-[9px] text-neutral-500">{pointsLabel}</span>
                        </div>
                      </div>

                      {/* Follow/Unfollow Button */}
                      {currentUserId && currentUserId !== data.userId && (
                        <button
                          onClick={() => handleFollowToggle(data.userId)}
                          disabled={pendingIds[data.userId]}
                          className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            followedIds[data.userId]
                              ? "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-red-950/20 hover:border-red-900/40 hover:text-red-400"
                              : "bg-white text-neutral-950 hover:bg-neutral-200"
                          }`}
                        >
                          {pendingIds[data.userId] ? (
                            <span className="h-2.5 w-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : followedIds[data.userId] ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Siguiendo</span>
                            </>
                          ) : (
                            <>
                              <UserPlus className="h-3 w-3" />
                              <span>Seguir</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Bio */}
                      <p className="text-xs text-neutral-450 leading-relaxed font-light line-clamp-2 h-8">
                        {data.bio || "Miembro activo de la comunidad."}
                      </p>

                      {/* Interests Tags */}
                      {data.interests && data.interests.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center mt-1">
                          {data.interests.slice(0, 3).map((interest) => (
                            <span
                              key={interest}
                              className="text-[9px] text-neutral-400 bg-neutral-900/60 border border-neutral-850 px-2 py-0.5 rounded-full font-light"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}

          {/* 2. Grid del Resto de Expertos (Rango 4+) */}
          {remaining.length > 0 && (
            <div className="flex flex-col gap-4 mt-4">
              <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-neutral-400" />
                <span>Otros colaboradores líderes</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {remaining.map((expert, idx) => {
                  const rank = idx + 4;
                  return (
                    <div
                      key={expert.userId}
                      className="p-5 rounded-2xl border border-neutral-900 bg-neutral-950/30 hover:border-neutral-850 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Rank */}
                        <span className="text-sm font-semibold text-neutral-500 font-mono w-6 text-center">
                          #{rank}
                        </span>

                        {/* Avatar */}
                        <Link href={`/app/profile/${expert.username}`} className="shrink-0">
                          {expert.avatarUrl ? (
                            <img
                              src={expert.avatarUrl}
                              alt={expert.displayName}
                              className="h-10 w-10 rounded-xl border border-neutral-850 object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-xl border border-neutral-850 bg-neutral-900 flex items-center justify-center text-sm font-bold text-white">
                              {expert.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </Link>

                        {/* Name Info */}
                        <div className="flex flex-col min-w-0">
                          <Link
                            href={`/app/profile/${expert.username}`}
                            className="text-xs sm:text-sm font-semibold text-neutral-200 hover:underline truncate flex items-center gap-1"
                          >
                            <span>{expert.displayName}</span>
                            {expert.isExpert && <Sparkles className="h-2.5 w-2.5 text-blue-400" />}
                          </Link>
                          <span className="text-[10px] text-neutral-500 font-mono">@{expert.username}</span>
                        </div>
                      </div>

                      {/* Social Actions & Score */}
                      <div className="flex items-center gap-3 shrink-0">
                        {currentUserId && currentUserId !== expert.userId && (
                          <button
                            onClick={() => handleFollowToggle(expert.userId)}
                            disabled={pendingIds[expert.userId]}
                            className={`px-3 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                              followedIds[expert.userId]
                                ? "bg-neutral-900 border border-neutral-850 text-neutral-350 hover:bg-red-950/20 hover:border-red-900/40 hover:text-red-400"
                                : "bg-white text-neutral-950 hover:bg-neutral-200"
                            }`}
                          >
                            {pendingIds[expert.userId] ? (
                              <span className="h-2.5 w-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : followedIds[expert.userId] ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>Siguiendo</span>
                              </>
                            ) : (
                              <>
                                <UserPlus className="h-3 w-3" />
                                <span>Seguir</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Rep / Level */}
                        <div className="text-right flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-white font-mono">
                            {expert.score.toLocaleString()} pts
                          </span>
                          <span className={`text-[9px] font-medium ${getLevelColor(expert.score)}`}>
                            {getLevelBadge(expert.score)} {getUserLevel(expert.score)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}

function mdMatches() {
  if (typeof window !== "undefined") {
    return window.innerWidth >= 768;
  }
  return true;
}
