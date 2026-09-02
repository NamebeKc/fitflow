// src/lib/use-wake-lock.ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ── KEEP THE SCREEN AWAKE ───────────────────────────────────────────
 * Wraps the Screen Wake Lock API.
 *
 * The problem it solves is unglamorous and constant: you put the phone
 * down between sets, it sleeps, and you unlock it again to read the
 * next exercise. Over a 45-minute session that happens a dozen times.
 *
 * Two details the API gets wrong if you use it naively:
 *
 * 1. THE LOCK IS RELEASED AUTOMATICALLY when the tab is hidden — by
 *    switching apps, or by the screen locking before the request lands.
 *    It is NOT restored when you come back. Without re-acquiring on
 *    `visibilitychange`, the toggle silently stops working the first
 *    time someone checks a message.
 *
 * 2. SUPPORT IS NOT UNIVERSAL. Chrome and Android have it; Safari from
 *    16.4. Rather than showing a control that does nothing on older
 *    iPhones, `supported` is reported so the UI can hide it.
 *
 * Battery cost is real, so this is user-controlled rather than
 * automatic. Holding someone's screen on without asking is the kind of
 * thing that gets an app deleted.
 * ─────────────────────────────────────────────────────────────────────
 */

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
  addEventListener: (type: "release", listener: () => void) => void;
}

export function useWakeLock() {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  // Separate from `active`: what the USER asked for, which must
  // survive the browser dropping the lock behind their back.
  const wantedRef = useRef(false);

  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" && "wakeLock" in navigator,
    );
  }, []);

  const acquire = useCallback(async () => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    try {
      const lock = await (
        navigator as Navigator & {
          wakeLock: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
        }
      ).wakeLock.request("screen");

      sentinelRef.current = lock;
      setActive(true);

      // Fires when the browser drops it — tab hidden, battery saver,
      // or the OS deciding otherwise.
      lock.addEventListener("release", () => {
        setActive(false);
        sentinelRef.current = null;
      });
    } catch (error) {
      // Rejected by battery saver or a permissions policy. Not worth
      // interrupting anyone over.
      console.error("[wake-lock] Could not acquire:", error);
      setActive(false);
    }
  }, []);

  const release = useCallback(async () => {
    const lock = sentinelRef.current;
    sentinelRef.current = null;
    setActive(false);
    if (lock && !lock.released) {
      try {
        await lock.release();
      } catch {
        // Already gone — nothing to do.
      }
    }
  }, []);

  /** Turns the lock on or off, and remembers which the user chose. */
  const toggle = useCallback(async () => {
    if (wantedRef.current) {
      wantedRef.current = false;
      await release();
    } else {
      wantedRef.current = true;
      await acquire();
    }
  }, [acquire, release]);

  // Re-acquire when the tab becomes visible again. Without this the
  // lock dies the first time someone checks a notification and never
  // comes back, which reads as the feature being broken.
  useEffect(() => {
    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        wantedRef.current &&
        sentinelRef.current === null
      ) {
        void acquire();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Release on unmount so navigating away doesn't hold the screen.
      wantedRef.current = false;
      void release();
    };
  }, [acquire, release]);

  return { supported, active, toggle };
}