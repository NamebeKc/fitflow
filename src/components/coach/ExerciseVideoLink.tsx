// src/components/coach/ExerciseVideoLink.tsx
"use client";

import { useState } from "react";
import { ExternalLink, Play, RotateCw, Search } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { searchUrlFor, type ExerciseVideo } from "@/lib/exercise-videos";
import { track } from "@/lib/analytics";

interface ExerciseVideoLinkProps {
  video: ExerciseVideo;
  /**
   * Icon-only, for use inside a plan card row where the exercise name
   * is already on screen and repeating it would be noise.
   */
  compact?: boolean;
}

/**
 * Compact "see how to do it" link that opens a popup demo player.
 *
 * DialogTrigger renders a <button> itself, so the pill styling goes
 * directly on it — no wrapper and no `asChild`, which keeps this
 * compatible with both the Base UI and Radix flavours of shadcn's
 * Dialog.
 *
 * Every library entry is a short-form demo, so the whole video is the
 * demonstration: it autoplays muted and loops natively (`loop=1`
 * requires `playlist` set to the same video ID — a YouTube quirk).
 * Muted autoplay is what browsers require for looping; the footer link
 * opens the video on YouTube proper, with sound.
 */
export function ExerciseVideoLink({
  video,
  compact = false,
}: ExerciseVideoLinkProps) {
  const [open, setOpen] = useState(false);

  const embedSrc =
    `https://www.youtube-nocookie.com/embed/${video.youtubeId}` +
    `?autoplay=1&mute=1&loop=1&playlist=${video.youtubeId}&rel=0&modestbranding=1`;
  const fullVideoUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;

  // No curated video for this movement — open a YouTube search instead
  // of an empty player. A link that finds something beats an embed
  // that shows nothing.
  if (!video.youtubeId) {
    return (
      <a
        href={searchUrlFor(video)}
        onClick={() =>
          track("exercise_video_opened", {
            exercise: video.exercise,
            curated: false,
          })
        }
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Search YouTube for ${video.exercise} technique`}
        className={
          compact
            ? "flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 outline-none transition-all hover:border-[#CCFF00]/40 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-95"
            : "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white/60 outline-none transition-all hover:border-[#CCFF00]/30 hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.98]"
        }
      >
        <Search className="size-3 text-[#CCFF00]" strokeWidth={2.5} />
        {!compact && video.exercise}
      </a>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          track("exercise_video_opened", {
            exercise: video.exercise,
            curated: video.youtubeId !== null,
          });
        }
        setOpen(next);
      }}
    >
      <DialogTrigger
        aria-label={`How to do ${video.exercise}`}
        className={
          compact
            ? "flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40 outline-none transition-all hover:border-[#CCFF00]/40 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-95"
            : "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[13px] font-medium text-white/60 outline-none transition-all hover:border-[#CCFF00]/30 hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.98]"
        }
      >
        <Play
          className={
            compact
              ? "size-3 fill-[#CCFF00] text-[#CCFF00]"
              : "size-3 fill-[#CCFF00] text-[#CCFF00]"
          }
          strokeWidth={0}
        />
        {!compact && video.exercise}
      </DialogTrigger>

      <DialogContent className="max-w-xl gap-0 overflow-hidden border-white/[0.07] bg-[#14161A] p-0 text-white">
        <DialogHeader className="space-y-1 px-5 pb-3 pt-5">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em] text-white">
            {video.exercise}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
            <RotateCw className="size-3" strokeWidth={2} />
            Short demo on loop · muted
          </DialogDescription>
        </DialogHeader>

        {/* Mount the player only while open so audio and network stop on close */}
        {open && (
          <iframe
            className="aspect-video w-full bg-black"
            src={embedSrc}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <p className="truncate text-xs text-white/50">{video.title}</p>
          <a
            href={fullVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#CCFF00]/70 outline-none transition-colors hover:text-[#CCFF00] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
          >
            YouTube
            <ExternalLink className="size-3" strokeWidth={2} />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}