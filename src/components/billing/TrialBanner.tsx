// src/components/billing/TrialBanner.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Timer, X } from "lucide-react";

import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";
import {
  isComped,
  loadBilling,
  trialDaysLeft,
  type BillingRecord,
} from "@/lib/subscription";

/**
 * Trial countdown.
 *
 * Appears only in the LAST THREE DAYS. A banner from day one is
 * furniture — people stop seeing it long before it matters, and by the
 * time the deadline is real it has become invisible. Showing it late
 * means it still reads as information rather than nagging.
 *
 * Dismissible, and the dismissal is remembered per remaining-day count
 * so it can reappear once when the number actually changes.
 */
const DISMISS_KEY = "adimfit:trial-banner-dismissed";
const SHOW_WITHIN_DAYS = 3;

export function TrialBanner() {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [billing, setBilling] = useState<BillingRecord | null>(null);
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    loadBilling(user.uid).then((record) => {
      if (!cancelled) setBilling(record);
    });

    try {
      setDismissedAt(window.localStorage.getItem(DISMISS_KEY));
    } catch {
      // Private browsing can throw — treat as not dismissed.
    }

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!billing || billing.status !== "trialing" || isComped(billing)) {
    return null;
  }

  const daysLeft = trialDaysLeft(billing);
  if (daysLeft === 0 || daysLeft > SHOW_WITHIN_DAYS) return null;

  // Dismissal is keyed to the day count, so it returns once when the
  // number drops rather than staying hidden until the trial ends.
  if (dismissedAt === String(daysLeft)) return null;

  function dismiss() {
    setDismissedAt(String(daysLeft));
    try {
      window.localStorage.setItem(DISMISS_KEY, String(daysLeft));
    } catch {
      // Non-fatal.
    }
  }

  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
        transition: { duration: 0.28, ease: "easeOut" as const },
      };

  return (
    <AnimatePresence>
      <motion.div
        {...motionProps}
        className="flex items-center gap-3 rounded-md border border-indigo/20 bg-indigo/[0.05] px-4 py-3"
      >
        <Timer
          className="size-4 shrink-0 text-indigo"
          strokeWidth={2}
          aria-hidden
        />

        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">
            {daysLeft} day{daysLeft === 1 ? "" : "s"} left
          </span>{" "}
          of your free trial.
        </p>

        <Link
          href="/profile"
          onClick={() => track("paywall_shown", { trigger: "trial_banner" })}
          className="hidden shrink-0 items-center gap-1 rounded-full bg-indigo px-3.5 py-1.5 text-[12px] font-semibold text-on-indigo outline-none transition-all hover:bg-indigo-lift focus-visible:ring-2 focus-visible:ring-indigo/60 active:translate-y-px sm:flex"
        >
          Subscribe
          <ArrowRight className="size-3" strokeWidth={2.5} />
        </Link>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-ink-muted outline-none transition-colors hover:bg-paper-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}