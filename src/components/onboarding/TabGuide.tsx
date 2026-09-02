// src/components/onboarding/TabGuide.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Dumbbell,
  Sparkles,
  TrendingUp,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

import { track } from "@/lib/analytics";

/**
 * ── WHERE THINGS LIVE ───────────────────────────────────────────────
 * Built in response to four pilot users, none of whom could find
 * features that already shipped: one asked for an analytics screen
 * (Progress), one asked for a logo (there is one), one asked for
 * exercise videos (they're on plan cards), and one concluded manual
 * logging was impossible while the Log tab sat one tap away.
 *
 * That last case is the argument for this component. He'd done 300
 * skips, wanted to record them, and gave up — not because the feature
 * was missing but because nothing ever told him where it was.
 *
 * Deliberately NOT a modal tour. An interstitial that must be clicked
 * through before using the app is the thing people dismiss without
 * reading, and it delays the first real action. This sits inline on
 * the dashboard, says one line per tab, and goes away when dismissed.
 * ─────────────────────────────────────────────────────────────────────
 */

const DISMISS_KEY = "adimfit:tab-guide-dismissed";

interface TabEntry {
  icon: LucideIcon;
  label: string;
  href: string;
  description: string;
}

const TABS: TabEntry[] = [
  {
    icon: Sparkles,
    label: "Coach",
    href: "/coach",
    description:
      "Ask what to train. It answers from your history, not a template.",
  },
  {
    icon: Dumbbell,
    label: "Log",
    href: "/log",
    description:
      "Record anything you've done — walks, lifts, a run. Three taps.",
  },
  {
    icon: TrendingUp,
    label: "Progress",
    href: "/progress",
    description: "Totals, milestones, and your streak over time.",
  },
  {
    icon: UserRound,
    label: "Profile",
    href: "/profile",
    description: "Your goal, equipment, and how you want to be coached.",
  },
];

export function TabGuide() {
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      // Private browsing can throw — showing it is the safe default.
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setVisible(false);
    track("tab_guide_dismissed");
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Non-fatal.
    }
  }

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.section
        initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
              Where things live
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-white/60">
              Four tabs, that&apos;s the whole app.
            </p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 outline-none transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <ul className="mt-5 space-y-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  onClick={() => track("tab_guide_used", { tab: tab.label })}
                  className="flex items-start gap-3.5 rounded-2xl border border-white/[0.07] bg-black/30 px-4 py-3 outline-none transition-all hover:border-[#CCFF00]/25 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50 active:scale-[0.99]"
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03]">
                    <Icon
                      className="size-4 text-[#CCFF00]"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {tab.label}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-white/55">
                      {tab.description}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-4 w-full text-center font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
        >
          Got it — hide this
        </button>
      </motion.section>
    </AnimatePresence>
  );
}