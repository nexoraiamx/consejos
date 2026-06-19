"use client";

import React, { useState } from "react";
import { CommunityCard } from "@/components/shared/community-card";
import { Search, Compass, Grid, Laptop, BookOpen } from "lucide-react";

export default function ExplorePage() {
  const mockCommunities = [
    {
      id: "comm_1",
      slug: "diseno",
      displayName: "Diseño & UX",
      description: "Espacio premium para discutir tendencias, tipografías, interfaces y sistemas de diseño elegantes.",
      privacyType: "PUBLIC" as const,
      membersCount: 1240,
      isJoined: true,
    },
    {
      id: "comm_2",
      slug: "inteligencia-artificial",
      displayName: "Inteligencia Artificial",
      description: "Comunidad especializada en modelos de lenguaje, automatización de código y agentes autónomos.",
      privacyType: "INVITE_ONLY" as const,
      membersCount: 840,
      isJoined: false,
    },
    {
      id: "comm_3",
      slug: "desarrollo",
      displayName: "Desarrollo Web",
      description: "React, Next.js, Drizzle, bases de datos serverless y optimización de rendimiento a fondo.",
      privacyType: "PUBLIC" as const,
      membersCount: 2310,
      isJoined: false,
    },
    {
      id: "comm_4",
      slug: "finanzas",
      displayName: "Finanzas Personales",
      description: "Inversión, ahorro inteligente, e-commerce y criptomonedas para profesionales de tecnología.",
      privacyType: "PRIVATE" as const,
      membersCount: 420,
      isJoined: false,
    },
  ];

  const categories = [
    { name: "Todos", icon: Grid },
    { name: "Tecnología", icon: Laptop },
    { name: "Diseño", icon: Compass },
    { name: "Recursos", icon: BookOpen },
  ];

  const [activeCategory, setActiveCategory] = useState("Todos");

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-8 flex flex-col gap-8 text-left">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
          Explorar
        </h1>
        <p className="text-sm text-neutral-400 font-light leading-relaxed">
          Descubre nuevos espacios de conocimiento y únete a discusiones del más alto nivel.
        </p>
      </div>

      {/* Barra de búsqueda premium */}
      <div className="relative w-full max-w-lg">
        <Search className="absolute left-4 top-3.5 h-4 w-4 text-neutral-500" />
        <input
          type="text"
          placeholder="Buscar comunidades, temas o etiquetas..."
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        {mockCommunities.map((community) => (
          <CommunityCard key={community.id} {...community} />
        ))}
      </div>
    </div>
  );
}
