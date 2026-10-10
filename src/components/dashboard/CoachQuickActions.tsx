// src/components/dashboard/CoachQuickActions.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Entry points into the coach. Each deep-links to /coach with the
 * prompt in the query string, so one tap goes from dashboard to a real
 * coaching answer.
 *
 * SPACING. Every gap here comes from the scale in design.md section
 * 4.3 — 4 / 8 / 12 / 16 / 24 — and obeys its one rule: the gap between
 * two blocks is at least the padding inside them. The prompt rows
 * carry 12px of vertical padding, so they sit 12px apart, not 8px. At
 * 8px the row and the gap were close enough in size that the three
 * rows read as one striped block rather than three targets.
 *
 * The primary action is separated by 24px, not by whatever `mt-auto`
 * happens to leave. `mt-auto` alone pushes it to the bottom of a tall
 * card and flush against the last row in a short one, which is how it
 * ended up touching "Suggest a recovery day". The wrapper keeps the
 * push and adds a floor.
 */
const QUICK_PROMPTS = [
  "Plan today's session",
  "How am I doing this week?",
  "Suggest a recovery day",
];

export function CoachQuickActions({ firstName }: { firstName?: string }) {
  return (
    <section className="flex h-full flex-col rounded-md border border-rule bg-paper-raised p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
        AI Coach
      </p>

      <div className="mt-6 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-indigo/20 bg-indigo-wash">
          <Sparkles className="size-4 text-indigo" strokeWidth={2} />
        </div>
        <p className="text-sm leading-relaxed text-ink-muted">
          {firstName
            ? `Ready when you are, ${firstName}. Ask about today's plan, form, or recovery.`
            : "Ask about today's plan, form, or recovery."}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {QUICK_PROMPTS.map((prompt) => (
          <Link
            key={prompt}
            href={`/coach?prompt=${encodeURIComponent(prompt)}`}
            className="group flex items-center justify-between gap-3 rounded-sm border border-rule bg-paper-sunken px-4 py-3 text-sm font-medium text-ink outline-none transition-colors hover:border-indigo/40 hover:bg-indigo-wash focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised active:translate-y-px"
          >
            <span className="truncate">{prompt}</span>
            <ArrowRight
              className="size-4 shrink-0 text-ink-faint transition-colors group-hover:text-indigo"
              strokeWidth={2}
            />
          </Link>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <Link
          href="/coach"
          className="flex w-full items-center justify-center gap-2 rounded-sm bg-indigo px-6 py-3 text-sm font-semibold text-on-indigo outline-none transition-colors hover:bg-indigo-deep focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2 focus-visible:ring-offset-paper-raised active:translate-y-px"
        >
          Open coach
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}
