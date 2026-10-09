// src/app/pricing.md/route.ts
import {
  GUARANTEE_DAYS,
  PAYWALL_PLANS,
  PLANS,
  TRIAL_DAYS,
  type PlanId,
} from "@/lib/plan-catalogue";
import { absoluteUrl } from "@/lib/site";

/**
 * ── /pricing.md ─────────────────────────────────────────────────────
 * "How much does it cost" is the most frequently asked question about
 * any subscription product and the one an assistant is most likely to
 * get wrong, because prices live in rendered markup that changes
 * shape constantly.
 *
 * This renders the SELLABLE catalogue — `PAYWALL_PLANS`, which
 * excludes retired plans by construction — as a table. There is no
 * hand-typed figure anywhere in this file, so it cannot drift from
 * what checkout charges.
 * ─────────────────────────────────────────────────────────────────────
 */

export const dynamic = "force-static";
export const revalidate = 86400;

function rows(ids: PlanId[]): string {
  return ids
    .map((id) => {
      const plan = PLANS[id];
      const standard = plan.standardDisplay ? plan.standardDisplay : "—";
      const saving = plan.saving ?? "—";
      return `| ${plan.label} | ${plan.display} | ${plan.cadence} | ${standard} | ${saving} |`;
    })
    .join("\n");
}

const HEAD = "| Plan | Price | Billing | Standard price | Saving |\n| --- | --- | --- | --- | --- |";

function body(): string {
  return `# AdimFit pricing

Last generated from the live plan catalogue. These are the amounts
checkout charges; there is no separate marketing price list.

## International (USD)

${HEAD}
${rows(PAYWALL_PLANS.USD)}

## Nigeria (NGN)

${HEAD}
${rows(PAYWALL_PLANS.NGN)}

## Terms

- **Free trial:** ${TRIAL_DAYS} days, no card required, on every new account.
- **Refunds:** any charge is refunded on request within ${GUARANTEE_DAYS} days,
  no reason needed. This applies to renewals, not only first purchases.
- **Standard price:** the "standard price" column is what the plan
  reverts to once the founding cohort fills. Existing subscriptions are
  bound to the amount they were created at and do not move.
- **Cancellation:** any time, from within the app.

## What is included

Every plan includes the same product. There is no feature-gated tier,
no per-session charge, and no upsell. Nothing physical is sold.

Full details: ${absoluteUrl("/")}
`;
}

export function GET(): Response {
  return new Response(body(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
