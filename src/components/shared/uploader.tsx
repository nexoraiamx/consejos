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
  AlertCircle,
  Mic,
  Square,
  RefreshCw,
  Play
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
  const [activeTab, setActiveTab] = useState<"upload" | "audio" | "video" | "link">("upload");
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Lógica de grabación MediaRecorder
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "preview">("idle");
  const [timer, setTimer] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSessionIdRef = useRef<string>("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Generar upload session id al montar
    uploadSessionIdRef.current = crypto.randomUUID();

    // Limpieza al desmontar
    return () => {
      stopTracks();
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Auxiliares de grabación
  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopTracks();
  };

  const discardRecording = () => {
    stopRecording();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setRecordedBlob(null);
    setRecordingState("idle");
    setTimer(0);
    setRecordingError(null);
  };

  const handleTabChange = (tab: "upload" | "audio" | "video" | "link") => {
    discardRecording();
    setActiveTab(tab);
    setLocalError(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // API de Grabación de Audio
  const startAudioRecording = async () => {
    setRecordingError(null);
    chunksRef.current = [];
    
    if (typeof window === "undefined" || !window.MediaRecorder) {
      setRecordingError("La grabación de audio no está soportada en este navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let options = {};
      if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" };
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setRecordingState("preview");
      };

      recorder.start(250);
      setRecordingState("recording");
      setTimer(0);

      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev >= 300) { // 5 minutos límite
            stopRecording();
            return 300;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error("Error al acceder al micrófono:", err);
      setRecordingError("Permiso denegado o no se encontró un micrófono.");
    }
  };

  // API de Grabación de Video
  const startVideoRecording = async () => {
    setRecordingError(null);
    chunksRef.current = [];

    if (typeof window === "undefined" || !window.MediaRecorder) {
      setRecordingError("La grabación de video no está soportada en este navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: "user" }, 
        audio: true 
      });
      streamRef.current = stream;

      // Asignar el stream al elemento de video en vivo
      setRecordingState("recording");
      setTimer(0);

      setTimeout(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
        }
      }, 100);

      let options = {};
      if (MediaRecorder.isTypeSupported("video/webm")) {
        options = { mimeType: "video/webm" };
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setRecordingState("preview");
      };

      recorder.start(250);

      timerIntervalRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev >= 120) { // 2 minutos límite
            stopRecording();
            return 120;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error("Error al acceder a la cámara/micrófono:", err);
      setRecordingError("Permiso denegado o no se encontró una cámara o micrófono.");
      setRecordingState("idle");
    }
  };

  // Confirmar y subir archivo grabado
  const uploadRecordedMedia = async () => {
    if (!recordedBlob) return;

    const isAudio = activeTab === "audio";
    const name = isAudio 
      ? `grabacion_audio_${Date.now()}.webm` 
      : `grabacion_video_${Date.now()}.webm`;
    
    const mimeType = recordedBlob.type || (isAudio ? "audio/webm" : "video/webm");
    const file = new File([recordedBlob], name, { type: mimeType });

    // Limpiar estado de grabación
    discardRecording();

    // Iniciar subida
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
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const validateLocalFile = (file: File): { valid: boolean; error?: string } => {
    const name = file.name.toLowerCase();
    
    // Extensiones prohibidas
    const blockedExtensions = [
      ".exe", ".sh", ".bat", ".js", ".ts", ".jsx", ".tsx", ".cmd", ".vbs", 
      ".scr", ".jar", ".msi", ".com", ".gadget", ".wsf", ".pif", ".cpl"
    ];
    if (blockedExtensions.some(ext => name.endsWith(ext))) {
      return { valid: false, error: "Extensión de archivo bloqueada por seguridad." };
    }

    // Límites de tamaño y MIMEs
    const size = file.size;
    const type = file.type;

    const allowedMimes = {
      IMAGE: ["image/png", "image/jpeg", "image/gif", "image/webp"],
      VIDEO: ["video/mp4", "video/webm", "video/ogg"],
      AUDIO: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/mpeg3", "audio/webm"],
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
    } else if (allowedMimes.AUDIO.includes(type) || type === "audio/webm") {
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
      // 1. Obtener Presigned URL
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

      // 2. Subida física
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

          // Agregar al array de adjuntos
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
  };

  const removeAttachment = (indexToRemove: number) => {
    const attToRemove = value[indexToRemove];
    onChange(value.filter((_, i) => i !== indexToRemove));
    setUploadTasks((prev) =>
      prev.filter((t) => t.fileName !== attToRemove.fileName)
    );
  };

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
      {/* Tabs de Selección */}
      <div className="flex items-center gap-1 border-b border-neutral-900 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => handleTabChange("upload")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === "upload"
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Upload className="h-3.5 w-3.5" />
          <span>Subir Archivo</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("audio")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === "audio"
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Mic className="h-3.5 w-3.5" />
          <span>Grabar Audio</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("video")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === "video"
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          <span>Grabar Video</span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("link")}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === "link"
              ? "bg-neutral-900 text-white"
              : "text-neutral-500 hover:text-neutral-300"
          }`}
        >
          <Link2 className="h-3.5 w-3.5" />
          <span>Enlace Externo</span>
        </button>
      </div>

      {/* Panel 1: Drag & Drop Manual */}
      {activeTab === "upload" && (
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
      )}

      {/* Panel 2: Grabador de Audio */}
      {activeTab === "audio" && (
        <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/20 flex flex-col items-center justify-center gap-4 text-center">
          {recordingState === "idle" && (
            <>
              <div className="h-12 w-12 rounded-full bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-400">
                <Mic className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-neutral-200">Graba audio desde tu micrófono</p>
                <p className="text-[10px] text-neutral-500">Límite máximo de 5 minutos.</p>
              </div>
              <button
                type="button"
                onClick={startAudioRecording}
                className="rounded-full bg-white text-neutral-950 px-5 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer"
              >
                Grabar audio
              </button>
            </>
          )}

          {recordingState === "recording" && (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-sm font-semibold font-mono text-neutral-200">
                  {formatTime(timer)} / 05:00
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-light">Grabando...</p>
              <button
                type="button"
                onClick={stopRecording}
                className="rounded-full bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-xs font-semibold transition-all cursor-pointer"
              >
                Detener
              </button>
            </>
          )}

          {recordingState === "preview" && previewUrl && (
            <>
              <div className="h-12 w-12 rounded-full bg-emerald-950/20 border border-emerald-900/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-1 w-full max-w-sm items-center">
                <p className="text-xs font-semibold text-neutral-200">Previsualiza tu grabación</p>
                <audio ref={previewAudioRef} src={previewUrl} controls className="w-full mt-2 h-10 accent-white" />
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={uploadRecordedMedia}
                  className="rounded-full bg-white text-neutral-950 px-4 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md"
                >
                  Confirmar y Subir
                </button>
                <button
                  type="button"
                  onClick={discardRecording}
                  className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white px-4 py-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  Regrabar
                </button>
                <button
                  type="button"
                  onClick={discardRecording}
                  className="rounded-full bg-red-950/15 border border-red-900/30 text-red-400 hover:bg-red-950/30 px-4 py-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  Eliminar
                </button>
              </div>
            </>
          )}

          {recordingError && (
            <div className="text-xs text-red-400 mt-2 p-3 rounded-2xl bg-red-950/10 border border-red-900/20 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{recordingError}</span>
            </div>
          )}
        </div>
      )}

      {/* Panel 3: Grabador de Video */}
      {activeTab === "video" && (
        <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/20 flex flex-col items-center justify-center gap-4 text-center overflow-hidden">
          {recordingState === "idle" && (
            <>
              <div className="h-12 w-12 rounded-full bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-400">
                <Video className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold text-neutral-200">Graba video desde tu cámara y micrófono</p>
                <p className="text-[10px] text-neutral-500">Límite máximo de 2 minutos.</p>
              </div>
              <button
                type="button"
                onClick={startVideoRecording}
                className="rounded-full bg-white text-neutral-950 px-5 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer"
              >
                Grabar video
              </button>
            </>
          )}

          {recordingState === "recording" && (
            <>
              <div className="relative w-full max-w-md aspect-video bg-black rounded-2xl border border-neutral-850 overflow-hidden shadow-inner">
                <video
                  ref={liveVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  <span className="text-[10px] font-semibold font-mono text-white">
                    {formatTime(timer)} / 02:00
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={stopRecording}
                className="rounded-full bg-red-650 hover:bg-red-700 text-white px-5 py-2 text-xs font-semibold transition-all cursor-pointer"
              >
                Detener
              </button>
            </>
          )}

          {recordingState === "preview" && previewUrl && (
            <>
              <div className="flex flex-col gap-2 w-full max-w-md items-center">
                <p className="text-xs font-semibold text-neutral-200">Previsualiza tu grabación</p>
                <div className="relative w-full aspect-video bg-black rounded-2xl border border-neutral-850 overflow-hidden shadow-inner mt-2">
                  <video
                    ref={previewVideoRef}
                    src={previewUrl}
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={uploadRecordedMedia}
                  className="rounded-full bg-white text-neutral-950 px-4 py-2 text-xs font-semibold hover:bg-neutral-200 transition-all cursor-pointer shadow-md"
                >
                  Confirmar y Subir
                </button>
                <button
                  type="button"
                  onClick={discardRecording}
                  className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white px-4 py-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  Regrabar
                </button>
                <button
                  type="button"
                  onClick={discardRecording}
                  className="rounded-full bg-red-950/15 border border-red-900/30 text-red-400 hover:bg-red-950/30 px-4 py-2 text-xs font-semibold transition-all cursor-pointer"
                >
                  Eliminar
                </button>
              </div>
            </>
          )}

          {recordingError && (
            <div className="text-xs text-red-400 mt-2 p-3 rounded-2xl bg-red-950/10 border border-red-900/20 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{recordingError}</span>
            </div>
          )}
        </div>
      )}

      {/* Panel 4: Agregar Enlace Externo */}
      {activeTab === "link" && (
        <form 
          onSubmit={(e) => {
            addExternalLink(e);
            setLinkUrl("");
            setLinkName("");
          }}
          className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/20 flex flex-col gap-3 w-full max-w-md"
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
              className="rounded-full bg-white text-neutral-950 px-4 py-1.5 text-xs font-semibold hover:bg-neutral-250 transition-colors cursor-pointer"
            >
              Agregar enlace
            </button>
          </div>
        </form>
      )}

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
