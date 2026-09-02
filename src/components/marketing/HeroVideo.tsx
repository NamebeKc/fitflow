// src/components/marketing/HeroVideo.tsx
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * ── HERO BACKGROUND ─────────────────────────────────────────────────
 * The POSTER is the LCP element. The video is an enhancement layered
 * on top once we know it's safe to fetch.
 *
 * That ordering is the whole point. A 5-second webm is 1–3MB even well
 * encoded; on a Lagos 3G connection that's several seconds of empty
 * hero if the browser waits for it. The poster paints immediately, the
 * video fades in when it can, and LCP is measured against something
 * that was always going to arrive fast.
 *
 * Three cases where the video never loads at all:
 *
 *   • `prefers-reduced-motion` — autoplaying motion at someone who has
 *     asked their OS to stop it is an accessibility failure, not a
 *     nice-to-have.
 *   • Data Saver (`connection.saveData`) — the user has explicitly
 *     asked not to be sent heavy media.
 *   • 2G / slow-2G effective type — the video would finish after
 *     they've left.
 *
 * In all three the poster is the hero, and it looks deliberate rather
 * than broken.
 * ─────────────────────────────────────────────────────────────────────
 */

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Decided after mount so the server-rendered HTML is always the
    // lightweight version — no video markup ships to a client that
    // shouldn't fetch it.
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reducedMotion) return;

    const connection = (
      navigator as Navigator & { connection?: NetworkInformation }
    ).connection;

    if (connection?.saveData) return;
    if (
      connection?.effectiveType === "2g" ||
      connection?.effectiveType === "slow-2g"
    ) {
      return;
    }

    setShouldLoad(true);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {/*
        Explicit width/height reserve the aspect ratio before any bytes
        arrive, which is what keeps CLS at zero. `fetchPriority="high"`
        and the absence of `loading="lazy"` are deliberate — lazy on a
        hero defers the fetch and directly delays LCP.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-poster.webp"
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />

      {shouldLoad && (
        <video
          ref={videoRef}
          width={1920}
          height={1080}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/hero-poster.webp"
          onCanPlay={() => setReady(true)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ${
            ready ? "opacity-100" : "opacity-0"
          }`}
        >
          <source src="/hero.webm" type="video/webm" />
          {/* Safari before 16 has no VP9/webm support. */}
          <source src="/hero.mp4" type="video/mp4" />
        </video>
      )}

      {/*
        SCRIMS — these compound, which is easy to get wrong.

        An earlier version used a flat 70% wash plus an 85% horizontal
        gradient. Individually each looked reasonable; stacked, the left
        third of the frame reached ~95% opacity and the video was
        effectively invisible.

        The rule: only ONE layer may be heavy, and it must be the one
        sitting under the text. Everything else stays light.
      */}

      {/* Heavy only where the headline sits, clearing by mid-frame so
          the footage is visible on the right. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#090A0C] from-5% via-[#090A0C]/75 via-45% to-[#090A0C]/15" />

      {/* A light overall wash. Its job is insurance against a bright
          frame in the loop, not darkening — hence 25%, not 70%. */}
      <div className="absolute inset-0 bg-[#090A0C]/25" />

      {/* Bottom fade into the next section, so the band ends rather
          than being cut off. */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#090A0C] via-[#090A0C]/60 to-transparent" />

      {/* Top fade so the nav bar always has something to sit on. */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#090A0C]/80 to-transparent" />
    </div>
  );
}