"use client";

import React, { useState } from "react";
import { ArrowBigUp, ArrowBigDown, MessageSquare, Bookmark, FileText, Video, Music, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileUrl: string;
}

export interface PostCardProps {
  id: string;
  title: string;
  content: string;
  communitySlug: string;
  communityName: string;
  authorName: string;
  authorAvatar?: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  upvotesCount: number;
  commentsCount: number;
  hasAcceptedAnswer?: boolean;
  attachments?: Attachment[];
}

export function PostCard({
  title,
  content,
  communitySlug,
  communityName,
  authorName,
  authorAvatar,
  category,
  tags = [],
  createdAt,
  upvotesCount: initialUpvotes,
  commentsCount,
  hasAcceptedAnswer = false,
  attachments = [],
}: PostCardProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const handleVote = (type: "up" | "down") => {
    if (userVote === type) {
      // Undo vote
      setUpvotes(prev => (type === "up" ? prev - 1 : prev + 1));
      setUserVote(null);
    } else {
      // Apply new vote or switch vote
      const difference = type === "up"
        ? (userVote === "down" ? 2 : 1)
        : (userVote === "up" ? -2 : -1);
      setUpvotes(prev => prev + difference);
      setUserVote(type);
    }
  };

  const getAttachmentIcon = (mimeType: string) => {
    if (mimeType.startsWith("video/")) return <Video className="h-3.5 w-3.5" />;
    if (mimeType.startsWith("audio/")) return <Music className="h-3.5 w-3.5" />;
    if (mimeType.startsWith("image/")) return null; // Rendered in preview
    return <FileText className="h-3.5 w-3.5" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md hover:border-neutral-800/80 hover:bg-neutral-950/60 transition-all duration-300 flex flex-col gap-4 text-left shadow-sm shadow-black/10"
    >
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt={authorName}
              className="h-8 w-8 rounded-full border border-neutral-800 object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center text-xs font-semibold text-white">
              {authorName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer">
                r/{communitySlug}
              </span>
              <span className="text-[10px] text-neutral-600">&bull;</span>
              <span className="text-xs text-neutral-400">{authorName}</span>
            </div>
            <span className="text-[10px] text-neutral-500 mt-0.5">{createdAt}</span>
          </div>
        </div>

        {/* Badges / Status */}
        <div className="flex items-center gap-2">
          {category && (
            <span className="inline-flex items-center rounded-full bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
              {category}
            </span>
          )}
          {hasAcceptedAnswer && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-900/60 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Resuelto
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-100 group-hover:text-white transition-colors leading-snug">
          {title}
        </h2>
        <p className="text-sm text-neutral-400 font-light leading-relaxed line-clamp-3">
          {content}
        </p>
      </div>

      {/* Image attachments preview if exists */}
      {attachments.some(att => att.mimeType.startsWith("image/")) && (
        <div className="overflow-hidden rounded-2xl border border-neutral-900/60 bg-neutral-900/30">
          <img
            src={attachments.find(att => att.mimeType.startsWith("image/"))?.fileUrl}
            alt="Attachment Preview"
            className="w-full max-h-72 object-cover object-center group-hover:scale-[1.01] transition-transform duration-500"
          />
        </div>
      )}

      {/* Non-image Attachments List */}
      {attachments.filter(att => !att.mimeType.startsWith("image/")).length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {attachments
            .filter(att => !att.mimeType.startsWith("image/"))
            .map(att => (
              <a
                key={att.id}
                href={att.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-900 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:border-neutral-800 transition-all cursor-pointer shadow-sm shadow-black/20"
              >
                {getAttachmentIcon(att.mimeType)}
                <span className="max-w-[120px] truncate">{att.fileName}</span>
              </a>
            ))}
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-neutral-900/60 pt-4 mt-2">
        {/* Vote buttons */}
        <div className="flex items-center rounded-full bg-neutral-950 border border-neutral-900 p-0.5 shadow-inner">
          <button
            onClick={() => handleVote("up")}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              userVote === "up"
                ? "text-blue-500 bg-blue-950/20"
                : "text-neutral-500 hover:text-neutral-200"
            }`}
          >
            <ArrowBigUp className="h-4.5 w-4.5" />
          </button>
          <span className="px-2 text-xs font-semibold text-neutral-300 min-w-[20px] text-center">
            {upvotes}
          </span>
          <button
            onClick={() => handleVote("down")}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              userVote === "down"
                ? "text-red-500 bg-red-950/20"
                : "text-neutral-500 hover:text-neutral-200"
            }`}
          >
            <ArrowBigDown className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Comment and Bookmark */}
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-1.5 rounded-full bg-neutral-950 border border-neutral-900 px-3 py-1.5 text-xs text-neutral-400 hover:text-white hover:border-neutral-800 transition-all cursor-pointer">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{commentsCount}</span>
          </button>
          <button
            onClick={() => setIsBookmarked(prev => !prev)}
            className={`p-1.5 rounded-full bg-neutral-950 border border-neutral-900 transition-all cursor-pointer ${
              isBookmarked
                ? "text-yellow-500 border-yellow-950 bg-yellow-950/20"
                : "text-neutral-400 hover:text-white hover:border-neutral-850"
            }`}
          >
            <Bookmark className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
