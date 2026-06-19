"use client";

import React, { useState, useEffect } from "react";
import { PostCard } from "@/components/shared/post-card";
import { CommunityCard } from "@/components/shared/community-card";
import { FeedSkeleton } from "@/components/shared/skeletons";
import { Sparkles, TrendingUp, Award, Plus, Check } from "lucide-react";
import { motion } from "framer-motion";

export default function AppDashboard() {
  const [loading, setLoading] = useState(true);

  // Simulate loading state for skeletons test
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const mockPosts = [
    {
      id: "post_1",
      title: "Diseñando interfaces al estilo Apple: El arte de la sutileza",
      content: "El secreto de la estética de Apple radica en el uso de espacios en blanco amplios, gradientes de opacidad muy baja y bordes que apenas se perciben. En esta guía repasamos cómo estructurar un sistema de diseño minimalista con variables de Tailwind v4 y sombras difuminadas.",
      communitySlug: "diseno",
      communityName: "Diseño y UX",
      authorId: "user_mock_1",
      authorName: "Adrián Silva",
      authorAvatar: "",
      category: "Guía",
      tags: ["Design", "Tailwind", "UX"],
      createdAt: "Hace 2 horas",
      upvotesCount: 42,
      commentsCount: 8,
      hasAcceptedAnswer: true,
      attachments: [
        {
          id: "att_1",
          fileName: "apple_design_guide.pdf",
          mimeType: "application/pdf",
          fileUrl: "#",
        },
      ],
      postType: "DISCUSSION" as const,
      status: "ACTIVE" as const,
    },
    {
      id: "post_2",
      title: "Integración nativa de modelos Gemini en Next.js 15+",
      content: "Les comparto un componente React Server Component optimizado para realizar streaming directo de respuestas de texto desde la API de Gemini 2.5 Flash, sin necesidad de dependencias complejas ni frameworks pesados de terceros.",
      communitySlug: "desarrollo",
      communityName: "Desarrollo Web",
      authorId: "user_mock_2",
      authorName: "Elena Rostova",
      authorAvatar: "",
      category: "Recurso",
      tags: ["Next.js", "AI", "Gemini"],
      createdAt: "Hace 4 horas",
      upvotesCount: 29,
      commentsCount: 3,
      hasAcceptedAnswer: false,
      attachments: [
        {
          id: "att_2",
          fileName: "gemini_stream.tsx",
          mimeType: "text/javascript",
          fileUrl: "#",
        },
      ],
      postType: "RESOURCE" as const,
      status: "ACTIVE" as const,
    },
  ];

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
  ];

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
      {/* Grid de 2 columnas: Contenido principal y panel lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA PRINCIPAL: Feed de Publicaciones */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Encabezado del Feed */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
              Tu Feed
            </h1>
            
            <button className="inline-flex items-center gap-1.5 rounded-full bg-white text-neutral-950 px-4 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md shadow-white/5">
              <Plus className="h-4 w-4" />
              <span>Publicar</span>
            </button>
          </div>

          {/* Lista de posts con estados de carga */}
          {loading ? (
            <FeedSkeleton />
          ) : (
            <div className="space-y-6">
              {mockPosts.map((post) => (
                <PostCard key={post.id} {...post} />
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA LATERAL (Desktop only) */}
        <div className="hidden lg:flex flex-col gap-8">
          
          {/* Tarjeta de Reputación Premium */}
          <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4 text-left">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white">
                <Award className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-200">Tu Reputación</h3>
                <span className="text-[10px] text-neutral-500">Nivel 2 de Experto</span>
              </div>
            </div>

            <div className="flex items-end gap-2 mt-1">
              <span className="text-2xl font-semibold tracking-tight text-white">120</span>
              <span className="text-[11px] text-neutral-500 mb-1">puntos totales</span>
            </div>

            {/* Progreso del nivel */}
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="h-1.5 w-full bg-neutral-900 rounded-full overflow-hidden">
                <div className="h-full w-[48%] bg-white rounded-full" />
              </div>
              <div className="flex justify-between text-[9px] text-neutral-500">
                <span>100 pts (Lvl 2)</span>
                <span>250 pts (Lvl 3)</span>
              </div>
            </div>
          </div>

          {/* Comunidades Recomendadas */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-neutral-400" />
              <h3 className="text-sm font-semibold text-neutral-200">Comunidades Destacadas</h3>
            </div>

            <div className="space-y-4">
              {mockCommunities.map((community) => (
                <CommunityCard key={community.id} {...community} />
              ))}
            </div>
          </div>

          {/* Reglas de la comunidad / Tip del día */}
          <div className="p-6 rounded-3xl border border-neutral-900/40 bg-neutral-950/20 text-left flex flex-col gap-2">
            <h4 className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-400" />
              Consejo de moderación
            </h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed font-light">
              Respeta las directrices del sistema de reputación. Marcar la respuesta aceptada en tus dudas ayuda a los expertos a ganar visibilidad y puntos.
            </p>
          </div>
          
        </div>

      </div>
    </div>
  );
}
