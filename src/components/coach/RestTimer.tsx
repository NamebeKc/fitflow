// src/components/coach/RestTimer.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Timer as TimerIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useWakeLock } from "@/lib/use-wake-lock";

/**
 * ── REST TIMER ──────────────────────────────────────────────────────
 * Sits above the coach conversation because rest periods are the one
 * thing people need timed mid-set — and the coach is already
 * prescribing them ("60s rest between sets").
 *
 * Timing is derived from a target TIMESTAMP, not by decrementing a
 * counter on an interval. Two reasons: `setInterval` drifts by a few
 * milliseconds per tick, and mobile browsers throttle timers hard in
 * backgrounded tabs — a decrementing counter would silently fall
 * behind while someone's phone is in their pocket, which is exactly
 * when the timer matters. Reading the clock each frame is immune to
 * both.
 * ─────────────────────────────────────────────────────────────────────
 */

const PRESETS = [
  { label: "30s", seconds: 30 },
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
];

export function RestTimer() {
  const prefersReducedMotion = useReducedMotion();
  const wakeLock = useWakeLock();

  /** Wall-clock time the countdown ends. Null when idle or paused. */
  const [endAt, setEndAt] = useState<number | null>(null);
  /** Milliseconds left. Authoritative while paused. */
  const [remaining, setRemaining] = useState(0);
  /** Total for this run, used for the progress bar. */
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState(false);

  const tickRef = useRef<number | null>(null);

  const isRunning = endAt !== null;
  const isActive = isRunning || remaining > 0;

  /* ── Completion feedback ────────────────────────────────────────
     A timer you have to watch is useless mid-set, so finishing has to
     be perceptible without looking. Vibration where supported (Android;
     iOS Safari has no support), plus a short tone. Both are best-effort
     and silently skipped when unavailable. */
  const signalDone = useCallback(() => {
    try {
      navigator.vibrate?.([180, 90, 180]);
    } catch {
      // Unsupported — nothing to do.
    }

    try {
      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtor) return;

      const ctx = new AudioCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.value = 880;
      // Ramp rather than cut, or the tone ends with an audible click.
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      osc.onended = () => void ctx.close();
    } catch {
      // Autoplay policy or no audio device — not worth surfacing.
    }
  }, []);

  /* ── The clock ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (endAt === null) return;

    function tick() {
      const left = Math.max(0, (endAt as number) - Date.now());
      setRemaining(left);

      if (left <= 0) {
        setEndAt(null);
        setFinished(true);
        signalDone();
        return;
      }
      tickRef.current = window.setTimeout(tick, 200);
    }

    tick();

    return () => {
      if (tickRef.current !== null) window.clearTimeout(tickRef.current);
    };
  }, [endAt, signalDone]);

  function start(seconds: number) {
    setTotal(seconds * 1000);
    setRemaining(seconds * 1000);
    setFinished(false);
    setEndAt(Date.now() + seconds * 1000);
    track("rest_timer_started", { seconds });
  }

  function pause() {
    if (endAt === null) return;
    setRemaining(Math.max(0, endAt - Date.now()));
    setEndAt(null);
  }

  function resume() {
    if (remaining <= 0) return;
    setEndAt(Date.now() + remaining);
  }

  function reset() {
    setEndAt(null);
    setRemaining(0);
    setTotal(0);
    setFinished(false);
  }

  const seconds = Math.ceil(remaining / 1000);
  const display = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const progress = total > 0 ? remaining / total : 0;

  /* ── Idle: presets only ─────────────────────────────────────────── */
  if (!isActive && !finished) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto rounded-md border border-rule bg-paper-raised px-3 py-2">
        <TimerIcon
          className="size-3.5 shrink-0 text-ink-muted"
          strokeWidth={2}
          aria-hidden
        />
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
          Rest
        </span>

        <div className="flex items-center gap-1.5">
          {PRESETS.map((preset) => (
            <button
              key={preset.seconds}
              type="button"
              onClick={() => start(preset.seconds)}
              className="shrink-0 rounded-full border border-rule bg-paper-sunken px-2.5 py-1 font-mono text-[11px] tabular-nums text-ink-muted outline-none transition-all hover:border-indigo/30 hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50 active:translate-y-px"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {wakeLock.supported && <KeepAwakeToggle wakeLock={wakeLock} />}
      </div>
    );
  }

  /* ── Running, paused, or just finished ──────────────────────────── */
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border px-3 py-2 transition-colors",
        finished
          ? "border-indigo/40 bg-indigo/[0.10]"
          : "border-rule bg-paper-raised",
      )}
    >
      {/* Progress drains left to right beneath the content */}
      {!finished && (
        <div
          className="absolute inset-y-0 left-0 bg-indigo/[0.07] transition-[width] duration-200 ease-linear"
          style={{ width: `${progress * 100}%` }}
          aria-hidden
        />
      )}

      <div className="relative flex items-center gap-3">
        <motion.div
          animate={
            finished && !prefersReducedMotion
              ? { scale: [1, 1.12, 1] }
              : undefined
          }
          transition={{ duration: 0.45, repeat: finished ? 2 : 0 }}
          className="shrink-0"
        >
          <TimerIcon
            className={cn(
              "size-4",
              finished ? "text-indigo" : "text-ink-muted",
            )}
            strokeWidth={2}
            aria-hidden
          />
        </motion.div>

        <p
          role="status"
          aria-live="polite"
          className={cn(
            "font-mono text-xl tabular-nums tracking-tight",
            finished ? "text-indigo" : "text-ink",
          )}
        >
          {finished ? "Time" : display}
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {wakeLock.supported && <KeepAwakeToggle wakeLock={wakeLock} />}

          {!finished &&
            (isRunning ? (
              <TimerButton onClick={pause} label="Pause timer">
                <Pause className="size-3.5" strokeWidth={2.5} />
              </TimerButton>
            ) : (
              <TimerButton onClick={resume} label="Resume timer" accent>
                <Play className="size-3.5" strokeWidth={2.5} />
              </TimerButton>
            ))}

          <TimerButton onClick={reset} label="Reset timer">
            <RotateCcw className="size-3.5" strokeWidth={2.5} />
          </TimerButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Keep-screen-awake control.
 *
 * Placed beside the timer because that's when it matters — phone down
 * between sets, screen sleeps, unlock again to read the next exercise.
 * User-controlled rather than automatic: holding someone's display on
 * without asking is a battery cost they didn't agree to.
 */
function KeepAwakeToggle({
  wakeLock,
}: {
  wakeLock: { active: boolean; toggle: () => Promise<void> };
}) {
  return (
    <button
      type="button"
      onClick={() => {
        track("screen_wake_lock_toggled", { enabled: !wakeLock.active });
        void wakeLock.toggle();
      }}
      aria-pressed={wakeLock.active}
      aria-label={
        wakeLock.active ? "Let the screen sleep" : "Keep the screen awake"
      }
      title={wakeLock.active ? "Screen stays on" : "Keep screen on"}
      className={cn(
        "ml-auto flex size-8 shrink-0 items-center justify-center rounded-full border outline-none transition-all focus-visible:ring-2 focus-visible:ring-indigo/50 active:scale-95",
        wakeLock.active
          ? "border-indigo/40 bg-indigo/10 text-indigo"
          : "border-rule bg-paper-sunken text-ink-muted hover:text-ink",
      )}
    >
      <Smartphone className="size-3.5" strokeWidth={2} />
    </button>
  );
}

function TimerButton({
  onClick,
  label,
  accent = false,
  children,
}: {
  onClick: () => void;
  label: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-indigo/50 active:scale-95",
        accent
          ? "bg-indigo text-on-indigo hover:bg-indigo-lift"
          : "border border-rule bg-paper-sunken text-ink-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}