// src/components/share/ShareWorkoutDialog.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics";
import { renderShareCard, shareCard } from "@/lib/share-card";
import type { WorkoutEntry } from "@/lib/workouts";

interface ShareWorkoutDialogProps {
  workout: WorkoutEntry | null;
  streakWeeks?: number;
  name?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Preview-then-share.
 *
 * People will not post an image they haven't seen, so the card is
 * rendered and shown before any share action. The preview is the real
 * PNG at display size — not an HTML mock-up of it — so what they post
 * is exactly what they approved.
 */
export function ShareWorkoutDialog({
  workout,
  streakWeeks,
  name,
  open,
  onOpenChange,
}: ShareWorkoutDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);

  // Render whenever the dialog opens for a workout.
  useEffect(() => {
    if (!open || !workout) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    setPreviewUrl(null);
    setBlob(null);

    renderShareCard({ workout, streakWeeks, name })
      .then((rendered) => {
        if (cancelled || !rendered) return;
        objectUrl = URL.createObjectURL(rendered);
        setBlob(rendered);
        setPreviewUrl(objectUrl);
      })
      .catch((error) => {
        console.error("[share] Failed to render card:", error);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, workout, streakWeeks, name]);

  const handleShare = useCallback(async () => {
    if (!blob || !workout || busy) return;
    setBusy(true);
    try {
      const outcome = await shareCard(blob, workout);
      track("workout_shared", {
        outcome,
        activity: workout.activity,
        duration_min: workout.durationMin,
      });
      if (outcome !== "cancelled") onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }, [blob, workout, busy, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden border-white/[0.07] bg-[#14161A] p-0 text-white">
        <DialogHeader className="space-y-1 px-5 pb-4 pt-5">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em] text-white">
            Share your session
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
            1080 × 1080 · ready to post
          </DialogDescription>
        </DialogHeader>

        <div className="px-5">
          <div className="aspect-square w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-black/40">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Your workout card"
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center">
                <Loader2
                  className="size-6 animate-spin text-white/50"
                  strokeWidth={2}
                />
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={!blob || busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-5 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_-10px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14161A] active:scale-[0.99] disabled:opacity-40 disabled:shadow-none"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
            ) : (
              <>
                <ShareIcon />
                Share
              </>
            )}
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-white/50">
            On desktop this saves the image so you can post it yourself.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Share on mobile, download on desktop — the icon should match what
 * will actually happen, so it's chosen from capability rather than
 * assumed.
 */
function ShareIcon() {
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function";

  return canShareFiles ? (
    <Share2 className="size-4" strokeWidth={2.5} />
  ) : (
    <Download className="size-4" strokeWidth={2.5} />
  );
}