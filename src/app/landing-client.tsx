"use client";

import React, { useState, useEffect, useRef } from "react";
import { SignUpButton, Show } from "@clerk/nextjs";
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  Award, 
  Shield, 
  Bell, 
  ChevronRight, 
  Sparkles, 
  Code, 
  PenTool, 
  Rocket, 
  GraduationCap, 
  Briefcase, 
  Globe, 
  Lock, 
  ShieldAlert,
  ArrowRight,
  Database,
  CheckCircle2,
  HardDrive
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { CommunityCard } from "@/components/shared/community-card";

// Interface for community data passed from server component
interface FeaturedCommunity {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  privacyType: string;
  avatarUrl: string | null;
  category: string | null;
  membersCount: number;
}

// 1. Particle Background Canvas Component
function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }> = [];

    const particleCount = Math.min(50, Math.floor((width * height) / 30000));

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.2 + 0.4,
      });
    }

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
}

export default function LandingClient({
  isSignedIn,
  featuredCommunities = [],
}: {
  isSignedIn: boolean;
  featuredCommunities: FeaturedCommunity[];
}) {
  const [activeProfileTab, setActiveProfileTab] = useState("Desarrolladores");

  const targetProfiles = [
    {
      name: "Desarrolladores",
      icon: Code,
      subtitle: "Resuelve bugs complejos, comparte snippets de código y debate sobre arquitectura.",
      description: "Un espacio técnico libre de distracciones donde puedes adjuntar archivos de logs, fragmentos de código, y marcar la respuesta correcta para ganar puntos de reputación y destacar como experto.",
      tags: ["Markdown de código", "Q&A verificado", "Sin anuncios"],
    },
    {
      name: "Creativos",
      icon: PenTool,
      subtitle: "Comparte portafolios, recibe feedback de diseño y co-crea.",
      description: "Sube imágenes, videos y PDFs de tus proyectos creativos en alta resolución sin preocuparte por el límite de almacenamiento. Obtén feedback constructivo en foros de discusión especializados y ordenados.",
      tags: ["Feedback visual", "Calidad original", "Zero spam"],
    },
    {
      name: "Emprendedores",
      icon: Rocket,
      subtitle: "Valida ideas de negocio, comparte aprendizajes de growth y haz networking.",
      description: "Conéctate con otros fundadores, comparte casos de estudio reales, y haz preguntas de legal, finanzas o marketing a expertos certificados dentro de las comunidades.",
      tags: ["Casos de estudio", "Alianzas clave", "Expertos verificados"],
    },
    {
      name: "Comunidades Educativas",
      icon: GraduationCap,
      subtitle: "Crea espacios cerrados para tus alumnos, comparte material de estudio y debate.",
      description: "Configura comunidades bajo invitación o privadas para dar soporte a tus estudiantes. Comparte guías, PDFs o videos explicativos en una plataforma sobria y orientada a la educación.",
      tags: ["Material de soporte", "Grupos privados", "Acceso por invitación"],
    },
    {
      name: "Consultores y Expertos",
      icon: Briefcase,
      subtitle: "Monetiza tu conocimiento, asesora a clientes y construye reputación.",
      description: "Ayuda a resolver dudas complejas, acumula reputación en la plataforma y posiciónate como el referente principal en tu área de especialidad para atraer nuevas oportunidades.",
      tags: ["Liderazgo de opinión", "Badge de experto", "Leads calificados"],
    },
  ];

  const activeProfile = targetProfiles.find(p => p.name === activeProfileTab) || targetProfiles[0];

  return (
    <div className="relative w-full overflow-hidden bg-neutral-950 flex flex-col items-center">
      {/* 1. HERO SECTION */}
      <section className="relative w-full min-h-[90vh] flex flex-col items-center justify-center px-6 pt-24 pb-16 border-b border-neutral-900/60 z-10">
        <ParticlesBackground />
        
        {/* Glow Spheres */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] sm:h-[500px] sm:w-[500px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none z-0" />
        <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-purple-600/5 blur-[80px] pointer-events-none z-0" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-6 text-center">
          {/* Tagline Badge */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/40 px-4.5 py-1.5 text-xs text-neutral-400 backdrop-blur-md shadow-inner"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
            <span>Presentamos la plataforma de comunidades del futuro</span>
          </motion.div>

          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-heading font-semibold tracking-tight text-white leading-[1.12]"
          >
            Comunidades privadas y públicas <br className="hidden sm:inline" />
            <span className="text-neutral-400 font-sans italic font-normal">para aprender, compartir y resolver dudas</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl mx-auto text-sm sm:text-base text-neutral-400 font-light leading-relaxed mt-2"
          >
            La red de conocimiento para profesionales. Intercambia recursos de alto valor, resuelve dudas técnicas complejas y crea tu propio espacio de aprendizaje libre de distracciones y ruido publicitario.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 mt-4 z-20"
          >
            {isSignedIn ? (
              <Link
                href="/app"
                className="rounded-full bg-white text-neutral-950 px-7 py-3 text-sm font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-lg shadow-white/5 flex items-center gap-1.5"
              >
                <span>Ir al Panel de Control</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <SignUpButton mode="modal">
                <button className="rounded-full bg-white text-neutral-950 px-7 py-3 text-sm font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-lg shadow-white/5 flex items-center gap-1.5">
                  <span>Crear cuenta gratis</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </SignUpButton>
            )}

            <Link
              href={isSignedIn ? "/app/explore" : "/sign-in"}
              className="rounded-full bg-neutral-900 border border-neutral-850 text-neutral-300 hover:text-white hover:border-neutral-750 px-6 py-3 text-sm font-semibold transition-all cursor-pointer"
            >
              Explorar comunidades
            </Link>
          </motion.div>

          {/* APP CSS PRODUCT MOCKUP */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="w-full max-w-5xl mt-16 rounded-3xl border border-neutral-900 bg-neutral-950/60 p-2.5 backdrop-blur-md shadow-2xl shadow-black/85 relative overflow-hidden"
          >
            <div className="absolute -inset-px rounded-[22px] bg-gradient-to-b from-neutral-800/40 via-transparent to-transparent opacity-60" />
            
            {/* Mac style titlebar */}
            <div className="w-full h-8 rounded-t-[18px] bg-neutral-950 border-b border-neutral-900/60 flex items-center px-4 justify-between select-none">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-neutral-800" />
                <div className="h-3 w-3 rounded-full bg-neutral-800" />
                <div className="h-3 w-3 rounded-full bg-neutral-800" />
              </div>
              <div className="text-[10px] text-neutral-500 font-mono">consejos.app/r/desarrollo-web</div>
              <div className="w-12" />
            </div>

            {/* Mockup Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 bg-neutral-950/80 rounded-b-[18px] text-left">
              {/* Sidebar */}
              <div className="hidden md:flex flex-col gap-4 border-r border-neutral-900/60 pr-4 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-bold text-white">C</div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Desarrollo Web</h4>
                    <span className="text-[9px] text-neutral-500">r/desarrollo-web</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mt-2">
                  <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-wider">Menú</span>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-900/40 rounded-xl text-xs text-white border border-neutral-850">
                    <Globe className="h-3.5 w-3.5 text-blue-400" />
                    <span>Publicaciones</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-450 hover:text-white transition-all">
                    <Users className="h-3.5 w-3.5" />
                    <span>Miembros</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-450 hover:text-white transition-all">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Moderación</span>
                  </div>
                </div>
              </div>

              {/* Feed Content */}
              <div className="md:col-span-3 flex flex-col gap-4 py-2">
                {/* Simulated Post 1 (Question & Accepted Answer) */}
                <div className="p-4 rounded-2xl border border-neutral-900 bg-neutral-950/60 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <span className="font-semibold text-neutral-400">Adrián Silva</span>
                    <span>&bull;</span>
                    <span>Nivel 3 Experto</span>
                    <span>&bull;</span>
                    <span>Hace 1 hora</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">¿Cuál es la forma más limpia de revalidar caché en Next.js App Router?</h3>
                  <p className="text-xs text-neutral-400 line-clamp-2">
                    Estoy buscando alternativas a revalidatePath que no purguen toda la ruta de manera agresiva. ¿Se pueden usar tags específicos?
                  </p>
                  
                  {/* Accepted Answer Badge in Feed Mockup */}
                  <div className="mt-2 p-3 rounded-xl bg-blue-950/20 border border-blue-900/30 flex items-start gap-2.5">
                    <Award className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Respuesta Aceptada</span>
                      <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed">
                        {"Sí, usa `revalidateTag('mi-tag')` junto con `fetch(..., { next: { tags: ['mi-tag'] } })`. Esto purga únicamente la llamada exacta sin refrescar layouts pesados."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Simulated Post 2 (Resource post with S3 attachment) */}
                <div className="p-4 rounded-2xl border border-neutral-900 bg-neutral-950/60 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                    <span className="font-semibold text-neutral-400">Karla Mendoza</span>
                    <span>&bull;</span>
                    <span>Nivel 5 Experto</span>
                    <span>&bull;</span>
                    <span>Hace 3 horas</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white">Guía completa de auditoría LCP para Core Web Vitals</h3>
                  
                  {/* S3 Attachment Badge inside mockup */}
                  <div className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-850 px-3.5 py-2 text-xs text-neutral-300 self-start">
                    <HardDrive className="h-4 w-4 text-neutral-500" />
                    <span>lcp_performance_cheatsheet.pdf</span>
                    <span className="text-[10px] text-neutral-500">(1.4 MB)</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. CÓMO FUNCIONA */}
      <section className="w-full max-w-6xl mx-auto px-6 py-24 border-b border-neutral-900/60 text-center flex flex-col items-center gap-16">
        <div className="flex flex-col gap-3 max-w-2xl">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Flujo de Usuario</span>
          <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-white tracking-tight">
            Cómo funciona Consejos
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed">
            Hemos reducido la fricción al mínimo para que te enfoques únicamente en lo que importa: compartir y aprender.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full">
          {[
            {
              step: "01",
              title: "Crea tu perfil",
              desc: "Regístrate de forma segura con tu cuenta de Google o email a través de Clerk en un solo clic.",
            },
            {
              step: "02",
              title: "Define tus intereses",
              desc: "Selecciona las áreas y etiquetas en las que buscas resolver dudas o compartir conocimientos.",
            },
            {
              step: "03",
              title: "Únete a comunidades",
              desc: "Explora espacios temáticos públicos, solicita ingreso a los privados o accede por invitación.",
            },
            {
              step: "04",
              title: "Comparte y destaca",
              desc: "Publica dudas complejas, adjunta código y archivos, responde y gana reputación verídica.",
            },
          ].map((item, idx) => (
            <div key={idx} className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/20 text-left flex flex-col gap-4 hover:border-neutral-850 hover:bg-neutral-950/40 transition-all duration-300 group">
              <span className="text-sm font-mono font-bold text-neutral-700 group-hover:text-blue-500 transition-colors">
                {item.step}
              </span>
              <h3 className="text-sm font-semibold text-white">
                {item.title}
              </h3>
              <p className="text-xs text-neutral-450 leading-relaxed font-light">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. FEATURES */}
      <section className="w-full max-w-6xl mx-auto px-6 py-24 border-b border-neutral-900/60 flex flex-col items-center gap-16">
        <div className="flex flex-col gap-3 max-w-2xl text-center">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Características</span>
          <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-white tracking-tight">
            Diseñado para la calidad del contenido
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed">
            Adiós a los foros caóticos y los hilos interminables. Consejos está optimizado para preservar las respuestas correctas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {[
            {
              icon: Globe,
              title: "Privacidad Personalizada",
              desc: "Espacios de discusión Públicos para compartir abiertamente, Privados con solicitudes de ingreso manuales, y Solo Invitación para grupos cerrados.",
              color: "text-blue-400",
            },
            {
              icon: Award,
              title: "Respuestas Aceptadas",
              desc: "Quien publica una pregunta puede marcar la respuesta más útil. Esta se ancla arriba del hilo para facilitar la lectura futura.",
              color: "text-amber-400",
            },
            {
              icon: Sparkles,
              title: "Reputación de Expertos",
              desc: "Un sistema gamificado automático. Resuelve dudas y acumula reputación para ganar badges de autoridad dentro de tus áreas de interés.",
              color: "text-purple-400",
            },
            {
              icon: HardDrive,
              title: "Archivos sin Fricción",
              desc: "Sube imágenes, audios, fragmentos de código y PDFs grandes directo a Cloudflare R2 sin costes abusivos ni descargas restringidas.",
              color: "text-emerald-400",
            },
            {
              icon: Shield,
              title: "Moderación Distribuida",
              desc: "Los creadores de la comunidad asignan moderadores locales que pueden resolver denuncias, ocultar hilos y mantener las reglas del espacio.",
              color: "text-red-400",
            },
            {
              icon: Bell,
              title: "Notificaciones Inteligentes",
              desc: "Recibe avisos limpios sobre respuestas a tus aportaciones o aprobación de membresías de acceso directamente en la campana de tu panel.",
              color: "text-cyan-400",
            },
          ].map((feat, idx) => (
            <div key={idx} className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md text-left flex flex-col gap-4 hover:border-neutral-800 transition-all duration-300">
              <div className="h-9 w-9 rounded-xl bg-neutral-900 border border-neutral-800/80 flex items-center justify-center mb-1">
                <feat.icon className={`h-4.5 w-4.5 ${feat.color}`} />
              </div>
              <h3 className="text-sm font-semibold text-white">
                {feat.title}
              </h3>
              <p className="text-xs text-neutral-450 leading-relaxed font-light">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. PARA QUIÉN ES (INTERACTIVE TABS) */}
      <section className="w-full max-w-5xl mx-auto px-6 py-24 border-b border-neutral-900/60 flex flex-col items-center gap-12 text-center">
        <div className="flex flex-col gap-3 max-w-2xl">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider font-mono">Perfiles</span>
          <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-white tracking-tight">
            Para quién es Consejos
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed">
            Una plataforma moldeable al flujo de trabajo de distintos perfiles técnicos y creativos.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 border-b border-neutral-900 pb-4 w-full">
          {targetProfiles.map((profile) => (
            <button
              key={profile.name}
              onClick={() => setActiveProfileTab(profile.name)}
              className={`px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all flex items-center gap-2 ${
                activeProfileTab === profile.name
                  ? "bg-white text-neutral-950 font-bold"
                  : "bg-neutral-900/50 text-neutral-400 hover:text-white border border-neutral-850"
              }`}
            >
              <profile.icon className="h-3.5 w-3.5" />
              <span>{profile.name}</span>
            </button>
          ))}
        </div>

        {/* Tab Content Display */}
        <div className="w-full min-h-[160px] p-6 sm:p-8 rounded-3xl border border-neutral-900 bg-neutral-950/20 text-left flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeProfile.name}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-3"
            >
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <activeProfile.icon className="h-4 w-4 text-blue-400" />
                <span>{activeProfile.subtitle}</span>
              </h3>
              
              <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed font-light max-w-3xl">
                {activeProfile.description}
              </p>

              <div className="flex flex-wrap gap-2 mt-2">
                {activeProfile.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-full bg-neutral-900 border border-neutral-850 px-2.5 py-0.5 text-[10px] font-medium text-neutral-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* 5. PREVIEW DE COMUNIDADES DESTACADAS */}
      {featuredCommunities.length > 0 && (
        <section className="w-full max-w-6xl mx-auto px-6 py-24 border-b border-neutral-900/60 flex flex-col items-center gap-12 text-center">
          <div className="flex flex-col gap-3 max-w-2xl">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Explorar</span>
            <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-white tracking-tight">
              Comunidades destacadas activas
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed">
              Mira algunos de los espacios públicos reales creados por nuestra comunidad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
            {featuredCommunities.map((comm) => (
              <CommunityCard
                key={comm.id}
                id={comm.id}
                slug={comm.slug}
                displayName={comm.displayName}
                description={comm.description || ""}
                avatarUrl={comm.avatarUrl}
                privacyType={comm.privacyType as "PUBLIC" | "PRIVATE" | "INVITE_ONLY"}
                membersCount={comm.membersCount}
                isJoined={false}
                membershipStatus={null}
                category={comm.category}
              />
            ))}
          </div>
        </section>
      )}

      {/* 6. CONFIANZA Y SEGURIDAD */}
      <section className="w-full max-w-5xl mx-auto px-6 py-24 border-b border-neutral-900/60 flex flex-col items-center gap-12 text-center">
        <div className="flex flex-col gap-3 max-w-2xl">
          <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Tecnología</span>
          <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-white tracking-tight">
            Respaldo de infraestructura moderna
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed">
            Tu información y tus archivos están resguardados bajo estándares líderes de la industria.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
          {[
            {
              title: "Autenticación segura",
              provider: "Clerk Auth",
              desc: "Garantizamos el registro de cuentas mediante Clerk, soportando login directo por Google o correo electrónico con políticas estrictas de cifrado y sin almacenar contraseñas.",
            },
            {
              title: "Archivos inmutables",
              provider: "Cloudflare R2",
              desc: "Carga y descarga segura de tus archivos adjuntos. Almacenamiento rápido en silos encriptados con descargas directas ultra veloces e ilimitadas.",
            },
            {
              title: "Moderación por espacio",
              provider: "Neon Serverless",
              desc: "Nuestra base de datos relacional Neon garantiza consistencia transaccional y logs de auditoría inmutables de todas las acciones tomadas por los moderadores del espacio.",
            },
          ].map((tech, idx) => (
            <div key={idx} className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-blue-400 shrink-0" />
                <span>{tech.title}</span>
              </h3>
              <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider">
                {tech.provider}
              </span>
              <p className="text-xs text-neutral-450 leading-relaxed font-light">
                {tech.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. FINAL CTA */}
      <section className="relative w-full py-32 px-6 flex flex-col items-center justify-center text-center z-10 overflow-hidden">
        {/* Radiant glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.06),transparent_60%)] pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center gap-6">
          <h2 className="text-3xl sm:text-4xl font-heading font-semibold text-white tracking-tight leading-tight">
            Únete a Consejos hoy mismo
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 font-light leading-relaxed max-w-lg">
            Crea tu propio espacio temático o únete a las comunidades de expertos para resolver tus dudas técnicas y crecer profesionalmente.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4">
            {isSignedIn ? (
              <Link
                href="/app"
                className="rounded-full bg-white text-neutral-950 px-8 py-3 text-sm font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-lg shadow-white/5 flex items-center gap-1.5"
              >
                <span>Acceder a la plataforma</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <SignUpButton mode="modal">
                <button className="rounded-full bg-white text-neutral-950 px-8 py-3 text-sm font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-lg shadow-white/5 flex items-center gap-1.5">
                  <span>Empezar ahora gratis</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </SignUpButton>
            )}
            
            <Link
              href={isSignedIn ? "/app/explore" : "/sign-in"}
              className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors py-2 px-4"
            >
              Explorar de forma anónima &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
