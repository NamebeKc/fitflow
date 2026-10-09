// src/content/guides.ts

/**
 * ── THE GUIDES REGISTRY ─────────────────────────────────────────────
 * Metadata for every guide, in one place, because four things need it
 * and they must not disagree: the page's own `metadata` export, the
 * `Article` + `FAQPage` structured data, the `/guides` index, and the
 * sitemap.
 *
 * WHY THESE THREE PAGES AND NOT THREE VARIATIONS OF ONE. The obvious
 * mistake in a topic cluster is writing the same article three times
 * with different titles: the pages then compete with each other,
 * Google picks one more or less at random, and the other two dilute
 * it. Each guide below answers a question the others do not.
 *
 *   chatgpt-workout-plan  → "will this work at all?"      (pillar)
 *   chatgpt-vs-fitness-app → "which should I use?"        (decision)
 *   workout-plan-week-three → "why did mine fall apart?"  (diagnosis)
 *
 * Someone searching one of those is not searching the others.
 *
 * CLAIM BOUNDARY. No guide may assert form correction, photo calorie
 * tracking, voice input, or wearable sync — AdimFit does none of them.
 * No outcome or body-transformation promises anywhere.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface GuideFaq {
  question: string;
  answer: string;
}

export interface Guide {
  slug: string;
  /** Cluster label shown on the index card. Two today. */
  topic: "Using ChatGPT" | "Cost & alternatives";
  /** Used in <title> and the index card. */
  title: string;
  /** The on-page h1. Often shorter than the title tag. */
  h1: string;
  /** Meta description. Kept under 160 characters. */
  description: string;
  /** The standfirst under the h1. */
  summary: string;
  published: string;
  modified: string;
  readingMinutes: number;
  /** Feeds both the visible FAQ block and the FAQPage schema. */
  faqs: GuideFaq[];
  /** Slugs of the other guides to link at the foot of this one. */
  related: string[];
}

export const GUIDES: Guide[] = [
  {
    slug: "chatgpt-workout-plan",
    topic: "Using ChatGPT",
    title: "Can ChatGPT write you a workout plan?",
    h1: "Can ChatGPT write you a workout plan?",
    description:
      "Yes — and it is better than most people expect. Here is a prompt that gets a usable plan, plus the four specific points where it stops working.",
    summary:
      "Yes, and it is better than most people expect. Here is a prompt that gets you a usable plan, and the four specific places it stops working.",
    published: "2026-09-21",
    modified: "2026-09-21",
    readingMinutes: 8,
    related: ["chatgpt-vs-fitness-app", "workout-plan-week-three"],
    faqs: [
      {
        question: "Can ChatGPT write a workout plan?",
        answer:
          "Yes. Given your equipment, available time and experience level, ChatGPT produces a sensibly structured plan with reasonable exercise selection. It is roughly as good as a competent template. The limitation is not the first plan — it is the second one, because the model has no record of what you actually did.",
      },
      {
        question: "Is a ChatGPT workout plan safe for a beginner?",
        answer:
          "The exercise selection is usually conservative and sensible. The risk is volume: the model cannot see your current capacity, so it guesses, and it tends to guess high. Start below what it prescribes, and if you have an injury or a medical condition, speak to a doctor or a qualified coach first.",
      },
      {
        question: "Why does ChatGPT forget my workouts?",
        answer:
          "Each conversation starts without the previous one unless you paste it back in. Even with memory features enabled, what is retained is a summary rather than a structured training log, so it cannot reliably tell you what weight you lifted three weeks ago or how many sessions you completed last month.",
      },
      {
        question: "What should I do instead of using ChatGPT for workouts?",
        answer:
          "Two options work. Keep your own log — a notebook or spreadsheet — and paste the last few sessions into every conversation. Or use something that keeps the record for you, so the plan is built from what you actually did rather than from what you remembered to mention.",
      },
    ],
  },
  {
    slug: "chatgpt-vs-fitness-app",
    topic: "Using ChatGPT",
    title: "ChatGPT vs a fitness app: which should plan your training?",
    h1: "ChatGPT vs a fitness app",
    description:
      "A conversation and a record are different tools. Here is what each does well, and an honest answer to which one your situation actually calls for.",
    summary:
      "One is a conversation, the other is a record. They fail in different places. Here is how to tell which your situation calls for.",
    published: "2026-09-21",
    modified: "2026-09-21",
    readingMinutes: 7,
    related: ["chatgpt-workout-plan", "workout-plan-week-three"],
    faqs: [
      {
        question: "Is ChatGPT better than a fitness app?",
        answer:
          "For a one-off question it is often better — faster, more flexible, and it explains its reasoning. For training across months it is worse, because progressive overload requires knowing what you lifted last time, and a general chatbot has no reliable record of that.",
      },
      {
        question: "Do fitness apps use AI?",
        answer:
          "Many do, and the term covers very different things. Some generate plans from a fixed template with variables filled in. Some, AdimFit included, pass your logged training history to a language model so its answers cite sessions you actually recorded. Worth checking which one you are buying.",
      },
      {
        question: "Can I just paste my workout history into ChatGPT?",
        answer:
          "You can, and it works. The catch is that you have to maintain the log yourself and paste it every time, forever. Most people manage this for a few weeks. If you are the kind of person who keeps a spreadsheet up to date for a year, this is a perfectly good system.",
      },
    ],
  },
  {
    slug: "workout-plan-week-three",
    topic: "Using ChatGPT",
    title: "Why your workout plan falls apart in week three",
    h1: "Why your workout plan falls apart in week three",
    description:
      "It is usually not discipline. Most plans assume an ideal week, and week three is when a real one arrives. What that breaks, and how to build around it.",
    summary:
      "It is usually not discipline. Most plans assume an ideal week, and week three is roughly when a real one turns up.",
    published: "2026-09-21",
    modified: "2026-09-21",
    readingMinutes: 6,
    related: ["chatgpt-workout-plan", "chatgpt-vs-fitness-app"],
    faqs: [
      {
        question: "Why do I always quit my workout plan after a few weeks?",
        answer:
          "Most plans are written for a week that does not happen — fixed days, fixed sessions, no travel and no late meetings. The first disrupted week creates a gap the plan has no instruction for, and a plan you are already behind is much harder to return to than one that adjusted.",
      },
      {
        question: "Should I start over if I miss a week of training?",
        answer:
          "Usually not. Restarting throws away the adaptation you built and frames the missed week as failure, which is the feeling that ends most attempts. Resume near where you left off, slightly lighter for the first session back, and carry on.",
      },
      {
        question: "How many rest days should a workout plan have?",
        answer:
          "It depends on your training age, how hard the sessions are and what else your week demands, so any universal number is marketing rather than advice. The more useful question is whether your plan treats an unplanned rest day as a broken streak, because that framing does real damage.",
      },
    ],
  },
  {
    slug: "personal-trainer-cost",
    topic: "Cost & alternatives",
    title: "How much does a personal trainer cost?",
    h1: "How much does a personal trainer cost?",
    description:
      "Real figures for the US, UK and Nigeria, what a year of twice-weekly sessions actually adds up to, and an honest account of what the money buys.",
    summary:
      "Real figures for the US, UK and Nigeria — and what twice a week for a year actually adds up to.",
    published: "2026-09-21",
    modified: "2026-09-21",
    readingMinutes: 7,
    related: ["personal-trainer-alternatives", "is-an-ai-personal-trainer-worth-it"],
    faqs: [
      {
        question: "How much does a personal trainer cost per session?",
        answer:
          "In the United States, marketplace data puts most sessions between $50 and $90, with New York City averaging around $100. In the UK, one-to-one sessions run roughly £20 to £90 with a median near £70, and gym-based trainers typically charge £30 to £65 an hour.",
      },
      {
        question: "How much does a personal trainer cost per year?",
        answer:
          "Twice a week for a year is 104 sessions. At the US average of around $70 that is roughly $7,280; at the UK median of £70 it is about £7,280. Even at the cheapest end of either market you are looking at several thousand a year.",
      },
      {
        question: "Why are personal trainers so expensive?",
        answer:
          "You are buying an hour of one person's undivided attention, and their time cannot be resold. Most trainers also pay rent or a revenue share to a gym, fund their own certification and insurance, and can only deliver a limited number of sessions a week. The price is not a markup on a product.",
      },
      {
        question: "Is a personal trainer worth the money?",
        answer:
          "For learning unfamiliar lifts, training around an injury, or when accountability is the thing you actually lack, a good trainer is hard to beat. For following a plan you already understand, most of the cost is buying supervision you may not need.",
      },
    ],
  },
  {
    slug: "personal-trainer-alternatives",
    topic: "Cost & alternatives",
    title: "Cheaper alternatives to a personal trainer, honestly compared",
    h1: "Cheaper alternatives to a personal trainer",
    description:
      "Six options, what each actually costs, and what you give up with each one. Including the one most people should pick, which is not an app.",
    summary:
      "Six options, what each costs, and what you give up. Including the one most people should probably pick, which is not an app.",
    published: "2026-09-21",
    modified: "2026-09-21",
    readingMinutes: 8,
    related: ["personal-trainer-cost", "is-an-ai-personal-trainer-worth-it"],
    faqs: [
      {
        question: "What is the cheapest alternative to a personal trainer?",
        answer:
          "A well-written free programme plus a notebook costs nothing and works, provided you will actually follow it. The next cheapest options are small-group training, which keeps a coach in the room at a fraction of one-to-one rates, and a training app, which is usually a few dollars a month.",
      },
      {
        question: "Is small-group training as good as a personal trainer?",
        answer:
          "For most people it is close, at roughly a third of the price. You lose some individual attention and gain other people to turn up for, which is frequently the part that was missing. If a human in the room is what you need, this is usually the better buy before any app.",
      },
      {
        question: "Can an app replace a personal trainer?",
        answer:
          "It can replace the programming and the record-keeping. It cannot replace hands-on correction of an unfamiliar lift, a trained eye on an injury, or the social obligation of a booked appointment. Whether that matters depends on which of those you were paying for.",
      },
    ],
  },
  {
    slug: "is-an-ai-personal-trainer-worth-it",
    topic: "Cost & alternatives",
    title: "Is an AI personal trainer worth it?",
    h1: "Is an AI personal trainer worth it?",
    description:
      "What the phrase actually covers, the four things it genuinely cannot do, and a straight answer about who should and should not bother.",
    summary:
      "What the phrase actually covers, the four things it cannot do, and who should not bother.",
    published: "2026-09-21",
    modified: "2026-09-21",
    readingMinutes: 7,
    related: ["personal-trainer-alternatives", "chatgpt-vs-fitness-app"],
    faqs: [
      {
        question: "Is an AI personal trainer worth it?",
        answer:
          "At a few dollars a month it clears a low bar: if it gets you training one extra session a week, it has paid for itself many times over against any human rate. It is not worth it if you needed hands-on coaching, are training around an injury, or will not open the app.",
      },
      {
        question: "Can an AI personal trainer correct your form?",
        answer:
          "Not reliably, and be sceptical of anything claiming otherwise. Camera-based form checking exists but is limited by angle, lighting and framing, and it cannot feel what a coach feels. AdimFit does not attempt it at all — it works from what you log, not from watching you.",
      },
      {
        question: "What can an AI personal trainer actually do?",
        answer:
          "Write and adjust programming, remember what you did and progress it, adapt a session to the time and equipment you have today, answer questions in plain language, and keep a record you can look back on. That covers a real portion of what people pay a trainer for.",
      },
      {
        question: "Who should not use an AI fitness coach?",
        answer:
          "Anyone learning a barbell lift from scratch who has nobody watching, anyone rehabilitating an injury, anyone training for a competition with specific technical demands, and anyone who already knows that only a booked appointment with a real person gets them moving.",
      },
    ],
  },
];

export function guide(slug: string): Guide {
  const found = GUIDES.find((entry) => entry.slug === slug);
  if (!found) throw new Error(`[guides] unknown slug: ${slug}`);
  return found;
}

/** Long dates, written out, so the page never shows an ISO string. */
export function guideDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
