"use client";

import React, { useState } from "react";
import { CommunityCard } from "@/components/shared/community-card";
import { Search, Compass, Grid, Laptop, BookOpen, Inbox, Plus, Sparkles, Award, Flame, Users } from "lucide-react";
import Link from "next/link";

interface CommunityData {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  privacyType: "PUBLIC" | "PRIVATE" | "INVITE_ONLY";
  membersCount: number;
  isJoined: boolean;
  membershipStatus: "APPROVED" | "PENDING" | "BANNED" | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  category?: string | null;
}

interface LeaderboardItem {
  id: string;
  displayName: string;
  slug: string;
  avatarUrl: string | null;
  count: number;
}

interface ExploreClientProps {
  initialCommunities?: CommunityData[];
  showPreferencesCTA?: boolean;
  topMembers?: LeaderboardItem[];
  topActivity?: LeaderboardItem[];
  topReputation?: LeaderboardItem[];
}

export default function ExploreClient({
  initialCommunities = [],
  showPreferencesCTA = false,
  topMembers = [],
  topActivity = [],
  topReputation = [],
}: ExploreClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");

  const categories = [
    { name: "Todos", icon: Grid },
    { name: "Tecnología", icon: Laptop },
    { name: "Diseño", icon: Compass },
    { name: "Recursos", icon: BookOpen },
  ];

  // Filtros heurísticos locales según palabras clave en slug, descripción y categoría real
  const filteredCommunities = (initialCommunities || []).filter((comm) => {
    const matchesSearch =
      comm.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.category || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeCategory === "Todos") return true;

    const commCategoryLower = (comm.category || "").toLowerCase();

    if (activeCategory === "Tecnología") {
      if (commCategoryLower.includes("desarrollo") || commCategoryLower.includes("ia") || commCategoryLower.includes("tech") || commCategoryLower.includes("web") || commCategoryLower.includes("model")) {
        return true;
      }
      const keys = ["tech", "dev", "ia", "artificial", "model", "llm", "desarrollo", "nextjs", "db", "drizzle", "react", "código", "programacion"];
      return keys.some(k => comm.slug.includes(k) || (comm.description || "").toLowerCase().includes(k));
    }
    if (activeCategory === "Diseño") {
      if (commCategoryLower.includes("diseño") || commCategoryLower.includes("design") || commCategoryLower.includes("creatividad") || commCategoryLower.includes("ux") || commCategoryLower.includes("ui")) {
        return true;
      }
      const keys = ["diseno", "design", "ux", "ui", "tipografía", "interfaz", "interacciones", "estética", "visual"];
      return keys.some(k => comm.slug.includes(k) || (comm.description || "").toLowerCase().includes(k));
    }
    if (activeCategory === "Recursos") {
      if (commCategoryLower.includes("recursos") || commCategoryLower.includes("negocios") || commCategoryLower.includes("finanzas") || commCategoryLower.includes("legal") || commCategoryLower.includes("productividad")) {
        return true;
      }
      const keys = ["finanzas", "recursos", "inversión", "ahorro", "libro", "guía", "tutorial", "e-commerce"];
      return keys.some(k => comm.slug.includes(k) || (comm.description || "").toLowerCase().includes(k));
    }
    return true;
  });

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8 text-left">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
            Explorar
          </h1>
          <p className="text-sm text-neutral-400 font-light leading-relaxed">
            Descubre nuevos espacios de conocimiento y únete a discusiones del más alto nivel.
          </p>
        </div>

        <Link
          href="/app/communities/new"
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white text-neutral-950 px-4 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md shadow-white/5 self-start sm:self-center"
        >
          <Plus className="h-4 w-4" />
          <span>Crear Comunidad</span>
        </Link>
      </div>

      {showPreferencesCTA && (
        <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-left">
            <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Recomendaciones Personalizadas
            </span>
            <span className="text-[11px] text-neutral-400 font-light leading-relaxed">
              Completa tus preferencias e intereses en los Ajustes para recomendarte las comunidades más relevantes para ti.
            </span>
          </div>
          <Link
            href="/app/settings"
            className="rounded-full bg-white text-neutral-950 px-4 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer text-center shrink-0"
          >
            Completar Preferencias
          </Link>
        </div>
      )}

      {/* Grid General con Columnas (Comunidades + Sidebar Rankings) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA PRINCIPAL */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Barra de búsqueda premium */}
          <div className="relative w-full">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar comunidades, temas o etiquetas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
            />
          </div>

          {/* Categorías (Tags) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat.name
                    ? "bg-white border-white text-neutral-950"
                    : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:text-white hover:border-neutral-800"
                }`}
              >
                <cat.icon className="h-3.5 w-3.5" />
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Listado de Comunidades */}
          {filteredCommunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-neutral-900 rounded-3xl bg-neutral-950/20">
              <Inbox className="h-10 w-10 text-neutral-700 mb-4" />
              <h3 className="text-sm font-semibold text-neutral-300">Sin comunidades</h3>
              <p className="text-xs text-neutral-500 max-w-sm mt-1 font-light leading-relaxed">
                {searchQuery 
                  ? "No encontramos ninguna comunidad que coincida con tu búsqueda. Intenta con otros términos."
                  : "Aún no hay comunidades en esta sección. ¡Sé el primero en crear una!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filteredCommunities.map((community) => (
                <CommunityCard key={community.id} {...community} />
              ))}
            </div>
          )}

        </div>

        {/* COLUMNA LATERAL (Sidebar Rankings) */}
        <div className="flex flex-col gap-8">
          
          {/* Top Reputación */}
          <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-400" />
              <span>Top Reputación</span>
            </h3>
            <div className="flex flex-col gap-3">
              {topReputation.length === 0 ? (
                <span className="text-[11px] text-neutral-550 italic font-light">Sin datos suficientes.</span>
              ) : (
                topReputation.map((comm, idx) => (
                  <LeaderboardRow key={comm.id} rank={idx + 1} item={comm} suffix="pts acum." />
                ))
              )}
            </div>
          </div>

          {/* Top Actividad */}
          <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-400" />
              <span>Top Actividad</span>
            </h3>
            <div className="flex flex-col gap-3">
              {topActivity.length === 0 ? (
                <span className="text-[11px] text-neutral-550 italic font-light">Sin datos suficientes.</span>
              ) : (
                topActivity.map((comm, idx) => (
                  <LeaderboardRow key={comm.id} rank={idx + 1} item={comm} suffix="aportes" />
                ))
              )}
            </div>
          </div>

          {/* Top Miembros */}
          <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
            <h3 className="text-xs font-semibold text-neutral-400 tracking-wider uppercase border-b border-neutral-900 pb-3 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-blue-400" />
              <span>Top Miembros</span>
            </h3>
            <div className="flex flex-col gap-3">
              {topMembers.length === 0 ? (
                <span className="text-[11px] text-neutral-550 italic font-light">Sin datos suficientes.</span>
              ) : (
                topMembers.map((comm, idx) => (
                  <LeaderboardRow key={comm.id} rank={idx + 1} item={comm} suffix="miembros" />
                ))
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

function LeaderboardRow({ rank, item, suffix }: { rank: number; item: LeaderboardItem; suffix: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs py-1 hover:bg-neutral-900/10 rounded-lg transition-all px-1">
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Rank number */}
        <span className="font-mono text-neutral-500 font-semibold w-4 shrink-0">
          #{rank}
        </span>
        
        {/* Avatar */}
        {item.avatarUrl ? (
          <img
            src={item.avatarUrl}
            alt={item.displayName}
            className="h-6.5 w-6.5 rounded-lg border border-neutral-850 object-cover shrink-0"
          />
        ) : (
          <div className="h-6.5 w-6.5 rounded-lg border border-neutral-850 bg-neutral-900 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {item.displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Name */}
        <Link
          href={`/app/r/${item.slug}`}
          className="font-semibold text-neutral-300 hover:text-white truncate hover:underline"
        >
          r/{item.slug}
        </Link>
      </div>

      {/* Count */}
      <span className="font-mono text-[10px] text-neutral-400 shrink-0 font-medium bg-neutral-900/60 px-2 py-0.5 rounded-full border border-neutral-850">
        {item.count.toLocaleString()} {suffix}
      </span>
    </div>
  );
}
