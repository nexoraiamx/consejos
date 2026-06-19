"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Link2, 
  X, 
  Loader2, 
  FileText, 
  Music, 
  Video, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { AttachmentInput } from "@/app/actions/posts";

interface UploaderProps {
  communityId: string;
  targetType: "POST" | "COMMENT";
  targetId?: string;
  onChange: (attachments: AttachmentInput[]) => void;
  value: AttachmentInput[];
}

interface UploadTask {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  progress: number;
  status: "idle" | "uploading" | "success" | "error";
  error?: string;
}

export function Uploader({
  communityId,
  targetType,
  targetId,
  onChange,
  value
}: UploaderProps) {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSessionIdRef = useRef<string>("");

  useEffect(() => {
    // Generate upload session id on mount
    uploadSessionIdRef.current = crypto.randomUUID();
  }, []);

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const validateLocalFile = (file: File): { valid: boolean; error?: string } => {
    const name = file.name.toLowerCase();
    
    // Dangerous extensions
    const blockedExtensions = [
      ".exe", ".sh", ".bat", ".js", ".ts", ".jsx", ".tsx", ".cmd", ".vbs", 
      ".scr", ".jar", ".msi", ".com", ".gadget", ".wsf", ".pif", ".cpl"
    ];
    if (blockedExtensions.some(ext => name.endsWith(ext))) {
      return { valid: false, error: "Extensión de archivo bloqueada por seguridad." };
    }

    // Size limits & MIMEs
    const size = file.size;
    const type = file.type;

    const allowedMimes = {
      IMAGE: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      VIDEO: ["video/mp4", "video/webm", "video/ogg"],
      AUDIO: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/mpeg3"],
      PDF: ["application/pdf"],
    };

    let isAllowed = false;
    let limit = 0;

    if (allowedMimes.IMAGE.includes(type)) {
      isAllowed = true;
      limit = 10 * 1024 * 1024; // 10MB
    } else if (allowedMimes.VIDEO.includes(type)) {
      isAllowed = true;
      limit = 100 * 1024 * 1024; // 100MB
    } else if (allowedMimes.AUDIO.includes(type)) {
      isAllowed = true;
      limit = 50 * 1024 * 1024; // 50MB
    } else if (allowedMimes.PDF.includes(type)) {
      isAllowed = true;
      limit = 25 * 1024 * 1024; // 25MB
    }

    if (!isAllowed) {
      return { valid: false, error: "Tipo de archivo no permitido. Solo se aceptan imágenes, videos, audios y PDFs." };
    }

    if (size > limit) {
      const limitMb = Math.round(limit / (1024 * 1024));
      return { valid: false, error: `El archivo excede el tamaño máximo permitido de ${limitMb}MB.` };
    }

    return { valid: true };
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setLocalError(null);

    Array.from(files).forEach((file) => {
      const validation = validateLocalFile(file);
      if (!validation.valid) {
        setLocalError(validation.error || "Archivo no válido.");
        return;
      }

      const taskId = crypto.randomUUID();
      const newTask: UploadTask = {
        id: taskId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        progress: 0,
        status: "idle",
      };

      setUploadTasks((prev) => [...prev, newTask]);
      uploadFileToServer(file, taskId);
    });
  };

  const uploadFileToServer = async (file: File, taskId: string) => {
    setUploadTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "uploading" } : t))
    );

    try {
      // 1. Get Presigned URL
      const presignRes = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId,
          targetType,
          targetId,
          uploadSessionId: uploadSessionIdRef.current,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      if (!presignRes.ok) {
        const errData = await presignRes.json();
        throw new Error(errData.error || "Error al firmar la subida.");
      }

      const { uploadUrl, fileUrl, fileKey } = await presignRes.json();

      // 2. Upload file via PUT request with progress tracking
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", file.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, progress: percentComplete } : t))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          setUploadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: "success", progress: 100 } : t))
          );

          // Add to attachments
          const newAttachment: AttachmentInput = {
            fileUrl,
            fileKey,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          };
          onChange([...value, newAttachment]);
        } else {
          throw new Error(`Error de red con código de estado: ${xhr.status}`);
        }
      };

      xhr.onerror = () => {
        throw new Error("Fallo en la conexión de red.");
      };

      xhr.send(file);

    } catch (err: any) {
      console.error(err);
      setUploadTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "error", error: err.message || "Fallo al subir." } : t
        )
      );
    }
  };

  const addExternalLink = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    let url = linkUrl.trim();
    if (!url) return;

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    try {
      new URL(url);
    } catch (_) {
      setLocalError("Enlace no válido. Introduce una URL completa.");
      return;
    }

    const name = linkName.trim() || url;

    const newAttachment: AttachmentInput = {
      fileUrl: url,
      fileKey: "external",
      fileName: name,
      fileSize: 0,
      mimeType: "text/uri-list",
    };

    onChange([...value, newAttachment]);
    setLinkUrl("");
    setLinkName("");
    setShowLinkInput(false);
  };

  const removeAttachment = (indexToRemove: number) => {
    const attToRemove = value[indexToRemove];
    
    // Remove from value
    onChange(value.filter((_, i) => i !== indexToRemove));

    // Also remove from task list if it corresponds to an R2 upload
    setUploadTasks((prev) =>
      prev.filter((t) => t.fileName !== attToRemove.fileName)
    );
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5 text-blue-400" />;
    if (mimeType.startsWith("video/")) return <Video className="h-5 w-5 text-amber-400" />;
    if (mimeType.startsWith("audio/")) return <Music className="h-5 w-5 text-emerald-400" />;
    if (mimeType === "application/pdf") return <FileText className="h-5 w-5 text-red-400" />;
    if (mimeType === "text/uri-list") return <Link2 className="h-5 w-5 text-purple-400" />;
    return <FileText className="h-5 w-5 text-neutral-400" />;
  };

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Area de arrastrar y soltar */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-2 group ${
          isDragActive
            ? "border-blue-500 bg-blue-950/10"
            : "border-neutral-900 bg-neutral-950/20 hover:border-neutral-850 hover:bg-neutral-950/40"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          multiple
          className="hidden"
          accept="image/*,video/*,audio/*,application/pdf"
        />

        <div className="h-10 w-10 rounded-2xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-400 group-hover:text-neutral-200 transition-colors">
          <Upload className="h-5 w-5" />
        </div>

        <p className="text-xs font-semibold text-neutral-300">
          Arrastra archivos aquí o haz clic para buscarlos
        </p>
        <p className="text-[10px] text-neutral-500 max-w-sm leading-relaxed">
          Imágenes (hasta 10MB), Audio (hasta 50MB), Videos (hasta 100MB) y PDFs (hasta 25MB)
        </p>
      </div>

      {/* Botón para enlace externo */}
      <div className="self-start">
        {!showLinkInput ? (
          <button
            type="button"
            onClick={() => setShowLinkInput(true)}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-450 hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>Agregar enlace externo o marcador</span>
          </button>
        ) : (
          <form 
            onSubmit={addExternalLink}
            className="p-4 rounded-3xl border border-neutral-900 bg-neutral-950/40 flex flex-col gap-3 max-w-sm mt-1"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-neutral-400">Dirección URL</label>
              <input
                type="text"
                required
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-neutral-400">Título / Nombre (Opcional)</label>
              <input
                type="text"
                placeholder="e.g. Documentación Oficial"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="px-3 py-2 bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="submit"
                className="rounded-full bg-white text-neutral-950 px-3.5 py-1 text-[10px] font-semibold hover:bg-neutral-250 transition-colors cursor-pointer"
              >
                Agregar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkUrl("");
                  setLinkName("");
                }}
                className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-450 px-3.5 py-1 text-[10px] font-semibold hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Lista de Errores locales */}
      {localError && (
        <div className="flex items-center gap-2 text-red-400 text-xs mt-1 p-3 rounded-2xl bg-red-950/10 border border-red-900/20">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{localError}</span>
        </div>
      )}

      {/* Adjuntos en Proceso de Subida */}
      {uploadTasks.length > 0 && uploadTasks.some(t => t.status !== "success") && (
        <div className="flex flex-col gap-2 mt-1">
          <h4 className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Subiendo archivos</h4>
          {uploadTasks
            .filter(t => t.status !== "success")
            .map((task) => (
              <div 
                key={task.id} 
                className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-neutral-900 bg-neutral-950/10"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getFileIcon(task.mimeType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-neutral-300 truncate font-semibold">{task.fileName}</p>
                    {task.status === "uploading" && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-neutral-900 rounded-full h-1.5 overflow-hidden border border-neutral-850">
                          <div 
                            className="bg-blue-500 h-full transition-all duration-300"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-neutral-500 font-mono min-w-[25px] text-right">{task.progress}%</span>
                      </div>
                    )}
                    {task.status === "error" && (
                      <span className="text-[9px] text-red-400 font-semibold">{task.error}</span>
                    )}
                  </div>
                </div>
                {task.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />
                ) : (
                  <button 
                    onClick={() => setUploadTasks(prev => prev.filter(t => t.id !== task.id))}
                    className="p-1 rounded-lg hover:bg-neutral-900 text-neutral-500 hover:text-neutral-250 cursor-pointer shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Adjuntos Cargados Exitosamente */}
      {value.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <h4 className="text-[10px] font-bold uppercase text-neutral-500 tracking-wider">Adjuntos listos</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {value.map((att, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-neutral-900 bg-neutral-950/30 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getFileIcon(att.mimeType)}
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-300 font-semibold truncate max-w-[180px]">{att.fileName}</p>
                    <p className="text-[9px] text-neutral-500 font-mono mt-0.5">
                      {att.mimeType === "text/uri-list" ? "Enlace" : "Listo para publicar"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="p-1 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-950/10 transition-colors cursor-pointer shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
