// src/components/onboarding/ReminderPrompt.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Loader2, X } from "lucide-react";

import { track } from "@/lib/analytics";
import { useAuth } from "@/components/providers/AuthProvider";
import { pushSupport, subscribeToPush } from "@/lib/push";

/**
 * ── THE ASK, AT THE MOMENT IT MAKES SENSE ───────────────────────────
 * Reminders live on the Profile tab, which means almost nobody finds
 * them. This surfaces the same choice straight after someone logs
 * their first session — the one moment we know they care.
 *
 * WHY A CARD AND NOT A DIALOG. The share sheet has just closed. A
 * second modal stacked on the first reads as nagging, and the request
 * we are about to make is one a browser only grants once. A prominent
 * card asks without cornering anyone.
 *
 * WHY OUR UI BEFORE THE BROWSER'S. The native permission prompt is a
 * single irreversible shot — a denial is close to permanent, and most
 * people never find the setting that undoes it. Asking in our own
 * words first means a "not now" costs us nothing: they can still say
 * yes later from Profile. `subscribeToPush` is only reached by a tap
 * on a specific time, so the browser prompt always follows a real,
 * informed gesture.
 *
 * This component decides for itself whether it should appear at all —
 * the page just says "a first workout happened".
 * ─────────────────────────────────────────────────────────────────────
 */

const DISMISS_KEY = "adimfit:reminder-prompt-dismissed";

/**
 * Kept in step with ReminderCard's list by hand. If a third surface
 * ever needs these, lift them into `lib/push.ts` rather than copying
 * again.
 */
const TIMES = [
  { hour: 7, label: "Morning", detail: "7am" },
  { hour: 12, label: "Midday", detail: "12pm" },
  { hour: 18, label: "Evening", detail: "6pm" },
  { hour: 20, label: "Night", detail: "8pm" },
];

interface ReminderPromptProps {
  /** The page's signal that a first workout was just logged. */
  open: boolean;
  onDismiss: () => void;
}

export function ReminderPrompt({ open, onDismiss }: ReminderPromptProps) {
  const { user } = useAuth();
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shownRef = useRef(false);

  // Three reasons not to appear: the browser can't do push, this
  // person already subscribed, or they've turned the card down before.
  // All are resolved here so the page never has to think about it.
  useEffect(() => {
    if (!open) return;

    if (pushSupport() !== "supported") return;

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "true";
    } catch {
      // Private browsing can throw — treat as not dismissed.
    }
    if (dismissed) return;

    let cancelled = false;
    navigator.serviceWorker?.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (cancelled) return;
        const already =
          Boolean(subscription) && Notification.permission === "granted";
        setEligible(!already);
      })
      .catch(() => {
        if (!cancelled) setEligible(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const visible = open && eligible;

  // Fired once per appearance, and only when it truly renders — an
  // opt-in rate is meaningless without a denominator.
  useEffect(() => {
    if (visible && !shownRef.current) {
      shownRef.current = true;
      track("reminder_prompt_shown", { trigger: "post_first_log" });
    }
  }, [visible]);

  function remember() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // Non-fatal: worst case they see it once more.
    }
  }

  function dismiss() {
    remember();
    track("reminder_prompt_dismissed", { trigger: "post_first_log" });
    onDismiss();
  }

  async function enable(hour: number) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);

    // `source` separates this surface from the Profile card, so the
    // two placements can be compared rather than pooled.
    track("push_permission_requested", { hour, source: "post_first_log" });

    const idToken = await user.getIdToken();
    const result = await subscribeToPush(idToken, hour);
    setBusy(false);

    if (!result.ok) {
      track("push_permission_denied", { source: "post_first_log" });
      setError(result.error ?? "Couldn't turn reminders on.");
      return;
    }

    track("push_permission_granted", { hour, source: "post_first_log" });
    // Granted is also an answer — never ask again from here.
    remember();
    onDismiss();
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-lg border border-indigo/25 bg-indigo/[0.05] p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <Bell
              className="mt-0.5 size-4 shrink-0 text-indigo"
              strokeWidth={2}
              aria-hidden
            />

            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
                First one logged
              </p>
              <p className="mt-2 text-[15px] font-semibold text-ink">
                Want a nudge on days you haven&apos;t trained?
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
                One notification, at a time you pick. Nothing on days
                you&apos;ve already logged a session.
              </p>
            </div>

            <button
              type="button"
              onClick={dismiss}
              aria-label="Not now"
              className="flex size-7 shrink-0 items-center justify-center rounded-sm text-ink-muted outline-none transition-colors hover:bg-paper-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50"
            >
              <X className="size-3.5" strokeWidth={2.5} />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {TIMES.map((time) => (
              <button
                key={time.hour}
                type="button"
                onClick={() => void enable(time.hour)}
                disabled={busy}
                className="flex items-center justify-between rounded-md border border-rule bg-ink/30 px-4 py-3 text-left outline-none transition-all hover:border-indigo/30 focus-visible:ring-2 focus-visible:ring-indigo/50 active:translate-y-px disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-medium text-ink">
                    {time.label}
                  </span>
                  <span className="block font-mono text-[11px] text-ink-muted">
                    {time.detail}
                  </span>
                </span>
                {busy && (
                  <Loader2 className="size-3.5 animate-spin text-ink-muted" />
                )}
              </button>
            ))}
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={dismiss}
            className="mt-3 w-full rounded-full px-5 py-2.5 text-[13px] font-medium text-ink-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/40"
          >
            Not now
          </button>
        </motion.section>
      )}
    </AnimatePresence>
  );
}