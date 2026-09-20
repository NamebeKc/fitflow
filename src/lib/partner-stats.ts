// src/lib/partner-stats.ts
import type { DocumentSnapshot } from "firebase-admin/firestore";

/**
 * The only shape a partner ever sees.
 *
 * Built in one place because two routes serve it — the signed-in
 * dashboard and the older token link — and a partner reading two
 * different totals depending on how they arrived is a conversation
 * about whether we can count, not about their campaign.
 *
 * NOTHING HERE IDENTIFIES A CUSTOMER. No uid, no email, no per-signup
 * row, and never `viewToken` or `authUid`. The people who arrived
 * through a partner's link did not agree to be identified to that
 * partner, and a payout discussion only needs totals.
 */
export interface PartnerStats {
  name: string;
  status: string;
  /** Deduped link opens — see `app/r/[slug]/route.ts`. */
  views: number;
  signups: number;
  conversions: number;
  /** Signups per 100 views, or null before any views. */
  viewToSignup: number | null;
  /** Conversions per 100 signups, or null before any signups. */
  signupToPaid: number | null;
  /** Earned but not yet transferred. This is the number that matters. */
  amountDue: number;
  /** Lifetime earned, including what has already been paid out. */
  amountEarned: number;
  amountPaid: number;
  currency: string;
  perConversion: number;
  capTotal: number | null;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  // One decimal. A rate quoted to four places invites a conversation
  // about the fourth.
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildPartnerStats(
  snapshot: DocumentSnapshot,
  slug: string,
): PartnerStats {
  const counters = (snapshot.get("counters") ?? {}) as Record<string, number>;
  const terms = (snapshot.get("terms") ?? {}) as Record<string, unknown>;
  const cap = snapshot.get("cap") as { totalAmount?: number } | null;

  const views = counters.views ?? 0;
  const signups = counters.signups ?? 0;
  const conversions = counters.conversions ?? 0;
  const amountEarned = counters.accruedAmount ?? 0;
  const amountPaid = counters.paidAmount ?? 0;

  return {
    name: (snapshot.get("name") as string) ?? slug,
    status: (snapshot.get("status") as string) ?? "inactive",
    views,
    signups,
    conversions,
    viewToSignup: rate(signups, views),
    signupToPaid: rate(conversions, signups),
    // Clamped at zero: a manual correction to either counter must
    // never render as a negative amount owed, which reads as the
    // partner owing us money.
    amountDue: Math.max(0, amountEarned - amountPaid),
    amountEarned,
    amountPaid,
    currency: (terms.currency as string) ?? "NGN",
    perConversion: (terms.amount as number) ?? 0,
    capTotal: cap?.totalAmount ?? null,
  };
}
