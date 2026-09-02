// src/components/marketing/FeatureSection.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * ── WHAT IT DOES ────────────────────────────────────────────────────
 * Two decisions carry this section.
 *
 * ASYMMETRY. Three equal cards in a row is the clearest visual signal
 * that a page came from a starter template — the eye reads uniform
 * repetition as "filled in", not "designed". One card carries twice
 * the weight because one of these three claims is the actual product
 * differentiator; the layout should say so before the copy does.
 *
 * NO BACKDROP-FILTER. Glassmorphism is the obvious reach for "premium
 * depth" and it is the wrong one here: `backdrop-filter: blur()`
 * forces GPU compositing on every scroll frame, and six blurred
 * surfaces produce measurable jank on mid-range Android. The same
 * sense of depth comes from a gradient hairline border over a layered
 * surface, which costs nothing at paint time and survives scrolling
 * at 60fps on a ₦80,000 phone.
 *
 * Motion is transform and opacity only — the two properties the
 * compositor can animate without re-layout — and it respects
 * `prefers-reduced-motion`.
 * ─────────────────────────────────────────────────────────────────────
 */

export function FeatureSection() {
  const prefersReducedMotion = useReducedMotion();

  const rise = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-80px" },
          transition: {
            duration: 0.6,
            delay,
            ease: [0.16, 1, 0.3, 1] as const,
          },
        };

  return (
    <section
      id="how-it-works"
      className="relative border-t border-white/[0.06] py-20 md:py-28"
    >
      {/* A single radial bloom, not one per card. One light source reads
          as deliberate; six read as decoration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-[#CCFF00] opacity-[0.05] blur-[130px]"
      />

      <div className="relative mx-auto w-full max-w-[1180px] px-5 md:px-8">
        <motion.header {...rise(0)} className="max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
            How it works
          </p>
          <h2 className="mt-5 text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:text-[2.75rem]">
            Three things, on a loop.
            <span className="block text-white/50">
              Each one makes the next better.
            </span>
          </h2>
        </motion.header>

        {/* Asymmetric: the differentiator gets the span. */}
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <motion.div {...rise(0.08)} className="lg:col-span-2">
            <FeatureCard
              index="01"
              title="Your coach remembers"
              body="Every session you log becomes context. Ask what's next and the answer cites what you actually did — “you squatted 3 × 8 at 60kg Tuesday, today we go for 3 × 10.” A general chatbot starts from zero every time."
              glyph={<MemoryGlyph />}
              wide
            />
          </motion.div>

          <motion.div {...rise(0.16)}>
            <FeatureCard
              index="02"
              title="Three taps to log"
              body="Activity, duration, done. No spreadsheets, no barcode scanning."
              glyph={<LogGlyph />}
            />
          </motion.div>

          <motion.div {...rise(0.24)}>
            <FeatureCard
              index="03"
              title="It adapts to your week"
              body="Hotel room and twenty minutes? The session rebuilds without losing progress."
              glyph={<AdaptGlyph />}
            />
          </motion.div>

          <motion.div {...rise(0.32)} className="lg:col-span-2">
            <FeatureCard
              index="04"
              title="Progress you can see"
              body="Streaks that survive rest days, milestones earned on consistency rather than weight, and a record that follows you across every device."
              glyph={<ProgressGlyph />}
              wide
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/**
 * The card.
 *
 * Depth comes from three stacked layers: a gradient hairline (the
 * `p-px` wrapper), a raised surface, and an interior top-light
 * gradient. All paint-time only — no filters, no compositing.
 */
function FeatureCard({
  index,
  title,
  body,
  glyph,
  wide = false,
}: {
  index: string;
  title: string;
  body: string;
  glyph: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <article className="group h-full rounded-3xl bg-gradient-to-b from-white/[0.10] to-white/[0.02] p-px transition-colors duration-300 hover:from-[#CCFF00]/30">
      <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(1.5rem-1px)] bg-[#101216] p-6 sm:p-8">
        {/* Interior top-light. Suggests a surface catching light from
            above, which is what actually makes a flat rectangle read
            as a physical card. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.05] to-transparent"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div
            className={
              wide
                ? "size-14 text-[#CCFF00] sm:size-16"
                : "size-12 text-[#CCFF00]"
            }
          >
            {glyph}
          </div>
          <span className="font-mono text-[11px] tabular-nums tracking-[0.14em] text-white/50">
            {index}
          </span>
        </div>

        <h3
          className={`relative mt-8 font-semibold tracking-[-0.02em] text-white ${
            wide ? "text-2xl" : "text-lg"
          }`}
        >
          {title}
        </h3>
        <p
          className={`relative mt-3 leading-relaxed text-white/55 ${
            wide ? "max-w-lg text-[15px]" : "text-sm"
          }`}
        >
          {body}
        </p>

        {/* Grows on hover — a transform-only cue that costs nothing. */}
        <div className="relative mt-auto pt-8">
          <div className="h-px w-10 bg-[#CCFF00]/60 transition-all duration-300 group-hover:w-20" />
        </div>
      </div>
    </article>
  );
}

/* ══ Glyphs ═══════════════════════════════════════════════════════ */
/* Drawn rather than imported. A default icon set is one of the
   clearest tells that a page was assembled rather than designed, and
   at this size the difference is obvious. One stroke weight across
   all four; each depicts its actual claim. */

function MemoryGlyph() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
      aria-hidden
    >
      {/* Three past sessions feeding one answer */}
      <rect x="4" y="10" width="20" height="9" rx="3" strokeOpacity="0.3" />
      <rect x="4" y="27" width="20" height="9" rx="3" strokeOpacity="0.5" />
      <rect x="4" y="44" width="20" height="9" rx="3" strokeOpacity="0.7" />
      <path
        d="M24 14.5c10 0 8 17 18 17M24 31.5h18M24 48.5c10 0 8-17 18-17"
        strokeOpacity="0.45"
      />
      <circle cx="48" cy="31.5" r="10" strokeWidth="2.5" />
      <path d="M44 31.5l3 3 6-6.5" strokeWidth="2.5" />
    </svg>
  );
}

function LogGlyph() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
      aria-hidden
    >
      <rect x="10" y="8" width="44" height="48" rx="7" strokeOpacity="0.3" />
      <path d="M20 24h16M20 34h24M20 44h10" strokeOpacity="0.55" />
      {/* Three taps */}
      <circle cx="47" cy="24" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="47" cy="34" r="2.5" fill="currentColor" stroke="none" opacity="0.6" />
      <circle cx="47" cy="44" r="2.5" fill="currentColor" stroke="none" opacity="0.3" />
    </svg>
  );
}

function AdaptGlyph() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
      aria-hidden
    >
      {/* A planned path and the one that actually happened */}
      <path d="M8 44h48" strokeOpacity="0.25" />
      <path d="M8 38c8 0 10-22 20-22s12 22 20 22 8-10 8-10" strokeOpacity="0.3" strokeDasharray="4 5" />
      <path d="M8 38c6 0 8-12 14-12s9 12 14 12 6-6 6-6" strokeWidth="2.5" />
      <circle cx="42" cy="32" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ProgressGlyph() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-full"
      aria-hidden
    >
      <path d="M8 54h48" strokeOpacity="0.3" />
      <rect x="12" y="38" width="9" height="16" rx="2.5" strokeOpacity="0.35" />
      <rect x="27" y="28" width="9" height="26" rx="2.5" strokeOpacity="0.6" />
      <rect
        x="42"
        y="16"
        width="9"
        height="38"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M10 26l12-8 10 6 14-14" strokeWidth="2.5" />
      <path d="M42 10h6v6" strokeWidth="2.5" />
    </svg>
  );
}