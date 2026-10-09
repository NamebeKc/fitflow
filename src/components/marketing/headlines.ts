// src/components/marketing/headlines.ts

/**
 * ── HERO VARIANTS ───────────────────────────────────────────────────
 * Lifted out of LandingPage so a SERVER component can resolve the
 * variant from `?v=` and render the chosen headline into the HTML.
 *
 * This is the whole reason the landing page was restructured. The
 * previous implementation applied the variant in a `useEffect`, which
 * meant every crawler — and every AI retrieval bot, none of which
 * execute JavaScript — only ever saw the default. A variant that only
 * exists after hydration is a variant that cannot be indexed.
 *
 * COPY DISCIPLINE: "three taps" is gone. The logging flow has never
 * been measured against that claim, and a number asserted in
 * server-rendered HTML is a number that gets indexed, quoted back by
 * assistants, and held against the product. "In seconds" is true and
 * carries the same meaning.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface Headline {
  eyebrow: string;
  title: string;
  emphasis: string;
  subtitle: string;
}

export const HEADLINES = {
  default: {
    eyebrow: "A dị m — I am",
    // The h1 renders as `${title} ${emphasis}`. "AI fitness coach" is in
     // it deliberately: this is the page's one h1 and it was previously
     // pure poetry — memorable to a reader, invisible to a crawler.
    title: "An AI fitness coach that remembers",
    emphasis: "every session.",
    subtitle:
      "Log a workout in seconds. Ask what's next. AdimFit builds each plan from what you've actually done — never from a template.",
  },
  price: {
    eyebrow: "AI personal training",
    title: "A personal trainer for",
    emphasis: "less than a coffee.",
    subtitle:
      "One hour with a personal trainer costs more than a year of AdimFit. Same adaptive programming, available at 5am, and it remembers everything you've done.",
  },
  simple: {
    eyebrow: "AI personal training",
    title: "Log it. Ask it.",
    emphasis: "Get stronger.",
    subtitle:
      "Seconds to record a session. One question to know what's next. Your coach handles the rest.",
  },
} satisfies Record<string, Headline>;

export type HeadlineKey = keyof typeof HEADLINES;

/**
 * Narrows an arbitrary `?v=` value to a known variant. Anything
 * unrecognised falls back to `default` rather than throwing, because
 * this value arrives from the open internet and a mistyped campaign
 * link should still render a page.
 */
export function resolveHeadline(value?: string | string[]): HeadlineKey {
  const key = Array.isArray(value) ? value[0] : value;
  return key && key in HEADLINES ? (key as HeadlineKey) : "default";
}
