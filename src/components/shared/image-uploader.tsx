"use client";

import React, { useState, useRef } from "react";
import { Upload, Loader2, X, Image as ImageIcon } from "lucide-react";

interface ImageUploaderProps {
  label: string;
  value: string; // The uploaded image URL
  onChange: (url: string) => void;
  communityId?: string; // Optional (not available during creation)
  aspectRatio: "square" | "video"; // Avatar vs Banner
}

export function ImageUploader({
  label,
  value,
  onChange,
  communityId,
  aspectRatio
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate type
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten archivos de imagen.");
      return;
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError("El tamaño de la imagen no debe exceder los 10MB.");
      return;
    }

    setIsUploading(true);

    try {
      // 1. Request presigned URL
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId: communityId || "new-community-temp-id",
          targetType: "COMMUNITY",
          uploadSessionId: crypto.randomUUID(),
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json();
        throw new Error(errData.error || "Error al obtener URL firmada.");
      }

      const { uploadUrl, fileUrl } = await presignRes.json();

      // 2. Upload file to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Error al subir archivo a R2.");
      }

      onChange(fileUrl);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 text-left w-full">
      <span className="text-xs font-semibold text-neutral-400">{label}</span>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {value ? (
        <div className={`relative rounded-2xl border border-neutral-900 bg-neutral-950/20 overflow-hidden ${
          aspectRatio === "square" ? "h-24 w-24" : "h-32 w-full"
        }`}>
          <img
            src={value}
            alt={label}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-neutral-950/80 border border-neutral-800 text-neutral-400 hover:text-white transition-all hover:scale-105 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={`border-2 border-dashed border-neutral-900 bg-neutral-950/10 hover:bg-neutral-950/20 hover:border-neutral-850 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 transition-all text-neutral-500 hover:text-neutral-300 disabled:opacity-55 cursor-pointer ${
            aspectRatio === "square" ? "h-24 w-24 text-center" : "h-32 w-full text-center"
          }`}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          ) : (
            <Upload className="h-5 w-5 text-neutral-400" />
          )}
          <span className="text-[10px] font-medium text-neutral-400">
            {isUploading ? "Subiendo..." : "Subir imagen"}
          </span>
        </button>
      )}

      {error && (
        <span className="text-[10px] text-red-400 font-medium">{error}</span>
      )}
    </div>
  );
}
