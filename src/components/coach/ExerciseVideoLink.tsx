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
 *
 * ── WHY COMPACT MODE SHOWS A PICTURE ────────────────────────────────
 * It used to be a 32px circle with a play triangle in it. A user who
 * had been through the app asked us to add exercise images, because
 * "some naive users might not be conversant with the postures" — the
 * demos were already there, sitting behind an affordance that looked
 * like a generic button. The feature was not missing; it was invisible.
 *
 * A still frame from the demo fixes that: the row now shows the
 * movement rather than describing it, which is the actual request.
 *
 * Two constraints shape the implementation. Thumbnails are `mqdefault`
 * (320×180, ~10KB) and lazy-loaded, because a plan card can hold six
 * rows and a large share of users are on metered Nigerian mobile data.
 * And `onError` falls back to the glyph, because YouTube serves a
 * placeholder or a 404 for deleted uploads — a broken-image icon in a
 * plan card looks far worse than the button we started with.
 */
export function ExerciseVideoLink({
  video,
  compact = false,
}: ExerciseVideoLinkProps) {
  const [open, setOpen] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  const showThumb = compact && video.youtubeId !== null && !thumbFailed;

  /** Shared tile chrome, so both branches keep the same row rhythm. */
  const tileClass =
    "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-rule bg-paper outline-none transition-all hover:border-indigo/40 focus-visible:ring-2 focus-visible:ring-indigo/50 active:scale-95";

  const thumb = showThumb ? (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setThumbFailed(true)}
        className="absolute inset-0 size-full object-cover"
      />
      {/* Scrim: thumbnails vary wildly in brightness and the glyph has
          to stay readable on a white-gym-wall frame as well as a dark
          one. */}
      <span className="absolute inset-0 bg-ink/35" aria-hidden />
      <Play
        className="relative size-3 fill-ink text-ink drop-shadow"
        strokeWidth={0}
      />
    </>
  ) : null;

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
            ? tileClass
            : "inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-3 py-1.5 text-[13px] font-medium text-ink-muted outline-none transition-all hover:border-indigo/30 hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50 active:scale-[0.98]"
        }
      >
        <Search className="size-3 text-indigo" strokeWidth={2.5} />
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
            ? tileClass
            : "inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-3 py-1.5 text-[13px] font-medium text-ink-muted outline-none transition-all hover:border-indigo/30 hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50 active:scale-[0.98]"
        }
      >
        {thumb ?? (
          <Play
            className="size-3 fill-indigo text-indigo"
            strokeWidth={0}
          />
        )}
        {!compact && video.exercise}
      </DialogTrigger>

      <DialogContent className="max-w-xl gap-0 overflow-hidden border-rule bg-paper-raised p-0 text-ink">
        <DialogHeader className="space-y-1 px-5 pb-3 pt-5">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em] text-ink">
            {video.exercise}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            <RotateCw className="size-3" strokeWidth={2} />
            Short demo on loop · muted
          </DialogDescription>
        </DialogHeader>

        {/* Mount the player only while open so audio and network stop on close */}
        {open && (
          <iframe
            className="aspect-video w-full bg-paper"
            src={embedSrc}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3.5">
          <p className="truncate text-xs text-ink-muted">{video.title}</p>
          <a
            href={fullVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-indigo/70 outline-none transition-colors hover:text-indigo focus-visible:ring-2 focus-visible:ring-indigo/50"
          >
            YouTube
            <ExternalLink className="size-3" strokeWidth={2} />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}