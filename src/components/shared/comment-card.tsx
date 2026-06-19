"use client";

import React, { useState } from "react";
import { ArrowBigUp, ArrowBigDown, MessageSquare, Reply } from "lucide-react";
import { motion } from "framer-motion";

export interface CommentCardProps {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string;
  upvotesCount: number;
  replies?: CommentCardProps[];
}

export function CommentCard({
  authorName,
  authorAvatar,
  content,
  createdAt,
  upvotesCount: initialUpvotes,
  replies = [],
}: CommentCardProps) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleVote = (type: "up" | "down") => {
    if (userVote === type) {
      setUpvotes(prev => (type === "up" ? prev - 1 : prev + 1));
      setUserVote(null);
    } else {
      const difference = type === "up"
        ? (userVote === "down" ? 2 : 1)
        : (userVote === "up" ? -2 : -1);
      setUpvotes(prev => prev + difference);
      setUserVote(type);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-3 py-3 border-l border-neutral-900 pl-4 md:pl-6 ml-2 md:ml-4 text-left"
    >
      {/* Header Info */}
      <div className="flex items-center gap-2.5">
        {authorAvatar ? (
          <img
            src={authorAvatar}
            alt={authorName}
            className="h-6 w-6 rounded-full border border-neutral-800 object-cover"
          />
        ) : (
          <div className="h-6 w-6 rounded-full border border-neutral-800 bg-neutral-900 flex items-center justify-center text-[10px] font-semibold text-white">
            {authorName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-xs font-semibold text-neutral-200">{authorName}</span>
        <span className="text-[10px] text-neutral-600">&bull;</span>
        <span className="text-[10px] text-neutral-500">{createdAt}</span>
      </div>

      {/* Content */}
      <p className="text-sm text-neutral-300 font-light leading-relaxed pl-8">
        {content}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-4 pl-8 text-[11px] text-neutral-500">
        {/* Votes */}
        <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-900 rounded-full px-1.5 py-0.5">
          <button
            onClick={() => handleVote("up")}
            className={`p-0.5 rounded-full transition-colors cursor-pointer ${
              userVote === "up" ? "text-blue-500" : "hover:text-neutral-200"
            }`}
          >
            <ArrowBigUp className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] font-semibold px-0.5">{upvotes}</span>
          <button
            onClick={() => handleVote("down")}
            className={`p-0.5 rounded-full transition-colors cursor-pointer ${
              userVote === "down" ? "text-red-500" : "hover:text-neutral-200"
            }`}
          >
            <ArrowBigDown className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Reply toggle */}
        <button
          onClick={() => setShowReplyForm(prev => !prev)}
          className="inline-flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          <Reply className="h-3.5 w-3.5" />
          <span>Responder</span>
        </button>
      </div>

      {/* Mock reply form */}
      {showReplyForm && (
        <div className="pl-8 mt-2 flex flex-col gap-2">
          <textarea
            placeholder="Escribe una respuesta premium..."
            className="w-full max-w-lg min-h-[60px] p-3 text-xs bg-neutral-900 border border-neutral-850 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-700 focus:ring-0 resize-none font-light"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowReplyForm(false)}
              className="rounded-full bg-white text-neutral-950 px-3.5 py-1 text-xs font-semibold hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Enviar
            </button>
            <button
              onClick={() => setShowReplyForm(false)}
              className="rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 px-3.5 py-1 text-xs font-semibold hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Recursive Replies */}
      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map(reply => (
            <CommentCard key={reply.id} {...reply} />
          ))}
        </div>
      )}
    </motion.div>
  );
}
