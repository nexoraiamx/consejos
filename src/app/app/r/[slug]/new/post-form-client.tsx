"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createPostAction, AttachmentInput } from "@/app/actions/posts";
import { ArrowLeft, FileQuestion, BookOpen, MessageCircle, FileCode, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { Uploader } from "@/components/shared/uploader";

interface PostFormProps {
  communityId: string;
  communitySlug: string;
  communityName: string;
}

export default function PostFormClient({
  communityId,
  communitySlug,
  communityName,
}: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<"QUESTION" | "RESOURCE" | "DISCUSSION" | "CASE_STUDY">("DISCUSSION");
  const [category, setCategory] = useState("");
  const [tagsString, setTagsString] = useState("");
  const [attachments, setAttachments] = useState<AttachmentInput[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hasUploadError, setHasUploadError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!title.trim() || title.trim().length < 5) {
      setErrorMessage("El título de la publicación debe tener al menos 5 caracteres.");
      return;
    }

    if (!content.trim() && attachments.length === 0) {
      setErrorMessage("Escribe contenido o agrega un archivo/enlace.");
      return;
    }

    if (isUploading) {
      setErrorMessage("Por favor espera a que terminen de subirse todos los archivos.");
      return;
    }

    if (hasUploadError) {
      setErrorMessage("Hay archivos con error de subida. Por favor elimínalos o reintenta la subida antes de publicar.");
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    const tags = tagsString
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await createPostAction({
        communityId,
        title,
        content,
        postType,
        category: category || undefined,
        tags,
        attachments,
      });

      if (res.success) {
        router.push(`/app/r/${res.slug}/post/${res.postId}`);
      } else {
        setErrorMessage(res.error || "Ocurrió un error al intentar crear la publicación.");
      }
    } catch (error) {
      console.error("Error al crear la publicación:", error);
      setErrorMessage("Error de servidor inesperado. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6 text-left">
      {/* Botón Volver */}
      <Link
        href={`/app/r/${communitySlug}`}
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300 transition-colors self-start"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Volver a r/{communitySlug}</span>
      </Link>

      <div className="flex flex-col gap-2 border-b border-neutral-900 pb-5">
        <h1 className="text-2xl font-heading font-semibold text-neutral-100 tracking-tight">
          Nueva Publicación en {communityName}
        </h1>
        <p className="text-sm text-neutral-400 font-light leading-relaxed">
          Comparte dudas, guías, recursos o casos prácticos con el resto de la comunidad.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-2">
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/40 text-red-400 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Título */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-neutral-300">Título de la publicación</label>
          <input
            type="text"
            required
            placeholder="e.g. ¿Cómo estructurar un sistema de diseño con Tailwind v4?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
          />
          <span className="text-[10px] text-neutral-500">Un título claro y conciso (mínimo 5 caracteres).</span>
        </div>

        {/* Tipo de Publicación Selector */}
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-neutral-300">Tipo de contenido</label>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* DISCUSSION */}
            <button
              type="button"
              onClick={() => setPostType("DISCUSSION")}
              className={`p-4 rounded-3xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                postType === "DISCUSSION"
                  ? "bg-neutral-900 border-white text-white"
                  : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:border-neutral-850"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <MessageCircle className="h-4 w-4 text-neutral-400" />
                <span>Debate</span>
              </div>
              <p className="text-[9px] text-neutral-500 font-light leading-relaxed">
                Iniciar discusiones generales y debatir ideas.
              </p>
            </button>

            {/* QUESTION */}
            <button
              type="button"
              onClick={() => setPostType("QUESTION")}
              className={`p-4 rounded-3xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                postType === "QUESTION"
                  ? "bg-neutral-900 border-white text-white"
                  : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:border-neutral-850"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <FileQuestion className="h-4 w-4 text-purple-400" />
                <span>Pregunta</span>
              </div>
              <p className="text-[9px] text-neutral-500 font-light leading-relaxed">
                Solicitar ayuda o aclaraciones a expertos.
              </p>
            </button>

            {/* RESOURCE */}
            <button
              type="button"
              onClick={() => setPostType("RESOURCE")}
              className={`p-4 rounded-3xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                postType === "RESOURCE"
                  ? "bg-neutral-900 border-white text-white"
                  : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:border-neutral-850"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <BookOpen className="h-4 w-4 text-blue-400" />
                <span>Recurso</span>
              </div>
              <p className="text-[9px] text-neutral-500 font-light leading-relaxed">
                Compartir enlaces, guías, plantillas y PDFs.
              </p>
            </button>

            {/* CASE_STUDY */}
            <button
              type="button"
              onClick={() => setPostType("CASE_STUDY")}
              className={`p-4 rounded-3xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${
                postType === "CASE_STUDY"
                  ? "bg-neutral-900 border-white text-white"
                  : "bg-neutral-950 border-neutral-900 text-neutral-400 hover:border-neutral-850"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-xs">
                <FileCode className="h-4 w-4 text-amber-400" />
                <span>Caso de Estudio</span>
              </div>
              <p className="text-[9px] text-neutral-500 font-light leading-relaxed">
                Análisis de código a fondo o proyectos reales.
              </p>
            </button>

          </div>
        </div>

        {/* Categoría y Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-300">Categoría (Opcional)</label>
            <input
              type="text"
              placeholder="e.g. Frontend, Backend"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-neutral-300">Etiquetas (Separadas por comas)</label>
            <input
              type="text"
              placeholder="react, tailwind, ui"
              value={tagsString}
              onChange={(e) => setTagsString(e.target.value)}
              className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light"
            />
          </div>
        </div>

        {/* Contenido (Textarea) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-neutral-300">Contenido</label>
          <textarea
            placeholder="Escribe algo o adjunta audio, imagen, video, PDF o enlace…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="px-4 py-3 bg-neutral-900 border border-neutral-850 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors font-light resize-none leading-relaxed font-mono"
          />
        </div>

        {/* Adjuntos y Multimedia */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-neutral-300">Multimedia y Enlaces Externos</label>
          <Uploader
            communityId={communityId}
            targetType="POST"
            value={attachments}
            onChange={setAttachments}
            onUploadStatusChange={({ isUploading, hasError }) => {
              setIsUploading(isUploading);
              setHasUploadError(hasError);
            }}
          />
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-neutral-900">
          {isUploading && (
            <span className="text-[11px] text-blue-450 animate-pulse font-light mr-auto">
              Subiendo archivos en segundo plano...
            </span>
          )}
          {hasUploadError && (
            <span className="text-[11px] text-red-400 font-medium mr-auto">
              Corrige las subidas fallidas antes de publicar.
            </span>
          )}
          <Link
            href={`/app/r/${communitySlug}`}
            className="rounded-full bg-neutral-950 border border-neutral-900 text-neutral-400 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={isLoading || isUploading || hasUploadError}
            className="inline-flex items-center gap-2 rounded-full bg-white text-neutral-950 px-5 py-2.5 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md shadow-white/5 disabled:opacity-50 min-w-[130px] justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />
                <span>Subiendo...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Publicar</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
