// src/lib/share-lines.ts

/**
 * ── LINES FOR THE SHARE CARD ────────────────────────────────────────
 * Written for AdimFit rather than borrowed.
 *
 * Two reasons this isn't a list of famous quotes. Reproducing
 * attributed quotations on a commercial product carries copyright
 * exposure, and — more practically — "no pain, no gain" on a black
 * background is what every other fitness app posts. These are rooted
 * in *a dị m*, "I am", so every share reinforces the positioning
 * instead of borrowing someone else's.
 *
 * They also hold the product's safety line: nothing here celebrates
 * training through pain, frames rest as weakness, or says anything
 * about anyone's body. A line that gets screenshotted and shared is
 * the last place to be careless about that.
 * ─────────────────────────────────────────────────────────────────────
 */

export const SHARE_LINES: string[] = [
  // ── Identity ────────────────────────────────────────────────────
  "I am not getting fit. I am fit, and today proved it.",
  "You don't become someone new. You keep showing up as who you already are.",
  "A dị m. I am. Everything after that is just practice.",
  "The person who trains today is the same one who'll train next month.",
  "Fitness isn't a destination you reach. It's a name you answer to.",

  // ── Consistency over intensity ──────────────────────────────────
  "The session you almost skipped counts double.",
  "Showing up tired is worth more than showing up perfect.",
  "Small sessions, stacked, beat big sessions, scattered.",
  "Twenty honest minutes outrank an hour you keep postponing.",
  "Nobody builds anything in one session. Everybody builds it in a hundred.",
  "The plan you actually follow beats the plan that impressed you.",
  "Momentum is just a decision you keep making.",

  // ── Progress ────────────────────────────────────────────────────
  "Every rep today is the baseline you'll beat next week.",
  "Progress is quiet. It shows up in numbers, not in mirrors.",
  "You're not repeating yesterday. You're building on it.",
  "Strength is a receipt. This is one.",
  "Add one rep. That's the whole strategy.",
  "What felt hard last month is your warm-up now.",

  // ── Rest, honestly ──────────────────────────────────────────────
  "Rest days aren't gaps in the work. They are the work.",
  "Recovery is where the session actually pays out.",
  "You can't build on a body you never let repair.",

  // ── Starting and restarting ─────────────────────────────────────
  "There's no lost time to make up. There's only today.",
  "Restarting isn't starting over. You keep everything you learned.",
  "The gap doesn't erase the work before it.",
  "Beginning again is a skill. Most people never learn it.",

  // ── Effort ──────────────────────────────────────────────────────
  "Nobody is watching. Do it properly anyway.",
  "The last set is where the session becomes real.",
  "Effort you can repeat tomorrow is the right amount.",
  "Finish the set you'd rather cut short.",
  "This wasn't convenient. You did it anyway.",
];

/**
 * Picks a line for one specific card.
 *
 * Seeded by date AND workout id, deliberately. Date alone would give
 * everyone the same line on the same day — fine for brand consistency,
 * awkward when two friends post identical cards an hour apart. Adding
 * the workout id varies it across people while keeping it stable for a
 * given card, so re-sharing doesn't produce a different quote.
 */
export function lineForCard(date: string, workoutId: string): string {
  const seed = `${date}:${workoutId}`;

  // FNV-1a: small, fast, and well distributed for short strings —
  // adjacent seeds shouldn't land on adjacent lines.
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const index = Math.abs(hash) % SHARE_LINES.length;
  return SHARE_LINES[index];
}