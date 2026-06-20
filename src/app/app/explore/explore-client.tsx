"use client";

import React, { useState } from "react";
import { CommunityCard } from "@/components/shared/community-card";
import { Search, Compass, Grid, Laptop, BookOpen, Inbox, Plus } from "lucide-react";
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
}

export default function ExploreClient({
  initialCommunities = [],
}: {
  initialCommunities?: CommunityData[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");

  const categories = [
    { name: "Todos", icon: Grid },
    { name: "Tecnología", icon: Laptop },
    { name: "Diseño", icon: Compass },
    { name: "Recursos", icon: BookOpen },
  ];

  // Filtros heurísticos locales según palabras clave en slug y descripción
  const filteredCommunities = (initialCommunities || []).filter((comm) => {
    const matchesSearch =
      comm.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comm.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (comm.description || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeCategory === "Todos") return true;

    if (activeCategory === "Tecnología") {
      const keys = ["tech", "dev", "ia", "artificial", "model", "llm", "desarrollo", "nextjs", "db", "drizzle", "react", "código", "programacion"];
      return keys.some(k => comm.slug.includes(k) || (comm.description || "").toLowerCase().includes(k));
    }
    if (activeCategory === "Diseño") {
      const keys = ["diseno", "design", "ux", "ui", "tipografía", "interfaz", "interacciones", "estética", "visual"];
      return keys.some(k => comm.slug.includes(k) || (comm.description || "").toLowerCase().includes(k));
    }
    if (activeCategory === "Recursos") {
      const keys = ["finanzas", "recursos", "inversión", "ahorro", "libro", "guía", "tutorial", "e-commerce"];
      return keys.some(k => comm.slug.includes(k) || (comm.description || "").toLowerCase().includes(k));
    }
    return true;
  });

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8 text-left">
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

      {/* Barra de búsqueda premium */}
      <div className="relative w-full max-w-lg">
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

      {/* Grid de Comunidades */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
          {filteredCommunities.map((community) => (
            <CommunityCard key={community.id} {...community} />
          ))}
        </div>
      )}
    </div>
  );
}
