// src/app/(app)/billing/cancel/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { track } from "@/lib/analytics";
import {
  guaranteeEndsAt,
  loadBilling,
  withinGuarantee,
  type BillingRecord,
} from "@/lib/subscription";

/**
 * ── CANCELLATION ────────────────────────────────────────────────────
 * This was a `mailto:` link. An email is a dead end on a phone: the
 * user leaves the app, lands in a mail client that may not be set up,
 * and has to compose a message to a stranger to stop paying. Plenty of
 * people simply charge back instead, which costs a fee and a dispute
 * rather than a subscriber.
 *
 * THE PAGE IS NOT A RETENTION TRAP. There is one screen, the confirm
 * button is always reachable, and no step is mandatory. The reason
 * picker is optional and says so. A cancellation flow that hides the
 * exit earns a chargeback and a bad review, which is a worse trade
 * than the subscription it saved.
 *
 * It is, though, the single most valuable churn-research surface the
 * product has: this is the only moment someone will tell you why they
 * are leaving, and it costs them one tap.
 * ─────────────────────────────────────────────────────────────────────
 */

const REASONS = [
  { id: "too_expensive", label: "Too expensive" },
  { id: "not_using", label: "I'm not using it enough" },
  { id: "missing_feature", label: "It's missing something I need" },
  { id: "coaching_quality", label: "The coaching wasn't right for me" },
  { id: "technical", label: "It didn't work properly" },
  { id: "temporary", label: "Just pausing for now" },
  { id: "other", label: "Something else" },
] as const;

type Stage = "loading" | "form" | "submitting" | "done";

export default function CancelSubscriptionPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [billing, setBilling] = useState<BillingRecord | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsSupport, setNeedsSupport] = useState(false);
  const [accessUntil, setAccessUntil] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let abandoned = false;
    void (async () => {
      const record = await loadBilling(user.uid).catch(() => null);
      if (abandoned) return;
      setBilling(record);
      setStage("form");
      track("cancel_page_viewed", { plan: record?.plan ?? null });
    })();
    return () => {
      abandoned = true;
    };
  }, [user]);

  const refundable = useMemo(() => withinGuarantee(billing), [billing]);
  const refundBy = useMemo(() => guaranteeEndsAt(billing), [billing]);

  async function confirm() {
    if (!user) return;
    setStage("submitting");
    setError(null);
    setNeedsSupport(false);
    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ reason, note: note.trim() }),
      });
      const payload = (await response.json()) as {
        cancelled?: boolean;
        accessUntil?: string | null;
        error?: string;
        support?: boolean;
      };

      if (!response.ok || !payload.cancelled) {
        setError(payload.error ?? "Something went wrong. Please try again.");
        setNeedsSupport(Boolean(payload.support));
        setStage("form");
        return;
      }

      setAccessUntil(payload.accessUntil ?? billing?.currentPeriodEnd ?? null);
      setStage("done");
      track("subscription_cancel_confirmed", { reason: reason || null });
    } catch {
      setError(
        "Couldn't reach the server. Nothing has changed — your subscription is still active.",
      );
      setNeedsSupport(true);
      setStage("form");
    }
  }

  if (stage === "loading") {
    return (
      <div className="mx-auto w-full max-w-xl">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-6 h-32 w-full" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────
  if (stage === "done") {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="rounded-md border border-rule bg-paper-raised p-6">
          <div className="flex size-10 items-center justify-center rounded-sm bg-paper-sunken">
            <Check className="size-5 text-success" strokeWidth={2.5} />
          </div>
          <h1 className="mt-4 font-display text-2xl tracking-tight text-ink">
            Your subscription is cancelled
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            {accessUntil
              ? `You keep full access until ${formatDate(accessUntil)}. Nothing further will be charged.`
              : "Nothing further will be charged."}
          </p>
          {refundable && refundBy && (
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Your last payment is still refundable until{" "}
              <span className="tabular">{formatDate(refundBy)}</span>. Email{" "}
              <SupportAddress /> and we&apos;ll process it.
            </p>
          )}
          <p className="mt-6 text-sm leading-relaxed text-ink-muted">
            Your training log stays exactly where it is. If you come back,
            the coach picks up from your last session.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => router.push("/today")} className="h-11 sm:flex-1">
              Back to AdimFit
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/profile")}
              className="h-11 sm:flex-1"
            >
              Go to profile
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── The form ─────────────────────────────────────────────────────
  const busy = stage === "submitting";

  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 text-sm text-ink-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        Back to profile
      </Link>

      <h1 className="mt-6 font-display text-3xl tracking-tight text-ink">
        Cancel your subscription
      </h1>
      <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
        {billing?.currentPeriodEnd
          ? `You'll keep full access until ${formatDate(billing.currentPeriodEnd)} — cancelling now doesn't cut anything short.`
          : "Cancelling stops the next charge. You keep access for the rest of the period you've paid for."}
      </p>

      {refundable && refundBy && (
        <div className="mt-6 flex gap-3 rounded-md border border-rule bg-lime-wash p-4">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-moss"
            strokeWidth={2}
          />
          <p className="text-sm leading-relaxed text-ink">
            You&apos;re still inside the refund window, which closes on{" "}
            <span className="tabular font-semibold">
              {formatDate(refundBy)}
            </span>
            . Cancel here to stop future charges, then email <SupportAddress />{" "}
            to ask for your last payment back.
          </p>
        </div>
      )}

      <div className="mt-8">
        <fieldset disabled={busy}>
          <legend className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
            Why are you leaving? Optional
          </legend>
          <div className="mt-4 space-y-3">
            {REASONS.map((option) => {
              const active = reason === option.id;
              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 text-sm transition-colors ${
                    active
                      ? "border-moss bg-lime-wash text-ink"
                      : "border-rule bg-paper-raised text-ink-muted hover:border-field-border hover:text-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={option.id}
                    checked={active}
                    onChange={() => setReason(option.id)}
                    className="size-4 accent-moss"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>

          <label
            htmlFor="cancel-note"
            className="mt-6 block text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint"
          >
            Anything else? Optional
          </label>
          <Textarea
            id="cancel-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="This goes straight to the founder."
            className="mt-3"
          />
        </fieldset>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-md border border-danger/40 bg-laterite-wash p-4"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-danger"
            strokeWidth={2}
          />
          <p className="text-sm leading-relaxed text-ink">
            {error}
            {needsSupport && (
              <>
                {" "}
                <SupportAddress />
              </>
            )}
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row-reverse">
        <Button
          onClick={() => {
            track("subscription_cancel_abandoned", { reason: reason || null });
            router.push("/profile");
          }}
          disabled={busy}
          className="h-11 sm:flex-1"
        >
          Keep my subscription
        </Button>
        <Button
          variant="destructive"
          onClick={confirm}
          disabled={busy}
          className="h-11 sm:flex-1"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
              Cancelling…
            </>
          ) : (
            "Cancel subscription"
          )}
        </Button>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-faint">
        Your training history is never deleted by cancelling. Deleting your
        account is a separate choice, on the profile page.
      </p>
    </div>
  );
}

function SupportAddress() {
  return (
    <a
      href="mailto:support@adimfit.com"
      className="font-medium text-moss underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-moss"
    >
      support@adimfit.com
    </a>
  );
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
