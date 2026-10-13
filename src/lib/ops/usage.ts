// src/lib/ops/usage.ts
import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase-admin";
import { usdCost, type TokenUsage } from "@/lib/ops/cost";

/**
 * ── RECORDING WHAT A REQUEST COST ───────────────────────────────────
 * Two increments per coach message: one global daily row for the trend
 * line, one per-user monthly row for cost per user.
 *
 * WHY BOTH. The daily row answers "what is the coach costing"; the
 * monthly per-user row answers "which users cost more than they pay",
 * which is the only version of the question that can change a pricing
 * decision. Deriving either from the other would mean scanning, and
 * scanning is what makes a dashboard too slow to open.
 *
 * COSTS ARE STORED, NOT JUST TOKENS. Rates change. A row priced at
 * today's rates and stored is a historical fact; tokens re-priced at
 * next year's rates is a number that silently rewrites the past. Both
 * are kept, so a re-price is possible but never accidental.
 *
 * NEVER THROWS. This runs after a chat response has already been
 * streamed to the user. A metrics write that fails must not surface as
 * a broken coach reply — losing a row costs a rounding error in a
 * dashboard; failing the request costs the conversation.
 */

const MODEL_FIELD = "model";

export async function recordAiUsage(
  uid: string,
  usage: TokenUsage,
  model: string,
): Promise<void> {
  const total =
    usage.inputTokens +
    usage.cacheWriteTokens +
    usage.cacheReadTokens +
    usage.outputTokens;
  if (total === 0) return;

  const cost = usdCost(usage);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);

  const increments = {
    requests: FieldValue.increment(1),
    inputTokens: FieldValue.increment(usage.inputTokens),
    cacheWriteTokens: FieldValue.increment(usage.cacheWriteTokens),
    cacheReadTokens: FieldValue.increment(usage.cacheReadTokens),
    outputTokens: FieldValue.increment(usage.outputTokens),
    costUsd: FieldValue.increment(cost),
    updatedAt: now.toISOString(),
  };

  const db = getAdminDb();

  await Promise.all([
    db
      .collection("usageDaily")
      .doc(day)
      .set({ date: day, [MODEL_FIELD]: model, ...increments }, { merge: true }),
    db
      .collection("users")
      .doc(uid)
      .collection("usage")
      .doc(month)
      .set({ month, ...increments }, { merge: true }),
  ]).catch((error) => {
    console.error("[ops/usage] Could not record usage:", uid, error);
  });
}
