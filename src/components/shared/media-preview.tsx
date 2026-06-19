"use client";

import React, { useState } from "react";
import { 
  FileText, 
  Music, 
  Video, 
  Image as ImageIcon, 
  Download, 
  Link2, 
  ExternalLink,
  Play,
  Volume2
} from "lucide-react";

interface Attachment {
  id?: string;
  fileName: string;
  mimeType: string;
  fileUrl: string;
  fileSize?: number;
  fileKey?: string;
}

interface MediaPreviewProps {
  attachments: Attachment[];
}

export function MediaPreview({ attachments }: MediaPreviewProps) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mt-3 w-full">
      {attachments.map((att, index) => {
        const { fileName, mimeType, fileUrl, fileSize } = att;
        
        // Helper to format bytes
        const formatSize = (bytes?: number) => {
          if (!bytes) return "";
          const k = 1024;
          const sizes = ["Bytes", "KB", "MB", "GB"];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
        };

        // Render Image
        if (mimeType.startsWith("image/")) {
          return (
            <div key={index} className="relative rounded-2xl overflow-hidden border border-neutral-900 bg-neutral-950/20 max-w-lg group">
              <img
                src={fileUrl}
                alt={fileName}
                className="w-full max-h-[350px] object-cover transition-transform duration-500 group-hover:scale-101"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <div className="flex justify-between items-center w-full">
                  <span className="text-xs text-neutral-200 truncate pr-4">{fileName}</span>
                  <a
                    href={fileUrl}
                    download={fileName}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          );
        }

        // Render Video
        if (mimeType.startsWith("video/")) {
          return (
            <div key={index} className="relative rounded-2xl overflow-hidden border border-neutral-900 bg-neutral-950/20 max-w-xl">
              <video
                src={fileUrl}
                controls
                className="w-full max-h-[400px]"
                preload="metadata"
              />
            </div>
          );
        }

        // Render Audio
        if (mimeType.startsWith("audio/")) {
          return (
            <div 
              key={index} 
              className="p-4 rounded-2xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col md:flex-row items-center gap-4 max-w-md"
            >
              <div className="h-10 w-10 rounded-full bg-blue-950/40 border border-blue-900/40 flex items-center justify-center text-blue-400 shrink-0">
                <Music className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 w-full">
                <p className="text-xs font-semibold text-neutral-200 truncate">{fileName}</p>
                {fileSize && (
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{formatSize(fileSize)}</p>
                )}
                <audio src={fileUrl} controls className="w-full h-8 mt-2 opacity-80" />
              </div>
            </div>
          );
        }

        // Render PDF
        if (mimeType === "application/pdf") {
          return (
            <a
              key={index}
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="p-4 rounded-2xl border border-neutral-900 bg-neutral-950/30 hover:bg-neutral-950/60 hover:border-neutral-800 transition-all flex items-center justify-between gap-4 max-w-md group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-red-950/30 border border-red-900/30 flex items-center justify-center text-red-400 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-200 truncate group-hover:text-white transition-colors">
                    {fileName}
                  </p>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                    Documento PDF {fileSize ? `• ${formatSize(fileSize)}` : ""}
                  </p>
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-neutral-700 transition-all shrink-0">
                <Download className="h-3.5 w-3.5" />
              </div>
            </a>
          );
        }

        // Render Bookmark Link (text/uri-list or external keys)
        if (mimeType === "text/uri-list") {
          let domain = "";
          try {
            domain = new URL(fileUrl).hostname;
          } catch (e) {
            domain = "Enlace Externo";
          }

          return (
            <a
              key={index}
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="p-4 rounded-2xl border border-neutral-900 bg-neutral-950/30 hover:bg-neutral-950/60 hover:border-neutral-800 transition-all flex items-center justify-between gap-4 max-w-md group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-400 shrink-0">
                  <Link2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-250 truncate group-hover:text-white transition-colors">
                    {fileName || fileUrl}
                  </p>
                  <p className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate">
                    {domain}
                  </p>
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-neutral-700 transition-all shrink-0">
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </a>
          );
        }

        // Generic File Card
        return (
          <a
            key={index}
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="p-4 rounded-2xl border border-neutral-900 bg-neutral-950/30 hover:bg-neutral-950/60 hover:border-neutral-800 transition-all flex items-center justify-between gap-4 max-w-md group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center justify-center text-neutral-400 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-250 truncate group-hover:text-white transition-colors">
                  {fileName}
                </p>
                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                  Archivo {fileSize ? `• ${formatSize(fileSize)}` : ""}
                </p>
              </div>
            </div>
            <div className="h-8 w-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-white group-hover:border-neutral-700 transition-all shrink-0">
              <Download className="h-3.5 w-3.5" />
            </div>
          </a>
        );
      })}
    </div>
  );
}
