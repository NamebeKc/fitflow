// src/lib/ops/cost.ts

/**
 * ── WHAT THE COACH COSTS ────────────────────────────────────────────
 * The only cost in this product that scales with usage rather than
 * with time. Cloud Run, Firestore and Resend are close to flat at this
 * size; a chatty user costs real money every message.
 *
 * FOUR RATES, NOT TWO. Prompt caching splits input into three prices,
 * and they differ by 12.5x:
 *
 *   base input    $3.00 / MTok
 *   cache write   $3.75 / MTok   (writing the cache costs 1.25x)
 *   cache read    $0.30 / MTok   (reading it costs 0.1x)
 *   output       $15.00 / MTok
 *
 * Verified against Anthropic's pricing page on 13 October 2026 for
 * `claude-sonnet-4-6`, which is what `/api/chat` pins. Collapsing
 * these into one "input" number would misstate the bill badly in
 * either direction, because `buildStaticRules()` is cached across
 * every request from every user — most input tokens on a busy day are
 * cache reads at a tenth of the headline rate, and the cache is the
 * single biggest reason the coach is affordable at all.
 *
 * PRICES CHANGE, so every rate is env-overridable. The defaults are
 * what was published on the date above and should be re-checked
 * whenever the model is changed.
 *
 * A COST LEVER WORTH KNOWING: Sonnet 5.5 is published at $2.00 input,
 * $10.00 output, $2.50 cache write, $0.10 cache read — roughly a third
 * cheaper on input and output, and a third of the price on cache
 * reads, which is where the volume is. Switching the model in
 * `/api/chat` is a one-line change; whether the coaching quality
 * holds is the part that needs testing, not the price.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface TokenUsage {
  /** Uncached input tokens, billed at the base rate. */
  inputTokens: number;
  /** Tokens written into the prompt cache, billed at 1.25x input. */
  cacheWriteTokens: number;
  /** Tokens served from the cache, billed at 0.1x input. */
  cacheReadTokens: number;
  outputTokens: number;
}

export const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  cacheWriteTokens: 0,
  cacheReadTokens: 0,
  outputTokens: 0,
};

/** USD per million tokens. */
export interface Rates {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

function rate(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

export function rates(): Rates {
  return {
    input: rate("AI_RATE_INPUT_USD_PER_MTOK", 3.0),
    cacheWrite: rate("AI_RATE_CACHE_WRITE_USD_PER_MTOK", 3.75),
    cacheRead: rate("AI_RATE_CACHE_READ_USD_PER_MTOK", 0.3),
    output: rate("AI_RATE_OUTPUT_USD_PER_MTOK", 15.0),
  };
}

const MILLION = 1_000_000;

/** Cost in USD for one request's usage. */
export function usdCost(usage: TokenUsage, r: Rates = rates()): number {
  return (
    (usage.inputTokens * r.input +
      usage.cacheWriteTokens * r.cacheWrite +
      usage.cacheReadTokens * r.cacheRead +
      usage.outputTokens * r.output) /
    MILLION
  );
}

/**
 * The share of input tokens served from cache.
 *
 * The number to watch. It should sit high and stable; a sudden drop
 * means the cached system prompt is being invalidated — usually
 * because something non-static leaked into `buildStaticRules()` — and
 * the bill goes up tenfold on those tokens without anything visibly
 * breaking.
 */
export function cacheHitRate(usage: TokenUsage): number | null {
  const total =
    usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
  if (total === 0) return null;
  return usage.cacheReadTokens / total;
}

/**
 * Naira per dollar, for putting AI cost beside NGN revenue.
 *
 * A constant, not a live rate. A dashboard that silently re-prices
 * history every time the rate moves makes two readings of the same
 * week disagree, and the resulting margin number is unauditable.
 * Set `USD_NGN_RATE` deliberately and change it deliberately.
 */
export function usdToNgn(): number {
  const raw = Number(process.env.USD_NGN_RATE);
  return Number.isFinite(raw) && raw > 0 ? raw : 1550;
}
