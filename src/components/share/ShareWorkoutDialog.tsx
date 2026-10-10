// src/components/share/ShareWorkoutDialog.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ImagePlus, Loader2, Share2, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { track } from "@/lib/analytics";
import { renderShareCard, shareCard } from "@/lib/share-card";
import {
  decodeSharePhoto,
  sharePhotoMessage,
  SharePhotoDecodeError,
  type SharePhoto,
} from "@/lib/share-photo";
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
 *
 * ── THE PHOTO ───────────────────────────────────────────────────────
 * Attaching one is optional and happens here, at share time, not at
 * log time. That ordering is the whole design: the file is picked,
 * decoded into memory, drawn onto the card, and released when this
 * dialog closes. It is never uploaded, never written to Firestore,
 * never cached, and never attached to an analytics property. The only
 * thing that survives is the flattened PNG the user chose to post.
 *
 * Three implementation details that keep that true:
 *
 *   1. `photoRef` mirrors the photo state so `release()` can be called
 *      from effects and handlers without going through a state updater
 *      — React 19 invokes updaters twice in development, and a double
 *      `close()` on a live bitmap is a bug waiting for a dev build.
 *   2. The preview <img> carries `ph-no-capture`. Session replay is
 *      env-gated off today, but if it is ever switched on to study
 *      paywall friction, the user's photo must not be in the recording.
 *   3. The file input is reset to "" on every pick, so choosing the
 *      same file twice still fires `change`.
 * ─────────────────────────────────────────────────────────────────────
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
  const [photo, setPhoto] = useState<SharePhoto | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [busy, setBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<SharePhoto | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  /** Swaps the preview, revoking the URL the browser is done with. */
  const setPreview = useCallback((url: string | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }, []);

  /** Swaps the photo, freeing whatever it replaces. */
  const replacePhoto = useCallback((next: SharePhoto | null) => {
    photoRef.current?.release();
    photoRef.current = next;
    setPhoto(next);
  }, []);

  // Render whenever the dialog opens, or the attached photo changes.
  // The previous preview is deliberately left on screen while the next
  // one rasterises — blanking it makes attaching a photo feel like the
  // card broke and came back.
  useEffect(() => {
    if (!open || !workout) return;

    let cancelled = false;
    setRendering(true);

    renderShareCard({ workout, streakWeeks, name, photo })
      .then((rendered) => {
        if (cancelled || !rendered) return;
        setBlob(rendered);
        setPreview(URL.createObjectURL(rendered));
      })
      .catch((error) => {
        console.error("[share] Failed to render card:", error);
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, workout, streakWeeks, name, photo, setPreview]);

  // Closing the dialog is what guarantees the photo is gone. Anything
  // that leaves this component mounted with a stale bitmap is a leak.
  useEffect(() => {
    if (open) return;
    setPreview(null);
    setBlob(null);
    setPhotoError(null);
    replacePhoto(null);
  }, [open, setPreview, replacePhoto]);

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      photoRef.current?.release();
    },
    [],
  );

  const handlePick = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      setPhotoError(null);
      try {
        const decoded = await decodeSharePhoto(file);
        replacePhoto(decoded);
        // No dimensions, no filename, no size — the fact that a photo
        // was attached is the only thing worth knowing, and the only
        // thing safe to send.
        track("share_photo_attached");
      } catch (error) {
        replacePhoto(null);
        setPhotoError(
          sharePhotoMessage(
            error instanceof SharePhotoDecodeError
              ? error.reason
              : "decode-failed",
          ),
        );
      }
    },
    [replacePhoto],
  );

  const handleRemovePhoto = useCallback(() => {
    replacePhoto(null);
    setPhotoError(null);
    track("share_photo_removed");
  }, [replacePhoto]);

  const handleShare = useCallback(async () => {
    if (!blob || !workout || busy) return;
    setBusy(true);
    try {
      const outcome = await shareCard(blob, workout);
      track("workout_shared", {
        outcome,
        activity: workout.activity,
        duration_min: workout.durationMin,
        has_photo: photo !== null,
      });
      if (outcome !== "cancelled") onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }, [blob, workout, busy, photo, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden border-rule bg-paper-raised p-0 text-ink">
        <DialogHeader className="space-y-1 px-6 pb-4 pt-6">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em] text-ink">
            Share your session
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
            1080 × 1080 · ready to post
          </DialogDescription>
        </DialogHeader>

        <div className="px-6">
          <div className="relative aspect-square w-full overflow-hidden rounded-md border border-rule bg-paper">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Your workout card"
                className="ph-no-capture size-full object-cover"
              />
            ) : (
              <Skeleton className="size-full rounded-md bg-paper-sunken" />
            )}

            <AnimatePresence>
              {rendering && previewUrl ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="absolute inset-0 flex items-end bg-ink/30 backdrop-blur-[2px]"
                >
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.9, ease: "easeInOut" }}
                    className="h-[3px] w-full origin-left bg-indigo"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Photo controls ───────────────────────────────────────── */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-3 rounded-md border border-rule bg-paper-sunken px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                {photo ? "Photo attached" : "Photo"}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                {photo
                  ? "Added to the card. Location data is stripped."
                  : "Optional. It stays on your device — we never upload it."}
              </p>
            </div>

            {photo ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-ink-muted hover:bg-paper-sunken hover:text-ink"
                >
                  Change
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove photo"
                  onClick={handleRemovePhoto}
                  className="text-ink-muted hover:bg-paper-sunken hover:text-ink"
                >
                  <X strokeWidth={2.5} />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 border-rule bg-paper-sunken text-ink hover:bg-paper-sunken"
              >
                <ImagePlus data-icon="inline-start" strokeWidth={2.5} />
                Attach
              </Button>
            )}
          </div>

          <AnimatePresence>
            {photoError ? (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden pt-2 text-[11px] text-red-400/90"
                role="status"
              >
                {photoError}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {/*
            No `capture` attribute: leaving it off lets the OS offer both
            the camera and the library. Forcing the camera is the wrong
            default for a card someone is making after the session.
          */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(event) => void handlePick(event)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>

        <div className="px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={() => void handleShare()}
            disabled={!blob || busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-indigo px-6 py-3 text-sm font-semibold text-on-indigo outline-none transition-all hover:bg-indigo-lift focus-visible:ring-2 focus-visible:ring-indigo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:translate-y-px disabled:opacity-40 disabled:shadow-none"
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

          <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-muted">
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
