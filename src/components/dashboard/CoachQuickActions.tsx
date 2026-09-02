// src/components/dashboard/CoachQuickActions.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * Entry points into the coach. Each deep-links to /coach with the
 * prompt in the query string, so one tap goes from dashboard to a real
 * coaching answer.
 */
const QUICK_PROMPTS = [
  "Plan today's session",
  "How am I doing this week?",
  "Suggest a recovery day",
];

export function CoachQuickActions({ firstName }: { firstName?: string }) {
  return (
    <section className="flex h-full flex-col rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
        AI Coach
      </p>

      <div className="mt-5 flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.07]">
          <Sparkles className="size-4 text-[#CCFF00]" strokeWidth={2} />
        </div>
        <p className="text-sm leading-relaxed text-white/50">
          {firstName
            ? `Ready when you are, ${firstName}. Ask about today's plan, form, or recovery.`
            : "Ask about today's plan, form, or recovery."}
        </p>
      </div>

      <div className="mt-5 space-y-2">
        {QUICK_PROMPTS.map((prompt) => (
          <Link
            key={prompt}
            href={`/coach?prompt=${encodeURIComponent(prompt)}`}
            className="group flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3 text-sm font-medium text-white/60 outline-none transition-all hover:border-[#CCFF00]/25 hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.99]"
          >
            <span className="truncate">{prompt}</span>
            <ArrowRight
              className="size-4 shrink-0 text-white/40 transition-colors group-hover:text-[#CCFF00]"
              strokeWidth={2}
            />
          </Link>
        ))}
      </div>

      <Link
        href="/coach"
        className="mt-auto flex items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-5 py-3 text-sm font-semibold text-black shadow-[0_10px_40px_-12px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14161A] active:scale-[0.99]"
      >
        Open coach
        <ArrowRight className="size-4" strokeWidth={2.5} />
      </Link>
    </section>
  );
}