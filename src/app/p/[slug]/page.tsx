// src/app/p/[slug]/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * A partner's dashboard.
 *
 * Lives at the app root rather than inside the `(app)` group, so it
 * inherits neither AuthGate nor PaywallGate. A partner has no AdimFit
 * account and should not be asked to make one, or to subscribe, to see
 * how many people they sent.
 *
 * The link carries its own credential (`?t=`). That means it must be
 * treated like a password when it is sent, and it can be revoked with
 * `partner-add.mjs --rotate-token` without touching anything else.
 */

interface Stats {
  name: string;
  status: string;
  signups: number;
  conversions: number;
  conversionRate: number | null;
  accruedAmount: number;
  currency: string;
  perConversion: number;
  capTotal: number | null;
}

export default function PartnerPage() {
  return (
    <Suspense fallback={<Frame><Skeleton className="h-40 w-full" /></Frame>}>
      <PartnerDashboard />
    </Suspense>
  );
}

function PartnerDashboard() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = params?.slug ?? "";
  const token = search.get("t") ?? "";

  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied" | "error">(
    "loading",
  );

  useEffect(() => {
    if (!slug || !token) {
      setState("denied");
      return;
    }
    let cancelled = false;

    fetch(
      `/api/partners/stats?slug=${encodeURIComponent(slug)}&t=${encodeURIComponent(token)}`,
    )
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 404) {
          setState("denied");
          return;
        }
        if (!response.ok) {
          setState("error");
          return;
        }
        setStats((await response.json()) as Stats);
        setState("ok");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [slug, token]);

  if (state === "loading") {
    return (
      <Frame>
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Frame>
    );
  }

  if (state === "denied") {
    return (
      <Frame>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
          This link isn&apos;t valid
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/60">
          It may have been rotated. Ask us for a fresh one and we&apos;ll send
          it over.
        </p>
      </Frame>
    );
  }

  if (state === "error" || !stats) {
    return (
      <Frame>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
          Can&apos;t load your numbers right now
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/60">
          Nothing is lost — try again in a minute.
        </p>
      </Frame>
    );
  }

  const money = (amount: number) =>
    stats.currency === "NGN"
      ? `₦${amount.toLocaleString("en-NG")}`
      : `$${amount.toFixed(2)}`;

  return (
    <Frame>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]">
        AdimFit partner
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
        {stats.name}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-white/60">
        {money(stats.perConversion)} per person who subscribes through your
        link.
      </p>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <Stat label="Signups" value={stats.signups.toLocaleString()} />
        <Stat
          label="Subscribed"
          value={stats.conversions.toLocaleString()}
          accent
        />
        <Stat
          label="Conversion"
          value={stats.conversionRate === null ? "—" : `${stats.conversionRate}%`}
        />
        <Stat label="Earned" value={money(stats.accruedAmount)} accent />
      </div>

      {stats.capTotal !== null && (
        <p className="mt-4 text-[13px] leading-relaxed text-white/45">
          Capped at {money(stats.capTotal)} for this campaign.
        </p>
      )}

      {stats.status !== "active" && (
        <p className="mt-4 rounded-xl border border-white/[0.07] bg-black/30 px-3.5 py-3 text-[13px] leading-relaxed text-white/60">
          This campaign is paused, so new signups won&apos;t earn. Anything
          already shown above is still owed and still paid.
        </p>
      )}

      <p className="mt-7 border-t border-white/[0.07] pt-5 text-[12px] leading-relaxed text-white/40">
        Updated live. Payouts run monthly — we&apos;ll email you the reference
        when each one is sent. Questions:{" "}
        <a
          href="mailto:support@adimfit.com?subject=Partner%20payout"
          className="underline underline-offset-4 hover:text-white/70"
        >
          support@adimfit.com
        </a>
      </p>
    </Frame>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-[#CCFF00]/20 bg-[#CCFF00]/[0.05]"
          : "border-white/[0.09] bg-black/30"
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl tabular-nums ${
          accent ? "text-[#CCFF00]" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#090A0C] px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/[0.09] bg-[#14161A] p-6 sm:p-7">
        {children}
      </div>
    </main>
  );
}
