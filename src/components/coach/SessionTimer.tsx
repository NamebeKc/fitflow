// src/components/coach/SessionTimer.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Play, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  clearSession,
  elapsedToMinutes,
  formatElapsed,
  readSessionStart,
  sessionDateLabel,
  startSession,
  stashDuration,
} from "@/lib/session-timer";

/**
 * ── SESSION STOPWATCH ───────────────────────────────────────────────
 * Counts UP for the whole session, as distinct from `RestTimer`, which
 * counts DOWN between sets. Requested directly by a user: "duration and
 * date while the individual is doing the workout, just as we have in
 * smart watches."
 *
 * Three things make this behave like a watch rather than like a web page:
 *
 *   1. The start time lives on disk (`session-timer.ts`), so locking the
 *      phone, backgrounding the PWA, or a reload mid-session all resume
 *      the same clock instead of losing it.
 *   2. Elapsed time is derived from the wall clock each tick, so
 *      background throttling cannot make it run slow.
 *   3. Stopping hands the duration to the log form, so the number the
 *      watch measured is the number that gets recorded.
 *
 * It deliberately does NOT take a wake lock. `RestTimer` already offers
 * "keep awake" for the mid-set case where you are watching a countdown;
 * holding the screen on for a 45-minute session would cost real battery
 * to display a number nobody is looking at.
 * ─────────────────────────────────────────────────────────────────────
 */
export function SessionTimer() {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [justLogged, setJustLogged] = useState<number | null>(null);
  const [dateLabel, setDateLabel] = useState("");

  const tickRef = useRef<number | null>(null);

  // Read on mount only. Rendering the stored value during SSR would
  // mismatch the server's empty markup and trip hydration.
  useEffect(() => {
    setDateLabel(sessionDateLabel());
    const existing = readSessionStart();
    if (existing !== null) {
      setStartedAt(existing);
      setElapsed(Date.now() - existing);
    }
  }, []);

  useEffect(() => {
    if (startedAt === null) return;

    function tick() {
      setElapsed(Date.now() - (startedAt as number));
      tickRef.current = window.setTimeout(tick, 1000);
    }

    tick();

    return () => {
      if (tickRef.current !== null) window.clearTimeout(tickRef.current);
    };
  }, [startedAt]);

  // A session that spans midnight should not keep yesterday's stamp.
  useEffect(() => {
    setDateLabel(sessionDateLabel());
  }, [Math.floor(elapsed / 60_000)]);

  const handleStart = useCallback(() => {
    const now = startSession();
    setStartedAt(now);
    setElapsed(0);
    setJustLogged(null);
    track("session_timer_started");
  }, []);

  const handleStop = useCallback(() => {
    if (startedAt === null) return;

    const minutes = elapsedToMinutes(Date.now() - startedAt);
    stashDuration(minutes);
    clearSession();

    setStartedAt(null);
    setElapsed(0);
    setJustLogged(minutes);
    track("session_timer_stopped", { duration_min: minutes });
  }, [startedAt]);

  const running = startedAt !== null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-3 py-2 transition-colors",
        running
          ? "border-[#CCFF00]/30 bg-[#CCFF00]/[0.06]"
          : "border-white/[0.07] bg-[#14161A]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
          {dateLabel || " "}
        </span>

        <AnimatePresence mode="wait" initial={false}>
          {running ? (
            <motion.span
              key="elapsed"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="font-mono text-lg tabular-nums leading-none text-[#CCFF00]"
              // Announced on a coarse cadence; a per-second live region
              // would flood a screen reader for 45 minutes.
              aria-live="off"
            >
              {formatElapsed(elapsed)}
            </motion.span>
          ) : justLogged !== null ? (
            <motion.span
              key="logged"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="truncate text-[12px] text-white/70"
            >
              {justLogged} min ready —{" "}
              <Link
                href="/log"
                className="font-medium text-[#CCFF00] underline-offset-2 hover:underline"
              >
                log it
              </Link>
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="truncate text-[12px] text-white/50"
            >
              Time this session
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={running ? handleStop : handleStart}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.97]",
          running
            ? "bg-[#CCFF00] text-black hover:bg-[#d9ff33]"
            : "border border-white/[0.09] bg-black/30 text-white/70 hover:border-[#CCFF00]/30 hover:text-white",
        )}
      >
        {running ? (
          <>
            <Square className="size-3" strokeWidth={2.5} fill="currentColor" />
            Stop
          </>
        ) : (
          <>
            <Play className="size-3" strokeWidth={2.5} fill="currentColor" />
            Start
          </>
        )}
      </button>
    </div>
  );
}
