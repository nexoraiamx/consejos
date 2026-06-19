"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createCommunityAction } from "@/app/actions/communities";
import { ArrowLeft, Globe, Lock, ShieldAlert, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewCommunityPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [privacyType, setPrivacyType] = useState<"PUBLIC" | "PRIVATE" | "INVITE_ONLY">("PUBLIC");
  
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-slugify displayName unless the user manually inputs a slug
  useEffect(() => {
    if (!isSlugManuallyEdited) {
      const generatedSlug = displayName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "") // Remove non-word characters (except spaces/dashes)
        .replace(/[\s_]+/g, "-") // Replace spaces/underscores with dashes
        .replace(/^-+|-+$/g, ""); // Trim dashes
      setSlug(generatedSlug);
    }
  }, [displayName, isSlugManuallyEdited]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await createCommunityAction({
        displayName,
        slug,
        description,
        privacyType,
      });

      if (res.success) {
        // Redirigir al detalle de la comunidad recién creada
        router.push(`/app/r/${res.slug}`);
      } else {
        setErrorMessage(res.error || "Ocurrió un error al intentar crear la comunidad.");
      }
    } catch (error) {
      console.error("Error al enviar formulario:", error);
      setErrorMessage("Ocurrió un error inesperado. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-2xl mx-auto px-6 py-8 flex flex-col gap-6 text-left">
      {/* Botón de regreso */}
      <Link
        href="/app/explore"
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Volver a Explorar</span>
      </Link>

      <div className="flex flex-col gap-2 border-b border-neutral-900 pb-5">
        <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
          Crear una Comunidad
        </h1>
        <p className="text-sm text-neutral-400 font-light leading-relaxed">
          Establece un nuevo espacio para compartir conocimientos, archivos y organizar debates de alto nivel.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-2">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/40 text-red-400 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Nombre */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-neutral-300">Nombre de la comunidad</label>
          <input
            type="text"
            required
            placeholder="e.g. Next.js Latam"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
          />
          <span className="text-[10px] text-neutral-500">Un nombre legible y descriptivo (mínimo 3 caracteres).</span>
        </div>

        {/* Slug */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-neutral-300">Slug de la URL (Identificador)</label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-xs text-neutral-500">consejos.com/app/r/</span>
            <input
              type="text"
              required
              placeholder="nextjs-latam"
              value={slug}
              onChange={(e) => {
                setIsSlugManuallyEdited(true);
                setSlug(e.target.value.toLowerCase().replace(/[\s_]+/g, "-"));
              }}
              className="w-full pl-[150px] pr-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
            />
          </div>
          <span className="text-[10px] text-neutral-500">
            Único. Sólo letras minúsculas, números y guiones.
          </span>
        </div>

        {/* Descripción */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-neutral-300">Descripción (Opcional)</label>
          <textarea
            placeholder="¿De qué trata este espacio? Directrices de contenido, propósitos..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light resize-none leading-relaxed"
          />
        </div>

        {/* Tipo de Privacidad */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-neutral-300">Tipo de privacidad</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* PUBLIC */}
            <button
              type="button"
              onClick={() => setPrivacyType("PUBLIC")}
              className={`p-4 rounded-3xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                privacyType === "PUBLIC"
                  ? "bg-neutral-900 border-white text-white shadow-sm shadow-white/5"
                  : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:border-neutral-850 hover:text-neutral-300"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <Globe className="h-4 w-4 text-blue-400" />
                <span>Público</span>
              </div>
              <p className="text-[10px] text-neutral-500 font-light leading-relaxed">
                Cualquiera puede ver la comunidad y unirse de manera inmediata.
              </p>
            </button>

            {/* PRIVATE */}
            <button
              type="button"
              onClick={() => setPrivacyType("PRIVATE")}
              className={`p-4 rounded-3xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                privacyType === "PRIVATE"
                  ? "bg-neutral-900 border-white text-white shadow-sm shadow-white/5"
                  : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:border-neutral-850 hover:text-neutral-300"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <Lock className="h-4 w-4 text-emerald-400" />
                <span>Privado</span>
              </div>
              <p className="text-[10px] text-neutral-500 font-light leading-relaxed">
                Solo miembros autorizados pueden ver las publicaciones y participar.
              </p>
            </button>

            {/* INVITE_ONLY */}
            <button
              type="button"
              onClick={() => setPrivacyType("INVITE_ONLY")}
              className={`p-4 rounded-3xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                privacyType === "INVITE_ONLY"
                  ? "bg-neutral-900 border-white text-white shadow-sm shadow-white/5"
                  : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:border-neutral-850 hover:text-neutral-300"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <ShieldAlert className="h-4 w-4 text-purple-400" />
                <span>Invitación</span>
              </div>
              <p className="text-[10px] text-neutral-500 font-light leading-relaxed">
                Requiere que un administrador invite o apruebe la solicitud antes de entrar.
              </p>
            </button>

          </div>
        </div>

        {/* Botones finales */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-900">
          <Link
            href="/app/explore"
            className="rounded-full bg-neutral-950 border border-neutral-900 text-neutral-400 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md shadow-white/5 disabled:opacity-50 min-w-[130px] justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Creando...</span>
              </>
            ) : (
              <span>Crear comunidad</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
