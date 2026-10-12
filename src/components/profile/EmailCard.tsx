// src/components/profile/EmailCard.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, MailX } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";

/**
 * ── EMAIL PREFERENCES ───────────────────────────────────────────────
 * One switch, and it governs one thing: the mail we send because we
 * would like you back. The weekly summary, the trial reminders, the
 * nudge after a quiet fortnight.
 *
 * WHAT IT DELIBERATELY CANNOT TURN OFF. Receipts, failed payments and
 * cancellation confirmations. Those are the consequence of someone's
 * own money moving, and "stop telling me what you charged me" is not
 * a preference a paid product gets to honour. The card SAYS so, in the
 * list underneath, rather than quietly omitting them — a settings page
 * that hides which mail is unconditional is the reason people stop
 * trusting settings pages.
 *
 * Both lists come from the server, derived from EMAIL_KINDS, so adding
 * a seventh message type changes this card without anyone editing it.
 *
 * OPTIMISTIC, WITH A REAL ROLLBACK. The switch moves on tap and goes
 * back if the write fails, with the reason shown. The alternative — a
 * spinner on a toggle — makes a one-bit setting feel like a
 * transaction.
 */

interface Preferences {
  lifecycle: boolean;
  optional: string[];
  always: string[];
}

export function EmailCard() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFailed(false);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/email/preferences", {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(String(response.status));
      const data = (await response.json()) as Preferences;
      setPreferences(data);
    } catch {
      // Showing "off" because a read failed would invite someone to
      // turn on mail that was never off. Show nothing instead.
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function change(next: boolean) {
    if (!user || !preferences) return;
    const previous = preferences.lifecycle;
    setPreferences({ ...preferences, lifecycle: next });
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/email/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lifecycle: next }),
      });
      if (!response.ok) throw new Error(String(response.status));
      track("email_preferences_changed", { lifecycle: next });
    } catch {
      setPreferences({ ...preferences, lifecycle: previous });
      setError("Couldn't save that. Please try again.");
    }
  }

  if (loading) {
    // Mirrors the card's geometry so the swap causes no shift.
    return (
      <section className="rounded-lg border border-rule bg-paper-raised p-6">
        <Skeleton className="h-3 w-16 rounded bg-paper-sunken" />
        <div className="mt-3 flex items-start justify-between gap-6">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48 rounded-sm bg-paper-sunken" />
            <Skeleton className="h-3 w-full max-w-72 rounded bg-paper-sunken" />
          </div>
          <Skeleton className="h-6 w-11 rounded-full bg-paper-sunken" />
        </div>
      </section>
    );
  }

  // A settings card that cannot read its own setting is worse than
  // absent, so it says so and offers the retry rather than guessing.
  if (failed || !preferences) {
    return (
      <section className="rounded-lg border border-rule bg-paper-raised p-6">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-ink-muted" strokeWidth={2} />
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
            Email
          </p>
        </div>
        <p className="mt-3 text-[15px] font-semibold text-ink">
          Couldn&apos;t load your email settings
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-full border border-rule px-5 py-2.5 text-[13px] font-medium text-ink-muted outline-none transition-colors hover:bg-paper-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-moss"
        >
          Try again
        </button>
      </section>
    );
  }

  const on = preferences.lifecycle;

  return (
    <section
      className={cn(
        "rounded-lg border p-6",
        on ? "border-moss/25 bg-lime-wash" : "border-rule bg-paper-raised",
      )}
    >
      <div className="flex items-center gap-2">
        {on ? (
          <Mail className="size-4 text-moss" strokeWidth={2} />
        ) : (
          <MailX className="size-4 text-ink-muted" strokeWidth={2} />
        )}
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
          Email
        </p>
      </div>

      <div className="mt-3 flex items-start justify-between gap-6">
        <div>
          <p id="email-lifecycle-label" className="text-[15px] font-semibold text-ink">
            Training email
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            {on
              ? "Your week in numbers on Mondays, and a check-in if you go quiet. Nothing daily."
              : "Off. You'll still get anything about a payment."}
          </p>
        </div>

        <Switch
          checked={on}
          onCheckedChange={(next) => void change(next)}
          aria-labelledby="email-lifecycle-label"
        />
      </div>

      {preferences.optional.length > 0 && (
        <ul className="mt-5 space-y-1.5 border-t border-rule pt-5">
          {preferences.optional.map((label) => (
            <li
              key={label}
              className={cn(
                "flex items-center justify-between text-[13px]",
                on ? "text-ink" : "text-ink-faint",
              )}
            >
              <span>{label}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
                {on ? "On" : "Off"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {preferences.always.length > 0 && (
        <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink">Always sent:</span>{" "}
          {preferences.always.join(", ").toLowerCase()}. Those aren&apos;t
          optional on a paid account.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/25 bg-laterite-wash px-3.5 py-2.5 text-[13px] leading-relaxed text-danger"
        >
          {error}
        </p>
      )}
    </section>
  );
}
