// src/lib/ops/metrics.ts
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getFoundingStatus } from "@/lib/billing-admin";
import { PLANS, isLifetimePlan, type PlanId } from "@/lib/subscription";
import { cacheHitRate, type TokenUsage } from "@/lib/ops/cost";

/**
 * ── ONE DAY, MEASURED ───────────────────────────────────────────────
 * Everything the business looks like on a given date, in one object.
 *
 * TWO KINDS OF NUMBER, KEPT APART. A STOCK is a count of how things
 * stand right now — active subscribers, MRR, founding seats left. A
 * FLOW is what happened on one day — signups, workouts logged, emails
 * sent, money spent on inference. Mixing them is how a dashboard ends
 * up claiming "12 subscribers today" when it means "12 in total", and
 * the two trend in completely different ways.
 *
 * SNAPSHOTS ARE WRITTEN, NOT DERIVED. Firestore cannot answer "how
 * many active subscribers were there three Tuesdays ago" — the
 * documents only hold the present. A stock series exists only if
 * something wrote it down each day, which is what the rollup job is
 * for. Miss a day and that day is gone for good; this is why the
 * rollup runs on the same scheduler as the email job rather than
 * being computed on demand.
 *
 * COST IN BOTH CURRENCIES. Revenue is mostly naira, inference is
 * billed in dollars, and a margin computed across two currencies at a
 * floating rate is a number nobody can reconcile twice. `usdToNgn()`
 * is a deliberate constant for exactly that reason.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface PartnerRow {
  slug: string;
  name: string;
  status: string;
  views: number;
  signups: number;
  conversions: number;
  amountEarned: number;
  amountDue: number;
  currency: string;
}

export interface DailySnapshot {
  date: string;
  computedAt: string;

  /** Stocks — how things stand. */
  stock: {
    accounts: number;
    onboarded: number;
    byStatus: Record<string, number>;
    entitled: number;
    mrrNgn: number;
    mrrUsd: number;
    /** Cumulative one-off (lifetime) revenue, never part of MRR. */
    lifetimeNgn: number;
    lifetimeUsd: number;
    planMix: Record<string, number>;
    foundingClaimed: number;
    foundingRemaining: number;
  };

  /** Flows — what happened on `date`. */
  flow: {
    signups: number;
    onboarded: number;
    conversions: number;
    workoutsLogged: number;
    activeLoggers: number;
    emailsByKind: Record<string, number>;
    emailsFailed: number;
    aiRequests: number;
    aiCostUsd: number;
    aiCacheHitRate: number | null;
  };

  partners: PartnerRow[];
}

/** Billing periods per month, for normalising to MRR. */
const PERIODS_PER_MONTH: Record<string, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
  lifetime: 0,
};

const dayBounds = (date: string) => ({
  from: `${date}T00:00:00.000Z`,
  to: `${date}T23:59:59.999Z`,
});

/** Statuses that mean the person currently has access. */
const ENTITLED = new Set(["active", "trialing", "comped"]);

export async function computeSnapshot(date: string): Promise<DailySnapshot> {
  const db = getAdminDb();
  const { from, to } = dayBounds(date);

  const [
    accountsResult,
    onboardedTotal,
    onboardedToday,
    billing,
    workouts,
    emails,
    usageDoc,
    partnersSnap,
    founding,
  ] = await Promise.all([
    listAccounts(date),
    db.collection("users").count().get(),
    db
      .collection("users")
      .where("createdAt", ">=", from)
      .where("createdAt", "<=", to)
      .count()
      .get(),
    db.collectionGroup("billing").get(),
    db.collectionGroup("workouts").where("date", "==", date).get(),
    db
      .collection("emailLog")
      .where("claimedAt", ">=", from)
      .where("claimedAt", "<=", to)
      .get(),
    db.collection("usageDaily").doc(date).get(),
    db.collection("partners").get(),
    getFoundingStatus(),
  ]);

  // ── Billing: stocks and one flow ──────────────────────────────────
  const byStatus: Record<string, number> = {};
  const planMix: Record<string, number> = {};
  let mrrNgn = 0;
  let mrrUsd = 0;
  let lifetimeNgn = 0;
  let lifetimeUsd = 0;
  let entitled = 0;
  let conversions = 0;

  for (const doc of billing.docs) {
    const status = (doc.get("status") as string | undefined) ?? "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (ENTITLED.has(status)) entitled += 1;

    const lastPaymentAt = doc.get("lastPaymentAt") as string | undefined;
    if (lastPaymentAt && lastPaymentAt >= from && lastPaymentAt <= to) {
      conversions += 1;
    }

    const planId = doc.get("plan") as PlanId | undefined;
    if (!planId) continue;
    planMix[planId] = (planMix[planId] ?? 0) + 1;

    // MRR counts money that recurs, from people who are paying. A
    // trialing user contributes nothing, a cancelled one stops, and a
    // lifetime purchase is not a monthly anything — counting it as
    // 1/12th of a year would invent a renewal that will never happen.
    if (status !== "active") continue;
    const plan = PLANS[planId];
    if (!plan) continue;

    if (isLifetimePlan(planId)) {
      if (plan.currency === "NGN") lifetimeNgn += plan.amount;
      else lifetimeUsd += plan.amount;
      continue;
    }

    const perMonth = PERIODS_PER_MONTH[plan.interval] ?? 0;
    const monthly = plan.amount * perMonth;
    if (plan.currency === "NGN") mrrNgn += monthly;
    else mrrUsd += monthly;
  }

  // ── Logging: how many sessions, and by how many people ────────────
  const loggers = new Set<string>();
  for (const doc of workouts.docs) {
    const uid = doc.ref.parent.parent?.id;
    if (uid) loggers.add(uid);
  }

  // ── Email: what went out, and what failed ─────────────────────────
  const emailsByKind: Record<string, number> = {};
  let emailsFailed = 0;
  for (const doc of emails.docs) {
    const kind = (doc.get("kind") as string | undefined) ?? "unknown";
    emailsByKind[kind] = (emailsByKind[kind] ?? 0) + 1;
    if (doc.get("sent") === false) emailsFailed += 1;
  }

  // ── Inference ─────────────────────────────────────────────────────
  const usage: TokenUsage = {
    inputTokens: (usageDoc.get("inputTokens") as number | undefined) ?? 0,
    cacheWriteTokens:
      (usageDoc.get("cacheWriteTokens") as number | undefined) ?? 0,
    cacheReadTokens:
      (usageDoc.get("cacheReadTokens") as number | undefined) ?? 0,
    outputTokens: (usageDoc.get("outputTokens") as number | undefined) ?? 0,
  };

  const partners: PartnerRow[] = partnersSnap.docs
    .map((doc) => {
      const counters = (doc.get("counters") ?? {}) as Record<string, number>;
      const earned = counters.accruedAmount ?? 0;
      const paid = counters.paidAmount ?? 0;
      return {
        slug: doc.id,
        name: (doc.get("name") as string | undefined) ?? doc.id,
        status: (doc.get("status") as string | undefined) ?? "unknown",
        views: counters.views ?? 0,
        signups: counters.signups ?? 0,
        conversions: counters.conversions ?? 0,
        amountEarned: earned,
        amountDue: Math.max(0, earned - paid),
        currency: (doc.get("terms.currency") as string | undefined) ?? "NGN",
      };
    })
    .sort((a, b) => b.conversions - a.conversions || b.views - a.views);

  return {
    date,
    computedAt: new Date().toISOString(),
    stock: {
      accounts: accountsResult.total,
      onboarded: onboardedTotal.data().count,
      byStatus,
      entitled,
      mrrNgn: Math.round(mrrNgn),
      mrrUsd: Math.round(mrrUsd * 100) / 100,
      lifetimeNgn,
      lifetimeUsd,
      planMix,
      foundingClaimed: founding.claimed,
      foundingRemaining: founding.remaining,
    },
    flow: {
      signups: accountsResult.createdOnDate,
      onboarded: onboardedToday.data().count,
      conversions,
      workoutsLogged: workouts.size,
      activeLoggers: loggers.size,
      emailsByKind,
      emailsFailed,
      aiRequests: (usageDoc.get("requests") as number | undefined) ?? 0,
      aiCostUsd:
        Math.round(((usageDoc.get("costUsd") as number | undefined) ?? 0) * 1e6) /
        1e6,
      aiCacheHitRate: cacheHitRate(usage),
    },
    partners,
  };
}

/**
 * Account totals from Firebase Auth.
 *
 * SIGNUP IS NOT ONBOARDING, and the gap between the two is one of the
 * more useful numbers here: an auth record exists the moment someone
 * finishes Google sign-in, while `users/{uid}` only exists once they
 * complete the wizard. A widening gap is an onboarding problem, and
 * nothing else in the product would show it.
 *
 * Auth has no date query, so this pages through. Capped, because an
 * unbounded loop in a daily job is how a cron turns into an outage —
 * at the current size it is one page, and the cap is reported rather
 * than silently truncating the number.
 */
const MAX_ACCOUNT_PAGES = 10;

async function listAccounts(
  date: string,
): Promise<{ total: number; createdOnDate: number; capped: boolean }> {
  const auth = getAdminAuth();
  let total = 0;
  let createdOnDate = 0;
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      total += 1;
      const created = user.metadata.creationTime;
      if (created && new Date(created).toISOString().slice(0, 10) === date) {
        createdOnDate += 1;
      }
    }
    pageToken = page.pageToken;
    pages += 1;
  } while (pageToken && pages < MAX_ACCOUNT_PAGES);

  return { total, createdOnDate, capped: Boolean(pageToken) };
}
