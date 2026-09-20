// src/app/(app)/billing/return/page.tsx
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { useAuth } from "@/components/providers/AuthProvider";
import { GUARANTEE_DAYS } from "@/lib/subscription";

/**
 * Where Flutterwave sends people after checkout.
 *
 * The query string here proves nothing — anyone can type
 * `?status=successful` into the address bar. This page's only job is
 * to hand the transaction ID to our server, which asks Flutterwave
 * directly whether the money actually arrived.
 */
export default function BillingReturnPage() {
  return (
    <Suspense fallback={<Pending />}>
      <BillingReturn />
    </Suspense>
  );
}

type State = "verifying" | "success" | "failed" | "cancelled";

function BillingReturn() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<State>("verifying");
  const [message, setMessage] = useState<string | null>(null);
  const attempted = useRef(false);

  const verify = useCallback(async () => {
    if (!user) return;

    const status = params.get("status");
    const transactionId =
      params.get("transaction_id") ?? params.get("transactionId");
    const txRef = params.get("tx_ref");

    // Flutterwave reports a user-initiated cancellation directly.
    if (status === "cancelled") {
      setState("cancelled");
      return;
    }

    if (!transactionId) {
      setState("failed");
      setMessage("No transaction reference came back from the payment page.");
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/billing/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ transactionId, txRef }),
      });

      const data = await response.json();

      if (response.ok && data.entitled) {
        // No client event here on purpose. The verify route already
        // emitted `trial_converted` server-side, and firing a second
        // one from the browser would double-count every conversion —
        // inflating the one number that decides the pricing model.
        setState("success");
        return;
      }

      setState("failed");
      setMessage(data.error ?? "We couldn't confirm that payment.");
    } catch (error) {
      console.error("[billing/return] Verification failed:", error);
      setState("failed");
      setMessage("We couldn't reach the server to confirm your payment.");
    }
  }, [params, user]);

  useEffect(() => {
    if (attempted.current || !user) return;
    attempted.current = true;
    void verify();
  }, [user, verify]);

  // If sign-in never resolves, this page used to spin forever — the
  // worst possible screen to show someone whose card has just been
  // charged, because it hides the support address along with
  // everything else. After ten seconds we say so plainly instead.
  //
  // The money is safe either way: the transaction stands on
  // Flutterwave's side and the webhook activates the subscription
  // without any browser involved. This is only about what the customer
  // is looking at while that happens.
  useEffect(() => {
    if (user) return;
    const timer = window.setTimeout(() => {
      if (attempted.current) return;
      attempted.current = true;
      setState("failed");
      setMessage(
        "We couldn't confirm you're signed in, so we can't check this " +
          "payment from here. If money left your account, don't pay " +
          "again — it will be applied automatically, and support can " +
          "confirm it for you.",
      );
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [user]);

  if (state === "verifying") return <Pending />;

  if (state === "success") {
    return (
      <Shell
        icon={
          <CheckCircle2 className="size-7 text-[#CCFF00]" strokeWidth={2} />
        }
        accent
        title="You're all set."
        body={`Your subscription is active. If it turns out not to be for you, email us within ${GUARANTEE_DAYS} days for a full refund.`}
      >
        <button
          type="button"
          onClick={() => router.push("/coach")}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-6 py-3.5 text-[15px] font-semibold text-black outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99]"
        >
          Open your coach
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </button>
      </Shell>
    );
  }

  if (state === "cancelled") {
    return (
      <Shell
        icon={<AlertCircle className="size-7 text-white/60" strokeWidth={2} />}
        title="Payment cancelled"
        body="Nothing was charged. You can subscribe whenever you're ready."
      >
        <Link
          href="/"
          className="flex w-full items-center justify-center rounded-full border border-white/12 px-6 py-3.5 text-[15px] font-medium text-white/70 outline-none transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
        >
          Back to AdimFit
        </Link>
      </Shell>
    );
  }

  return (
    <Shell
      icon={<AlertCircle className="size-7 text-red-300" strokeWidth={2} />}
      title="We couldn't confirm that payment"
      body={
        message ??
        "If money left your account, don't pay again — contact us and we'll sort it out."
      }
    >
      <div className="space-y-2.5">
        <Link
          href="/"
          className="flex w-full items-center justify-center rounded-full border border-white/12 px-6 py-3.5 text-[15px] font-medium text-white/70 outline-none transition-colors hover:bg-white/[0.04] hover:text-white"
        >
          Back to AdimFit
        </Link>
        <a
          href="mailto:support@adimfit.com?subject=AdimFit%20payment%20issue"
          className="block text-center text-[13px] text-white/50 underline underline-offset-4 transition-colors hover:text-white/80"
        >
          Email support
        </a>
      </div>
    </Shell>
  );
}

function Pending() {
  return (
    <Shell
      icon={
        <Loader2
          className="size-7 animate-spin text-white/60"
          strokeWidth={2}
        />
      }
      title="Confirming your payment"
      body="One moment — we're checking with the payment provider."
    />
  );
}

function Shell({
  icon,
  title,
  body,
  accent = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center text-center">
      <div
        className={`flex size-14 items-center justify-center rounded-2xl border ${
          accent
            ? "border-[#CCFF00]/25 bg-[#CCFF00]/[0.07]"
            : "border-white/[0.09] bg-black/30"
        }`}
      >
        {icon}
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-white/60">{body}</p>

      {children && <div className="mt-8 w-full">{children}</div>}
    </div>
  );
}