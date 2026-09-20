// src/app/partners/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Copy, Loader2, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import type { PartnerStats } from "@/lib/partner-stats";

/**
 * ── THE PARTNER DASHBOARD ───────────────────────────────────────────
 * One route, two states: signed out shows a form, signed in shows the
 * numbers. A separate /partners/login would mean a redirect dance and
 * a moment of blank screen for no benefit at this size.
 *
 * It lives at the app root rather than inside the `(app)` group, so it
 * inherits neither AuthGate nor PaywallGate. A partner is not a
 * customer and must never be asked to subscribe to see what they are
 * owed.
 *
 * NO SIGNUP FORM, DELIBERATELY. Partner accounts are created by
 * `partner-add.mjs`. Every conversion is a payment obligation, so an
 * open form would let anyone mint a referral code and then refer
 * themselves. Someone who signs in with an ordinary AdimFit account
 * gets the same "not a partner" state as a stranger — the API matches
 * on `partners.authUid`, which only that script writes.
 *
 * AMOUNT DUE IS THE HEADLINE, not lifetime earned. Lifetime earned is
 * the flattering number and the one a partner cannot act on; what
 * they actually want to know, every time they open this, is what is
 * still coming.
 * ─────────────────────────────────────────────────────────────────────
 */

interface Stats extends PartnerStats {
  slug: string;
}

export default function PartnersPage() {
  const { user, isLoading, signInWithEmail, signOutUser } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "none" | "error">(
    "idle",
  );

  const load = useCallback(async () => {
    if (!user) return;
    setState("loading");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/partners/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 404) {
        setState("none");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }
      setStats((await response.json()) as Stats);
      setState("idle");
    } catch {
      setState("error");
    }
  }, [user]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (isLoading) {
    return (
      <Frame>
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Frame>
    );
  }

  if (!user) return <SignIn onSubmit={signInWithEmail} />;

  if (state === "loading" || (state === "idle" && !stats)) {
    return (
      <Frame>
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </Frame>
    );
  }

  if (state === "none") {
    return (
      <Frame>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
          This account isn&apos;t a partner
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/60">
          You&apos;re signed in, but there&apos;s no partner campaign attached
          to this email. If you think there should be,{" "}
          <a
            href="mailto:support@adimfit.com?subject=Partner%20access"
            className="underline underline-offset-4 hover:text-white/85"
          >
            let us know
          </a>
          .
        </p>
        <SignOutButton onClick={signOutUser} />
      </Frame>
    );
  }

  if (state === "error" || !stats) {
    return (
      <Frame>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">
          Can&apos;t load your numbers
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/60">
          Nothing is lost — try again in a minute.
        </p>
        <SignOutButton onClick={signOutUser} />
      </Frame>
    );
  }

  return <Dashboard stats={stats} onSignOut={signOutUser} />;
}

/* ── Signed out ───────────────────────────────────────────────────── */

function SignIn({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(email, password);
    if (message) {
      setError(message);
      setBusy(false);
    }
  }

  return (
    <Frame>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]">
        AdimFit partners
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
        Sign in
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-white/60">
        Track your link, your signups and what you&apos;re owed.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-3">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="username"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-200"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-6 py-3.5 text-[15px] font-semibold text-black outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
          ) : (
            <>
              Sign in
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>

      <p className="mt-6 border-t border-white/[0.07] pt-5 text-[12px] leading-relaxed text-white/40">
        Partner accounts are set up by us — there&apos;s no signup here. Lost
        your password, or think you should have access?{" "}
        <a
          href="mailto:support@adimfit.com?subject=Partner%20access"
          className="underline underline-offset-4 hover:text-white/70"
        >
          support@adimfit.com
        </a>
      </p>
    </Frame>
  );
}

/* ── Signed in ────────────────────────────────────────────────────── */

function Dashboard({
  stats,
  onSignOut,
}: {
  stats: Stats;
  onSignOut: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const link =
    typeof window === "undefined"
      ? `/r/${stats.slug}`
      : `${window.location.origin}/r/${stats.slug}`;

  const money = (amount: number) =>
    stats.currency === "NGN"
      ? `₦${Math.round(amount).toLocaleString("en-NG")}`
      : `$${amount.toFixed(2)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is visible and selectable anyway.
    }
  }

  return (
    <Frame>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#CCFF00]">
            AdimFit partner
          </p>
          <h1 className="mt-3 truncate text-2xl font-semibold tracking-[-0.03em] text-white">
            {stats.name}
          </h1>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/40 outline-none transition-colors hover:bg-white/[0.05] hover:text-white/75"
        >
          <LogOut className="size-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* The one number they came for. */}
      <AnimatePresence>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border border-[#CCFF00]/20 bg-[#CCFF00]/[0.05] p-5"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#CCFF00]/70">
            Due to you
          </p>
          <p className="mt-2 font-mono text-4xl tabular-nums text-[#CCFF00]">
            {money(stats.amountDue)}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">
            {money(stats.perConversion)} per subscriber.
            {stats.amountPaid > 0 &&
              ` ${money(stats.amountPaid)} already paid out.`}
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <Stat label="Views" value={stats.views.toLocaleString()} />
        <Stat label="Signups" value={stats.signups.toLocaleString()} />
        <Stat label="Subscribed" value={stats.conversions.toLocaleString()} />
      </div>

      {(stats.viewToSignup !== null || stats.signupToPaid !== null) && (
        <p className="mt-3 text-[13px] leading-relaxed text-white/45">
          {stats.viewToSignup !== null && (
            <>{stats.viewToSignup}% of views sign up</>
          )}
          {stats.viewToSignup !== null && stats.signupToPaid !== null && " · "}
          {stats.signupToPaid !== null && (
            <>{stats.signupToPaid}% of signups subscribe</>
          )}
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-white/[0.09] bg-black/30 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
          Your link
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-white/80">
            {link}
          </code>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-white/60 outline-none transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <Copy className="size-3" strokeWidth={2.5} />
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {stats.capTotal !== null && (
        <p className="mt-4 text-[13px] leading-relaxed text-white/45">
          This campaign is capped at {money(stats.capTotal)} total.
        </p>
      )}

      {stats.status !== "active" && (
        <p className="mt-4 rounded-xl border border-white/[0.07] bg-black/30 px-3.5 py-3 text-[13px] leading-relaxed text-white/60">
          This campaign is paused, so new signups won&apos;t earn. Anything
          shown above is still owed and still paid.
        </p>
      )}

      <p className="mt-7 border-t border-white/[0.07] pt-5 text-[12px] leading-relaxed text-white/40">
        Views are counted once per person per day, so previews and crawlers
        don&apos;t inflate them. Payouts run monthly — we&apos;ll email the
        transfer reference.{" "}
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

/* ── Bits ─────────────────────────────────────────────────────────── */

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (next: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-black/40 px-3.5 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#CCFF00]/40 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/30"
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.09] bg-black/30 p-3.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-xl tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}

function SignOutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mt-6 flex items-center gap-2 rounded-full border border-white/12 px-4 py-2.5",
        "text-[13px] text-white/60 outline-none transition-colors hover:bg-white/[0.05] hover:text-white",
      )}
    >
      <LogOut className="size-3.5" strokeWidth={2} />
      Sign out
    </button>
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
