// src/components/profile/ReminderCard.tsx
"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";
import {
  pushSupport,
  subscribeToPush,
  unsubscribeFromPush,
  type PushSupport,
} from "@/lib/push";

/**
 * ── REMINDERS ───────────────────────────────────────────────────────
 * A tester put it plainly: "I workout daily but I forget to log in."
 * That's not solved by better navigation — it's solved by the app
 * reaching out.
 *
 * Two choices worth defending:
 *
 * The time is the user's, not ours. A reminder at the wrong hour is
 * an interruption; at the right one it's useful. Four options rather
 * than a free-text field keeps it to a single tap.
 *
 * iOS gets the truth. Safari only exposes push to installed PWAs, so
 * an iPhone user in a browser tab is told to install first rather than
 * being offered a toggle that would silently do nothing.
 * ─────────────────────────────────────────────────────────────────────
 */

const TIMES = [
  { hour: 7, label: "Morning", detail: "7am" },
  { hour: 12, label: "Midday", detail: "12pm" },
  { hour: 18, label: "Evening", detail: "6pm" },
  { hour: 20, label: "Night", detail: "8pm" },
];

export function ReminderCard() {
  const { user } = useAuth();
  const [support, setSupport] = useState<PushSupport>("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(18);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupport(pushSupport());

    // Reflect what the browser actually holds rather than what we
    // last wrote — permission can be revoked in settings without the
    // app ever knowing.
    if (typeof Notification !== "undefined") {
      navigator.serviceWorker?.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => {
          setEnabled(
            Boolean(subscription) && Notification.permission === "granted",
          );
        })
        .catch(() => setEnabled(false));
    }
  }, []);

  async function enable(selectedHour: number) {
    if (!user || busy) return;
    setBusy(true);
    setError(null);

    track("push_permission_requested", { hour: selectedHour });
    const idToken = await user.getIdToken();
    const result = await subscribeToPush(idToken, selectedHour);
    setBusy(false);

    if (!result.ok) {
      track("push_permission_denied");
      setError(result.error ?? "Couldn't turn reminders on.");
      return;
    }

    track("push_permission_granted", { hour: selectedHour });
    setHour(selectedHour);
    setEnabled(true);
  }

  async function disable() {
    if (!user || busy) return;
    setBusy(true);
    const idToken = await user.getIdToken();
    await unsubscribeFromPush(idToken);
    setBusy(false);
    setEnabled(false);
    track("reminders_disabled");
  }

  // ── iOS, not installed ───────────────────────────────────────────
  if (support === "needs-install") {
    return (
      <section className="rounded-lg border border-rule bg-paper-raised p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-ink-muted" strokeWidth={2} />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Reminders
          </p>
        </div>
        <p className="mt-3 text-[15px] font-semibold text-ink">
          Add AdimFit to your home screen first
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          iPhone only allows reminders for installed apps. Use the install
          card above, then come back — this will be waiting.
        </p>
      </section>
    );
  }

  if (support === "unsupported") return null;

  return (
    <section
      className={cn(
        "rounded-lg border p-5 sm:p-6",
        enabled
          ? "border-indigo/20 bg-indigo/[0.04]"
          : "border-rule bg-paper-raised",
      )}
    >
      <div className="flex items-center gap-2">
        {enabled ? (
          <Bell className="size-4 text-indigo" strokeWidth={2} />
        ) : (
          <BellOff className="size-4 text-ink-muted" strokeWidth={2} />
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Reminders
        </p>
      </div>

      {enabled ? (
        <>
          <p className="mt-3 text-[15px] font-semibold text-ink">
            On, around {TIMES.find((t) => t.hour === hour)?.detail ?? "6pm"}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            Only on days you haven&apos;t already logged something. Train and
            record it, and you won&apos;t hear from us.
          </p>

          <button
            type="button"
            onClick={() => void disable()}
            disabled={busy}
            className="mt-5 w-full rounded-full border border-rule px-5 py-3 text-sm font-medium text-ink-muted outline-none transition-colors hover:bg-paper-sunken hover:text-ink disabled:opacity-50"
          >
            {busy ? "Turning off…" : "Turn off reminders"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-3 text-[15px] font-semibold text-ink">
            A nudge on days you haven&apos;t trained
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            One notification, at a time you choose. Nothing on days
            you&apos;ve already logged a session.
          </p>

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
                {busy && <Loader2 className="size-3.5 animate-spin text-ink-muted" />}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200"
        >
          {error}
        </p>
      )}

      {enabled && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-ink-muted">
          <Check className="size-3" strokeWidth={3} />
          Change the time by turning off and choosing again
        </p>
      )}
    </section>
  );
}