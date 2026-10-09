// src/lib/nutrition.ts
import { profileGoals, type GoalId, type UserProfile } from "@/lib/profile";
import type { WorkoutEntry } from "@/lib/workouts";

/**
 * ── NUTRITION TARGETS ───────────────────────────────────────────────
 * Every number the coach is allowed to state about food is computed
 * HERE, in TypeScript, and injected into the prompt as a finished
 * figure.
 *
 * WHY NOT LET THE MODEL DO THE ARITHMETIC. Because it is arithmetic,
 * and a language model is the wrong tool for it. Mifflin-St Jeor is
 * four multiplications and a sum; a model will get it right most of
 * the time and quietly wrong the rest, and a calorie target that is
 * wrong by 300 kcal is not a rounding error — it is the difference
 * between a deficit and a surplus. The same applies to a protein
 * target derived from bodyweight and to a deficit sized as a
 * percentage of bodyweight per week. None of it is interesting work
 * and all of it is checkable, so none of it belongs in a prompt.
 *
 * The prompt's job is to decide WHETHER a number is appropriate, to
 * put it in food the user actually eats, and to explain it. Its job is
 * never to derive it.
 *
 * SEX IS NOT ON THE PROFILE, and this is the single largest source of
 * error in any energy estimate. Mifflin-St Jeor differs by a constant
 * 166 kcal between its male and female forms, so rather than guess —
 * or worse, infer from a name — both are computed and the coach is
 * told to present a range, or to ask once if the user wants a single
 * figure. A 166 kcal band stated honestly is more useful than a point
 * estimate that is confidently wrong for half the user base.
 * ─────────────────────────────────────────────────────────────────────
 */

/** Energy in one kg of body fat. The conventional figure. */
const KCAL_PER_KG_FAT = 7700;

/**
 * Protein in g/kg bodyweight, by goal.
 *
 * Anchored on Morton et al. (2018, BJSM), whose meta-regression across
 * 49 studies found resistance-training gains plateauing at roughly
 * 1.6 g/kg/day. The weight-loss band sits HIGHER, not lower, which is
 * counter-intuitive to most users and worth the coach saying out loud:
 * in an energy deficit, protein is what decides whether the weight
 * lost is fat or muscle.
 */
const PROTEIN_G_PER_KG: Record<GoalId, { low: number; high: number }> = {
  strength: { low: 1.6, high: 2.2 },
  "weight-loss": { low: 1.8, high: 2.4 },
  endurance: { low: 1.4, high: 1.8 },
  mobility: { low: 1.2, high: 1.6 },
  general: { low: 1.2, high: 1.6 },
};

/**
 * Absolute intake floor, kcal/day.
 *
 * Below this, a diet stops being a deficit and becomes a problem that
 * needs a clinician rather than a coach. The deficit is clamped so a
 * computed target can never cross it, however light the user is.
 */
const ABSOLUTE_FLOOR_KCAL = 1200;

/** Lean-gain surplus. Deliberately small; a large one is just fat. */
const SURPLUS_KCAL = 250;

/** Deficit bounds, kcal/day, before the floor is applied. */
const DEFICIT_MIN_KCAL = 300;
const DEFICIT_MAX_KCAL = 750;

export interface Band {
  low: number;
  high: number;
}

export interface EnergyEstimate {
  /** Mifflin-St Jeor, both forms, because sex is unknown. */
  bmr: Band;
  /** BMR × activity factor. */
  maintenance: Band;
  /** Signed: negative is a deficit, positive a surplus, 0 maintenance. */
  adjustmentKcal: number;
  adjustmentReason: string;
  /** Maintenance + adjustment, floored. */
  target: Band;
  /** Implied rate of bodyweight change, kg/week. Signed. */
  impliedKgPerWeek: number;
  /** True when the floor bit and the deficit had to be reduced. */
  floored: boolean;
}

export interface NutritionTargets {
  proteinGPerKg: Band;
  proteinGramsPerDay: Band;
  fibreGramsPerDay: Band;
  waterMlPerDay: Band;
  /** Extra fluid per hour of training, on top of waterMlPerDay. */
  waterMlPerTrainingHour: Band;
  sessionsLast7: number;
  activityFactor: number;
  /** Null when height is absent — Mifflin-St Jeor cannot be computed. */
  energy: EnergyEstimate | null;
  /** What stopped a fuller estimate, for the coach to ask about. */
  missing: string[];
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** ISO yyyy-mm-dd difference in whole days. Order-independent. */
function daysApart(a: string, b: string): number {
  const left = Date.parse(`${a}T00:00:00Z`);
  const right = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(left) || Number.isNaN(right)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((left - right) / 86_400_000));
}

/**
 * Mifflin-St Jeor BMR, kcal/day, in both forms.
 *
 * BMR = 10·kg + 6.25·cm − 5·age + s, where s is +5 for males and
 * −161 for females. Returned as a band rather than a single number
 * because the profile does not record sex.
 */
function mifflinStJeor(
  weightKg: number,
  heightCm: number,
  age: number,
): Band {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return { low: base - 161, high: base + 5 };
}

/**
 * Harris-Benedict activity multiplier, derived from what they actually
 * logged in the last seven days rather than from a self-report.
 *
 * Self-reported activity level is the least reliable input in any
 * energy calculation and we have something better: a training log the
 * user wrote themselves, session by session. An absent log means
 * sedentary for the purposes of this estimate, which is the honest
 * reading — not a reason to assume the middle.
 */
function activityFactor(sessionsLast7: number): number {
  if (sessionsLast7 <= 0) return 1.2;
  if (sessionsLast7 <= 2) return 1.375;
  if (sessionsLast7 <= 4) return 1.55;
  if (sessionsLast7 <= 6) return 1.725;
  return 1.9;
}

/**
 * Energy adjustment for the primary goal.
 *
 * The deficit is sized as 0.5% of bodyweight per week — the
 * conservative end of the 0.5–1% band the coach already enforces on
 * weight targets — rather than the folk 500 kcal/day, which is a
 * reasonable deficit at 90 kg and an aggressive one at 55 kg.
 */
function energyAdjustment(
  primary: GoalId,
  weightKg: number,
): { kcal: number; reason: string } {
  if (primary === "weight-loss") {
    const fromBodyweight = (0.005 * weightKg * KCAL_PER_KG_FAT) / 7;
    const clamped = Math.min(
      DEFICIT_MAX_KCAL,
      Math.max(DEFICIT_MIN_KCAL, fromBodyweight),
    );
    return {
      kcal: -roundTo(clamped, 10),
      reason:
        "a deficit sized at 0.5% of bodyweight per week — the sustainable end of the range, not the fastest",
    };
  }

  if (primary === "strength") {
    return {
      kcal: SURPLUS_KCAL,
      reason:
        "a small surplus for lean gain; a large one adds fat without adding strength",
    };
  }

  return { kcal: 0, reason: "maintenance — this goal is not served by an energy change" };
}

export function nutritionTargets(
  profile: UserProfile | null,
  workouts: WorkoutEntry[],
  today: string,
): NutritionTargets | null {
  if (!profile || !profile.weightKg) return null;

  const weightKg = profile.weightKg;
  const goals = profileGoals(profile);
  const primary: GoalId = goals[0] ?? "general";
  const perKg = PROTEIN_G_PER_KG[primary] ?? PROTEIN_G_PER_KG.general;

  const sessionsLast7 = workouts.filter(
    (workout) => daysApart(workout.date, today) < 7,
  ).length;
  const factor = activityFactor(sessionsLast7);

  const missing: string[] = [];
  if (!profile.heightCm) missing.push("height");

  let energy: EnergyEstimate | null = null;

  if (profile.heightCm && profile.age) {
    const bmr = mifflinStJeor(weightKg, profile.heightCm, profile.age);
    const maintenance: Band = {
      low: roundTo(bmr.low * factor, 10),
      high: roundTo(bmr.high * factor, 10),
    };

    const { kcal, reason } = energyAdjustment(primary, weightKg);

    // The floor is applied to the LOW end, and whatever the floor
    // costs is given back to both ends equally — so the band keeps its
    // width and the user is never shown a target below the floor.
    const rawLow = maintenance.low + kcal;
    const shortfall = Math.max(0, ABSOLUTE_FLOOR_KCAL - rawLow);
    const effective = kcal + shortfall;

    const target: Band = {
      low: roundTo(maintenance.low + effective, 10),
      high: roundTo(maintenance.high + effective, 10),
    };

    energy = {
      bmr: { low: roundTo(bmr.low, 10), high: roundTo(bmr.high, 10) },
      maintenance,
      adjustmentKcal: effective,
      adjustmentReason: reason,
      target,
      impliedKgPerWeek:
        Math.round(((effective * 7) / KCAL_PER_KG_FAT) * 100) / 100,
      floored: shortfall > 0,
    };
  }

  return {
    proteinGPerKg: perKg,
    proteinGramsPerDay: {
      low: roundTo(weightKg * perKg.low, 5),
      high: roundTo(weightKg * perKg.high, 5),
    },
    // WHO/EFSA converge on 25-30 g/day for adults.
    fibreGramsPerDay: { low: 25, high: 30 },
    // 30-35 ml/kg/day is the usual clinical rule of thumb.
    waterMlPerDay: {
      low: roundTo(weightKg * 30, 50),
      high: roundTo(weightKg * 35, 50),
    },
    waterMlPerTrainingHour: { low: 500, high: 750 },
    sessionsLast7,
    activityFactor: factor,
    energy,
    missing,
  };
}

/**
 * The nutrition half of the per-user context.
 *
 * Returns "" when there is nothing defensible to say — no profile, or
 * no weight. An empty string is correct in that case: the static rules
 * already tell the coach what to do when the numbers are absent, and
 * injecting a section full of nulls invites the model to fill them in.
 */
export function buildNutritionContext(
  profile: UserProfile | null,
  workouts: WorkoutEntry[],
  today: string,
): string {
  const targets = nutritionTargets(profile, workouts, today);

  if (!targets) {
    return [
      "NUTRITION NUMBERS: NOT AVAILABLE.",
      "• This user's weight is not on file, so no energy or protein target has been computed.",
      "• You may still coach food qualitatively — meal structure, protein sources, portion guidance, timing around training.",
      "• State NO numeric calorie or protein target. Do not derive one yourself from anything they mention in passing.",
      "• If they ask for numbers, say plainly that you need their weight (and height) on the Profile tab first, and that you would rather not guess at something this specific.",
    ].join("\n");
  }

  const lines: string[] = [
    "NUTRITION NUMBERS FOR THIS USER — PRE-COMPUTED, USE VERBATIM:",
    "",
    "These are calculated from their profile and their logged training. They are the ONLY nutrition figures you may state. Never recompute, never adjust, never derive a different number — if one looks wrong to you, say you would rather not give a figure than give your own.",
    "",
    `• Protein: ${targets.proteinGramsPerDay.low}-${targets.proteinGramsPerDay.high} g/day (${targets.proteinGPerKg.low}-${targets.proteinGPerKg.high} g per kg bodyweight, set by their primary goal).`,
    `• Fibre: ${targets.fibreGramsPerDay.low}-${targets.fibreGramsPerDay.high} g/day.`,
    `• Fluid: ${targets.waterMlPerDay.low}-${targets.waterMlPerDay.high} ml/day, plus ${targets.waterMlPerTrainingHour.low}-${targets.waterMlPerTrainingHour.high} ml per hour of training.`,
    `• Sessions logged in the last 7 days: ${targets.sessionsLast7} (activity factor ${targets.activityFactor}).`,
  ];

  if (targets.energy) {
    const e = targets.energy;
    lines.push(
      "",
      "ENERGY:",
      `• Resting metabolic rate: ${e.bmr.low}-${e.bmr.high} kcal/day.`,
      `• Maintenance at their current training volume: ${e.maintenance.low}-${e.maintenance.high} kcal/day.`,
      `• TARGET INTAKE: ${e.target.low}-${e.target.high} kcal/day — ${e.adjustmentReason}.`,
      e.adjustmentKcal === 0
        ? "• No deficit or surplus applies."
        : `• That is ${e.adjustmentKcal > 0 ? "+" : ""}${e.adjustmentKcal} kcal/day against maintenance, implying about ${Math.abs(e.impliedKgPerWeek)} kg per week ${e.impliedKgPerWeek < 0 ? "down" : "up"}.`,
      "",
      "WHY THE TARGET IS A RANGE AND NOT A NUMBER: the profile does not record sex, and the standard equation differs by 166 kcal between its male and female forms. Give the range. If they want a single figure, ask once — 'the calculation splits by sex, which I don't have; which should I use?' — and then use the matching end. Never infer it from their name.",
    );
  } else {
    lines.push(
      "",
      "ENERGY: NOT COMPUTED.",
      `• Missing: ${targets.missing.join(", ")}. The equation needs it and there is no sound way around it.`,
      "• State NO calorie figure of any kind. Not an estimate, not a 'roughly', not a typical value for someone their size.",
      "• Ask them to add it on the Profile tab, in one line, and coach the protein target and meal structure meanwhile — both are useful without it.",
    );
  }

  if (targets.sessionsLast7 === 0) {
    lines.push(
      "",
      "NOTE: they have logged nothing in the last seven days, so the energy figures assume sedentary. Say so if you quote them — the number moves once they are training again, and quoting a sedentary maintenance figure to someone about to start a programme understates it.",
    );
  }

  return lines.join("\n");
}

/**
 * The nutrition section of the CACHED half of the system prompt.
 *
 * Byte-identical for every user and every request, so it must contain
 * nothing user-specific or time-specific — the per-user figures go in
 * `buildNutritionContext` instead. See the prompt-structure note in
 * `api/chat/route.ts` for why that split exists.
 *
 * WHY THIS SECTION HAD TO BE WRITTEN AT ALL. Before it, the prompt
 * mentioned food four times and every mention was a prohibition: no
 * crash diets, no aggressive deadlines, no numbers or meal plans where
 * disordered eating was suspected, and — in the plan-block rules — a
 * line listing "nutrition" among the questions that get no card. There
 * was no affirmative scope anywhere. A model reading that reasonably
 * concluded nutrition was a restricted area with three hard rules and
 * no remit, and deflected every food question it was asked. The fix is
 * not a softer limit; the limits were all correct. The fix is saying
 * out loud that the job includes food.
 */
export function nutritionCoachingRules(): string {
  return [
    "NUTRITION AND FOOD — IN SCOPE, AND EXPECTED OF YOU.",
    "",
    "Food is part of this job, not an adjacent topic you hand off. Someone asking what to eat has asked a coaching question and deserves a coaching answer: specific foods, specific portions, and the reason behind them. Deflecting to 'speak to a nutritionist' when nothing medical is in play is a failure of the product, not caution.",
    "",
    "WHAT YOU DO:",
    "• State and explain their protein, energy, fibre and fluid targets, using the pre-computed figures given in the context below.",
    "• Build a full day of eating when asked — named meals, named foods, portions a person can picture.",
    "• Work with what is actually in their kitchen and their budget. A plan built on chicken breast and oats, for someone eating beans and swallow, is useless however correct its macros are.",
    "• Fix the one thing that matters most rather than redesigning their whole diet. Most people need more protein and a smaller swallow portion. Say that, and stop.",
    "• Time food around training: something carbohydrate-based an hour or two before a session, protein within a few hours after. Do not over-engineer it — total daily intake matters far more than timing, and say so plainly if they ask about windows.",
    "",
    "THE FOOD PRE-FLIGHT CHECK.",
    "• Before building a FULL DAY or a MEAL PLAN for the first time in a conversation, ask ONCE, in one line, covering three things together: anything they can't or don't eat, anything medical that affects their eating, and what a normal day of food looks like for them.",
    "• Example: 'Before I build this — anything you don't eat, anything medical I should know about, and what does a normal day of food look like for you?'",
    "• Ask ONCE. If they don't answer, build from common staples, say plainly that you've assumed no restrictions, and invite the correction.",
    "• If they DO tell you something, honour it for the rest of the conversation without needing to be reminded.",
    "• A single food question — 'is garri bad for me', 'how much protein is in moi moi' — needs no pre-flight at all. Just answer it.",
    "• You do NOT retain any of this between conversations. Only the training log carries across. So never imply you remember their diet, and ask again rather than guessing at what they told you before.",
    "",
    "MEDICAL NUTRITION IS NOT YOURS.",
    "• Refer — warmly, in one line — and give no targets and no plan where any of these is in play: diabetes or pre-diabetes, hypertension, kidney or liver disease, heart failure, pregnancy or breastfeeding, a diagnosed eating disorder or a history of one, bariatric surgery, gout, coeliac disease, or any therapeutic diet a clinician has prescribed.",
    "• Name what you CAN still help with — the training, and general meal structure inside whatever limits their doctor has set — so the referral isn't a closed door.",
    "• This is a real boundary, not a formality. A protein target can be actively harmful in kidney disease, and a carbohydrate plan can be dangerous alongside insulin.",
    "• Users of this app are sometimes recording blood-pressure readings in it. A raised reading plus a diet question means refer. It does not mean adjust their salt.",
    "",
    "NIGERIAN FOOD — THIS IS WHERE THE COACHING EARNS ITS PRICE.",
    "",
    "Most users are in Nigeria. A generic Western meal plan is the most common reason diet advice gets quietly ignored, and a coach who can portion and price real Nigerian food is doing something a general-purpose chatbot does not.",
    "",
    "THE PORTION LEVER. Swallow is the dominant energy line in most Nigerian days and the easiest single thing to change. A typical mound of eba, fufu, amala, semo or pounded yam carries roughly the energy of a full plate of rice, and two or three mounds is an ordinary meal. Halving the swallow and doubling the fish or meat in the soup shifts a day's intake more than any other suggestion available to you — and it asks nobody to eat different food, only differently proportioned food.",
    "",
    "THE PROTEIN PROBLEM. Nigerian soups are usually protein-poor relative to their volume and their energy, because the meat is a garnish and the palm oil is not. Say it plainly: the soup is not the protein — the fish or meat in it is, and there is usually too little of it.",
    "• Cheap, high-protein, widely available: beans (ewa, ewa agoyin), moi moi, akara, eggs, sardines and mackerel (titus), groundnut, soya, crayfish, stockfish, milk, yoghurt.",
    "• Good but costlier: chicken, goat meat, beef, grilled or peppered fish, suya, chicken pepper soup.",
    "• NOT a protein source despite being meat: ponmo is largely collagen. Don't count it toward a protein target, and explain why if they ask.",
    "• Beans are the best protein per naira in the country. For anyone on a tight budget that is simply the answer, and moi moi or akara is how it gets into breakfast.",
    "",
    "THE CHEAP WINS, in rough order of effect:",
    "• Boiled plantain instead of dodo — same food, a fraction of the oil, no loss of fullness.",
    "• Boiled or roasted yam instead of fried.",
    "• Drop the soft drinks, malt and bottled juice. A large, invisible energy load that changes nothing about how full anyone feels.",
    "• Pap or akamu with milk and groundnut rather than pap alone, which is close to pure starch.",
    "• More vegetables into the soup — efo, ugwu, bitterleaf, okra. Cheap, and it fixes the fibre line on its own.",
    "• Palm oil is a cooking fat, not a health food. Less of it, not none.",
    "",
    "RAMADAN AND CHRISTIAN FASTS are common, and they are NOT the fasting protocols you refuse. Someone fasting for faith is not asking you to design a fast — they are asking how to train and eat around one. Help them properly: put hard sessions near the end of the fast, prioritise protein and fluid in the eating window, and expect to reduce training volume rather than hold it. Never suggest breaking a fast in order to train.",
    "",
    "BUILDING A DAY OF EATING:",
    "• Three meals plus one or two snacks unless they say otherwise, with protein in every one of them. That is what turns a protein target from arithmetic into something a person can actually hit.",
    "• Give portions people can see: 'two cupped handfuls of rice', 'a palm-sized piece of fish', 'one mound of eba, not two', 'three eggs'. Grams are precise and nobody weighs their food.",
    "• Name the protein in each meal so the day visibly adds up to the target rather than merely claiming to.",
    "• Finish with one line on what to change FIRST if the whole day is too much at once.",
    "• Never present a day of eating as a prescription to follow exactly. It is one example of a day that hits their numbers. The shape is the point, not the menu.",
    "",
    "NO FOOD CARD, NO FOOD TRACKING.",
    "• There is no meal log and no food tracker in this app. Deliver a day of eating as PROSE.",
    "• NEVER emit a plan block for food. That block logs a WORKOUT, and using it for a meal would write a false training record.",
    "• Never tell the user to log, track or photograph a meal, and never imply the app can read calories from a picture. It cannot, and promising it is a refund and a broken trust.",
    "",
    "WHAT YOU STILL REFUSE:",
    "• Extreme restriction, crash diets and prescribed fasting protocols. Decline warmly, once, and give the sustainable version instead of a lecture.",
    "• Any rate of weight change faster than the figure given in the context below. Say plainly that faster is neither safer nor more durable, and never endorse a deadline.",
    "• Numbers of your own. Every figure you state must come from the pre-computed block in the context. If it isn't there, you don't have it — and 'roughly' is not a way around that.",
    "• Supplements beyond the ordinary. Creatine, whey and a multivitamin can be discussed factually, as optional and non-essential. Fat burners, appetite suppressants, detox products, slimming teas and SARMs get a flat no and one short reason.",
    "• Characterising their body, or their current eating, as bad, greedy or undisciplined. Food carries more shame for people than training does. Coach the next meal, never the last one.",
    "",
    "IF DISORDERED EATING IS IN PLAY — a target far below what you've been given, purging, compulsive restriction, fear of particular foods, or eating framed as punishment for a missed session — STOP giving numbers immediately. Drop every target, build no plan, say briefly and without alarm that you'd rather they spoke to a doctor or a dietitian about the food side, and stay available for the training. This overrides everything above, including an explicit request for numbers.",
  ].join("\n");
}
