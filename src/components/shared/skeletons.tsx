import React from "react";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-neutral-900 ${className}`}
      {...props}
    />
  );
}

export function PostCardSkeleton() {
  return (
    <div className="p-6 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      {/* Title */}
      <Skeleton className="h-6 w-3/4 rounded-lg mt-2" />
      {/* Content lines */}
      <div className="space-y-2 mt-1">
        <Skeleton className="h-3.5 w-full rounded-md" />
        <Skeleton className="h-3.5 w-5/6 rounded-md" />
        <Skeleton className="h-3.5 w-2/3 rounded-md" />
      </div>
      {/* Footer / Actions */}
      <div className="flex items-center justify-between mt-4 border-t border-neutral-900/60 pt-4">
        <div className="flex gap-4">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function CommunityCardSkeleton() {
  return (
    <div className="p-5 rounded-3xl border border-neutral-900 bg-neutral-950/40 backdrop-blur-md flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-36 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-8 w-16 rounded-full" />
    </div>
  );
}

export function CommentCardSkeleton() {
  return (
    <div className="pl-4 border-l border-neutral-900 flex flex-col gap-3 py-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-20 rounded-md" />
        <Skeleton className="h-3 w-12 rounded-md" />
      </div>
      <div className="space-y-1.5 pl-8">
        <Skeleton className="h-3 w-full rounded-md" />
        <Skeleton className="h-3 w-4/5 rounded-md" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <PostCardSkeleton />
      <PostCardSkeleton />
      <PostCardSkeleton />
    </div>
  );
}
