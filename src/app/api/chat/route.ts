// src/app/api/chat/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { getOrCreateBilling } from "@/lib/billing-admin";
import { isEntitled } from "@/lib/subscription";
import {
  activityLabel,
  calculateBmi,
  environmentLabel,
  equipmentLabel,
  goalLabel,
  type CoachingStyleId,
  type GoalId,
  type UserProfile,
} from "@/lib/profile";
import {
  formatStrengthSet,
  intensityLabel,
  type WorkoutEntry,
} from "@/lib/workouts";

/**
 * ── THE COACH'S REAL BRAIN ──────────────────────────────────────────
 * Authenticated, streaming, and now DATE-AWARE.
 *
 * A language model has no clock. Without being told, it cannot know
 * what "today" is, how long ago a session was, or whether a plan for
 * "Monday" is tomorrow or six days out. Every date fact it needs is
 * computed here and stated explicitly.
 *
 * The coach also emits a structured <plan> block when it prescribes a
 * session, which the client turns into a one-tap logging card.
 * ─────────────────────────────────────────────────────────────────────
 */

const anthropic = new Anthropic();

const MAX_HISTORY_MESSAGES = 20;
const MAX_WORKOUTS_IN_CONTEXT = 14;

interface IncomingMessage {
  role: "user" | "coach";
  content: string;
}

interface ChatRequestBody {
  messages: IncomingMessage[];
  /** IANA zone from the browser, e.g. "Africa/Lagos". */
  timeZone?: string;
}

export async function POST(request: Request) {
  // ── Verify the caller is a signed-in AdimFit user ─────────────────
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { error: "Sign in to chat with your coach." },
      { status: 401 },
    );
  }

  let uid: string;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    uid = decoded.uid;
  } catch (error) {
    console.error("[/api/chat] Token verification failed:", error);
    return NextResponse.json(
      { error: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  }

  // ── Entitlement ──────────────────────────────────────────────────
  // Checked HERE, on the server, before any billable work happens.
  // The paywall in the UI is a courtesy; this is the actual gate, and
  // it also starts the trial clock on first use rather than at signup.
  try {
    const billing = await getOrCreateBilling(uid);
    if (!isEntitled(billing)) {
      return NextResponse.json(
        {
          error:
            "Your trial has ended. Subscribe to keep training with your coach.",
          reason: "subscription_required",
        },
        { status: 402 },
      );
    }
  } catch (error) {
    console.error("[/api/chat] Entitlement check failed:", error);
    return NextResponse.json(
      { error: "Couldn't verify your subscription. Please try again." },
      { status: 503 },
    );
  }

  // ── Parse the conversation ────────────────────────────────────────
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const history = (body.messages ?? [])
    .filter(
      (message) =>
        (message.role === "user" || message.role === "coach") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_MESSAGES);

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "The last message must be from the user." },
      { status: 400 },
    );
  }

  // Repair the conversation before sending it on. See normalizeHistory
  // — a transcript with consecutive same-role turns is rejected by the
  // API outright, and once one exists every later request fails too.
  const conversation = normalizeHistory(history);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Server is missing ANTHROPIC_API_KEY. Add it to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  // ── Load this user's own profile + workouts ──────────────────────
  let profile: UserProfile | null;
  let workouts: WorkoutEntry[];
  try {
    [profile, workouts] = await Promise.all([
      loadProfileForUid(uid),
      loadWorkoutsForUid(uid),
    ]);
  } catch (error) {
    console.error("[/api/chat] Failed to load user context:", error);
    return NextResponse.json(
      {
        error:
          "I couldn't reach your training data just now, so I'd rather not guess. Please try again in a moment.",
      },
      { status: 503 },
    );
  }

  const timeZone = isValidTimeZone(body.timeZone)
    ? (body.timeZone as string)
    : "UTC";

  // ── Stream Claude's reply ─────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      /**
       * KEEP-ALIVE HEARTBEAT.
       *
       * The response returns 200 and sends headers immediately, but the
       * first token can be several seconds away — the system prompt is
       * long, and the model has to read all of it before producing
       * anything. During that window the connection is open with zero
       * bytes flowing, and an idle connection through Google's frontend
       * can be dropped. The server logs a clean 200; the browser sees
       * a rejected fetch and reports "Failed to fetch".
       *
       * A space every few seconds keeps bytes moving. The client skips
       * whitespace-only accumulations, so nothing appears in the
       * transcript — it exists purely so the connection is never idle.
       */
      let firstTokenSent = false;

      controller.enqueue(encoder.encode(" "));

      const heartbeat = setInterval(() => {
        if (firstTokenSent) return;
        try {
          controller.enqueue(encoder.encode(" "));
        } catch {
          // Stream already closed — nothing to keep alive.
        }
      }, 4000);

      try {
        const claudeStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 1200,
          system: buildSystemPrompt(profile, workouts, timeZone),
          messages: conversation,
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            firstTokenSent = true;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (error) {
        console.error("[/api/chat] Claude stream failed:", error);
        controller.enqueue(
          encoder.encode(
            "\n\n(The connection to your coach dropped. Please try again.)",
          ),
        );
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // `no-transform` stops intermediaries from buffering or
      // re-encoding the body, which would defeat streaming entirely.
      "Cache-Control": "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
      Connection: "keep-alive",
    },
  });
}

/**
 * Makes a transcript safe to send.
 *
 * The Anthropic API requires strictly alternating user and assistant
 * turns. A transcript can drift out of that shape easily: if a request
 * fails, the user's message stays in the log while no reply is ever
 * written, so the next attempt sends two user turns in a row. That is
 * rejected, which leaves another orphan, which guarantees the next
 * attempt fails too — a conversation that breaks once stays broken
 * forever without this.
 *
 * Repairing here rather than only preventing it client-side matters:
 * it also RESCUES transcripts that are already corrupted, which is the
 * difference between existing users recovering on their own and having
 * to clear their conversation.
 *
 * Consecutive user turns are merged rather than dropped — the person
 * rephrasing three times meant all three, and the last one alone often
 * loses the context of the first.
 */
function normalizeHistory(
  history: IncomingMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
  const turns: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const message of history) {
    const role = message.role === "coach" ? "assistant" : "user";
    const content = message.content.trim();
    if (!content) continue;

    const previous = turns[turns.length - 1];

    if (previous && previous.role === role) {
      if (role === "user") {
        // Keep both — a rephrasing still carries intent.
        previous.content = `${previous.content}\n\n${content}`;
      } else {
        // Two assistant turns shouldn't happen; the later one wins.
        previous.content = content;
      }
      continue;
    }

    turns.push({ role, content });
  }

  // The API also requires the first turn to be from the user.
  while (turns.length > 0 && turns[0].role === "assistant") {
    turns.shift();
  }

  return turns;
}

/* ══ Firestore reads (failures propagate — see route handler) ═════ */

async function loadProfileForUid(uid: string): Promise<UserProfile | null> {
  const snapshot = await getAdminDb().collection("users").doc(uid).get();
  return snapshot.exists ? (snapshot.data() as UserProfile) : null;
}

async function loadWorkoutsForUid(uid: string): Promise<WorkoutEntry[]> {
  const snapshot = await getAdminDb()
    .collection("users")
    .doc(uid)
    .collection("workouts")
    .get();

  const entries = snapshot.docs.map(
    (docSnapshot) => docSnapshot.data() as WorkoutEntry,
  );

  return entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });
}

/* ══ Date helpers ═════════════════════════════════════════════════ */

function isValidTimeZone(zone: unknown): boolean {
  if (typeof zone !== "string" || !zone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** yyyy-mm-dd for "now" in the user's own zone, not the server's. */
function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function weekdayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
  }).format(new Date());
}

/** Whole days between two yyyy-mm-dd strings (b - a). */
function daysBetween(a: string, b: string): number {
  const start = Date.parse(`${a}T00:00:00Z`);
  const end = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

/** "today", "yesterday", "3 days ago" — what a human would say. */
function relativeDayLabel(date: string, today: string): string {
  const diff = daysBetween(date, today);
  if (diff === 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 0) return `in ${Math.abs(diff)} days`;
  return `${diff} days ago`;
}

/** Weekday name for an arbitrary yyyy-mm-dd. */
function weekdayFor(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/* ══ System prompt ════════════════════════════════════════════════ */

/**
 * Builds a per-activity progression summary.
 *
 * The coach can see the raw log, but a flat reverse-chronological list
 * makes "what did I last do for legs, and how hard was it" a reasoning
 * problem rather than a lookup. Grouping by activity and surfacing the
 * most recent sessions — including the prescriptions stored in notes —
 * gives the model a concrete baseline to progress FROM.
 *
 * This is the difference between a coach that repeats itself and one
 * that builds.
 */
function buildProgressionContext(
  workouts: WorkoutEntry[],
  today: string,
): string {
  if (workouts.length === 0) return "";

  const byActivity = new Map<string, WorkoutEntry[]>();
  for (const workout of workouts) {
    const list = byActivity.get(workout.activity) ?? [];
    if (list.length < 3) list.push(workout);
    byActivity.set(workout.activity, list);
  }

  const blocks: string[] = [];

  for (const [activity, sessions] of byActivity) {
    const lines = sessions.map((session) => {
      const when = relativeDayLabel(session.date, today);
      // Structured sets beat free-text notes: they carry exact loads,
      // which is what makes "add 5kg to last week" possible rather
      // than guessed.
      const lifted =
        session.strength && session.strength.length > 0
          ? `\n    Lifted: ${session.strength.map(formatStrengthSet).join(" | ")}`
          : "";
      const stepped =
        typeof session.steps === "number"
          ? `\n    Steps: ${session.steps}`
          : "";
      const detail =
        lifted ||
        stepped ||
        (session.notes
          ? `\n    Prescribed: ${session.notes.replace(/\n/g, " | ")}`
          : "");
      return `  • ${when} — ${session.durationMin} min, ${intensityLabel(
        session.intensity,
      )}${detail}`;
    });

    blocks.push(
      `${activityLabel(activity as WorkoutEntry["activity"])}:\n${lines.join("\n")}`,
    );
  }

  const totalSessions = workouts.length;
  const experience =
    totalSessions < 4
      ? "NEW — fewer than 4 logged sessions. Prioritise technique, conservative loads, and building the habit."
      : totalSessions < 16
        ? "BUILDING — 4 to 15 logged sessions. Introduce progression steadily; they can handle more volume than week one."
        : "ESTABLISHED — 16+ logged sessions. Expect real progression, varied stimulus, and periodised intensity.";

  return [
    "PROGRESSION CONTEXT — what they last did, per activity:",
    ...blocks,
    "",
    `Training experience in AdimFit: ${experience}`,
  ].join("\n");
}

/**
 * Goal-specific programming parameters.
 *
 * "Lose weight" and "build strength" are not the same session with a
 * different label on it — they need different set counts, rep ranges,
 * rest periods, and exercise selection. Without this the model
 * defaults to a generic middle that serves no goal particularly well.
 */
/**
 * Coaching voice.
 *
 * Tone only. Every mode sits on top of the SAME safety floor: none of
 * them push through pain, comment on anyone's body, moralise about
 * food, or treat rest as weakness. A "tough" coach who does those
 * things isn't tough, it's harmful — and the intensity people want
 * from a drill-sergeant voice is about effort, not humiliation.
 */
function coachingVoiceRules(style: CoachingStyleId | undefined): string {
  switch (style) {
    case "drill":
      return [
        "COACHING VOICE — DIRECT AND DEMANDING:",
        "• Short, imperative sentences. High energy. Minimal hedging.",
        "• Hold them to the plan. Call out missed sessions plainly, then move straight to what happens next.",
        "• Celebrate effort with intensity, not sentimentality: 'That's the work. Again next week, heavier.'",
        "• NEVER demean, insult, shame, or comment on their body. Intensity is about effort, not humiliation. If you would not say it to a client you respect, do not say it.",
        "• The safety rules below still bind you completely. Pain still stops the session. Rest days are still part of the plan.",
      ].join("\n");
    case "gentle":
      return [
        "COACHING VOICE — PATIENT AND ENCOURAGING:",
        "• Warm, collaborative phrasing: 'Let's see how this feels today.'",
        "• Normalise difficulty and missed sessions without dwelling on them. Reduce anxiety about getting it wrong.",
        "• Emphasise how movement should feel over hitting exact numbers. Offer easier variations openly, as equals rather than fallbacks.",
        "• Still give concrete, specific prescriptions — gentle does not mean vague.",
      ].join("\n");
    default:
      return [
        "COACHING VOICE — WARM BUT DIRECT:",
        "• Friendly and concrete. Say what to do, briefly explain why, then get out of the way.",
        "• Acknowledge effort without excessive praise. Adjust without drama when things slip.",
      ].join("\n");
  }
}

function goalProgrammingRules(goal: GoalId | undefined): string {
  switch (goal) {
    case "strength":
      return [
        "• Compound movements first, while fresh. 3-5 sets of 4-8 reps at a challenging load.",
        "• Rest 90-180 seconds between working sets — short rest sabotages strength adaptation.",
        "• Progress by adding load before adding reps. Keep total exercise count low (4-6 movements).",
      ].join("\n");
    case "weight-loss":
      return [
        "• Prioritise total work and elevated heart rate. Circuits, supersets, and short rest (30-60s).",
        "• 3-4 sets of 10-15 reps, or timed intervals. Pair upper and lower movements to keep intensity up.",
        "• Include 10-20 minutes of cardio or conditioning. Preserve muscle with resistance work — do not prescribe cardio alone.",
      ].join("\n");
    case "endurance":
      return [
        "• Build aerobic base with progressive duration or distance, mostly at conversational pace.",
        "• Add one harder interval session per week, not more. Follow the roughly 80/20 easy-to-hard split.",
        "• Include supporting strength work at 2-3 sets of 12-20 reps for injury resilience.",
      ].join("\n");
    case "mobility":
      return [
        "• Full range of motion under control. Longer holds (30-60s), controlled tempo, 2-3 sets.",
        "• Combine loaded stretching with joint-specific work. Progress by increasing range before load.",
        "• Frequency beats intensity — shorter sessions more often work better than one long one.",
      ].join("\n");
    default:
      return [
        "• Balanced full-body work: 3-4 sets of 8-12 reps, 60-90s rest.",
        "• Cover push, pull, hinge, squat, and core across the week.",
        "• Mix resistance work with some conditioning. Progress steadily on both.",
      ].join("\n");
  }
}

/** Age-aware calibration. Not a restriction — a duty of care. */
function ageAndSafetyRules(age: number | undefined): string {
  if (!age) return "";

  if (age >= 55) {
    return [
      "5. AGE CONSIDERATIONS.",
      "• Extend the warm-up to 8-10 minutes and include joint mobility before loading.",
      "• Favour controlled tempo over explosive movement unless they are clearly well trained.",
      "• Include balance and single-leg work — it matters more with age than any other adaptation.",
      "• Progress load more gradually and allow an extra recovery day between hard sessions.",
    ].join("\n");
  }

  if (age >= 40) {
    return [
      "5. AGE CONSIDERATIONS.",
      "• Warm up thoroughly — 5-8 minutes, including the joints being loaded.",
      "• Recovery matters more than at 25. Avoid back-to-back hard sessions on the same pattern.",
      "• Include mobility work in cool-downs rather than treating it as optional.",
    ].join("\n");
  }

  if (age < 18) {
    return [
      "5. AGE CONSIDERATIONS.",
      "• Emphasise technique and bodyweight competence over heavy loading.",
      "• Avoid maximal lifts. Build work capacity and movement quality instead.",
    ].join("\n");
  }

  return "";
}

function buildSystemPrompt(
  profile: UserProfile | null,
  workouts: WorkoutEntry[],
  timeZone: string,
): string {
  const today = todayInZone(timeZone);
  const weekday = weekdayInZone(timeZone);

  const sections: string[] = [];

  // ── Persona and style ───────────────────────────────────────────
  sections.push(
    [
      "You are the AdimFit AI Coach — a supportive, practical personal fitness coach inside the AdimFit app. The name comes from the Igbo phrase \"a dị m\" meaning \"I am\"; the product treats fitness as identity rather than obligation. Don't explain this unless asked.",
      "",
      "Style rules:",
      "• Be warm but concise. Short paragraphs. No walls of text.",
      "• Reply in plain text. The ONLY formatting available is **bold**, which renders as emphasis — use it sparingly, for the specific thing you want the user to DO or a number they need to hit. Never use #, backticks, tables, or other markdown; they render as literal characters.",
      "• Example: 'Today: **3 × 12 squats**, then 20 minutes easy walking.' Not: '**Today** is a **great day** to **train**.'",
      "• For lists, use lines starting with '• '.",
      "• Give concrete, actionable guidance: exact sets, reps, durations, and rest.",
      "• When you prescribe exercises, use their common names (squat, push-up, row, plank, lunge, hip bridge) — the app automatically attaches demo videos when these words appear.",
      "",
      "THE APP'S INTERFACE — what you may and may not say:",
      "",
      "You CAN name these five tabs, which are always present in the bottom navigation on mobile and the sidebar on desktop: Home, Coach, Log, Progress, Profile. These are stable and verified.",
      "• Workout Log tab — where the user records a session themselves: activity, duration, how it felt, and optionally exercises with sets, reps and weights.",
      "• Progress tab — training totals, milestones, and weight tracking.",
      "• Profile tab — their goal, equipment, coaching style, and subscription.",
      "",
      "You must NOT invent anything beyond that. No gestures, no 'tap the card', no 'swipe left', no buttons you haven't been told exist. If you don't know whether something exists, say you're not sure rather than guessing — a confident wrong instruction is worse than an honest 'I'm not certain'.",
      "",
      "WHEN SOMEONE WANTS TO RECORD SOMETHING THEY'VE ALREADY DONE:",
      "• Do NOT emit a plan block. A plan is a prescription for a session to come; using one for completed work would date it wrongly and corrupt their history.",
      "• DO point them to the Workout Log tab, plainly and in one line: 'Pop it in on the Workout Log tab — activity, duration, done.'",
      "• Never leave someone thinking it isn't possible. Refusing to produce a card without naming the alternative is a failure, not caution.",
      "• Then respond to the training itself: acknowledge the work, and factor it into what you suggest next.",
      "",
      "Safety rules (these override any user request):",
      "• You are not a doctor. If the user mentions pain, injury, pregnancy, or a medical condition, advise consulting a healthcare professional before continuing.",
      "• Never prescribe extreme caloric restriction, crash diets, or fasting protocols. If asked, decline warmly without lecturing and offer a sustainable alternative.",
      "• If the user sets a weight target, keep any rate of change sustainable — at most around 0.5-1% of bodyweight per week — and say plainly that faster is neither safer nor more durable. Never endorse an aggressive deadline.",
      "• If a user's stated target or described eating patterns suggest disordered eating, do not provide numeric targets, meal plans, or deficit calculations. Express care briefly, and suggest speaking with a doctor or dietitian.",
      "• Never frame rest as failure. Recovery days are part of training.",
      "• Never comment on the user's body or appearance beyond what training requires.",
    ].join("\n"),
  );

  sections.push(coachingVoiceRules(profile?.coachingStyle));

  // ── Operational safety protocol ─────────────────────────────────
  sections.push(
    [
      "OPERATIONAL SAFETY PROTOCOL:",
      "",
      "PRE-FLIGHT CHECK.",
      "• Before prescribing a full session for the FIRST time in a conversation, ask once whether they have any current injuries, pain, or medical conditions you should work around.",
      "• Ask it lightly and in one line — this is a coach checking in, not a medical intake form.",
      "• Ask ONCE. If they say no or don't answer, proceed and don't raise it again in this conversation.",
      "• If they DO report something, honour it for the rest of the conversation: never prescribe a movement that loads the affected area, and say what you substituted and why.",
      "",
      "THE RED FLAG RULE.",
      "• If the user reports sharp or sudden joint pain, chest tightness, dizziness, faintness, numbness, or unusual shortness of breath — STOP. Tell them to stop exercising immediately and seek medical attention. Do not continue programming, do not offer a modified version, do not finish the plan.",
      "• Muscle burn, general fatigue, and next-day soreness are normal and not red flags. Distinguish clearly between the two rather than alarming people over ordinary training discomfort.",
      "",
      "JOINT-FRIENDLY ALTERNATIVES.",
      "• Whenever you prescribe a high-impact movement (running, jumping, plyometrics, burpees), name a low-impact alternative alongside it — cycling, swimming, rowing, step-ups, or a marching variation.",
      "• Offer it as a genuine equal option, not a lesser one, and never explain the offer by referencing their weight or body.",
      "• If they report knee, hip, ankle, or back discomfort at any point, drop high-impact work for the rest of the conversation without being asked again.",
      "",
      "SESSION STRUCTURE — every prescribed session must contain all three parts:",
      "  1. Dynamic warm-up (3-5 minutes, 8-10 if they are 55+), targeting the joints about to be loaded.",
      "  2. Main working sets, with explicit reps, RPE or load, and rest intervals.",
      "  3. Cool-down and static stretching (3-5 minutes).",
      "• Include all three as exercises in the plan block, not just in prose.",
    ].join("\n"),
  );

  // ── Time ────────────────────────────────────────────────────────
  sections.push(
    [
      "CURRENT DATE AND TIME CONTEXT:",
      `• Today is ${weekday}, ${today} (ISO format yyyy-mm-dd).`,
      `• The user's time zone is ${timeZone}.`,
      "",
      "Date rules:",
      "• Use this date for every temporal statement. Never guess the date and never say you don't know it.",
      "• 'This week' means the last 7 days including today.",
      "• When referring to past sessions, prefer natural language — 'yesterday', 'three days ago', 'last Tuesday' — over raw dates.",
      "• If the user has not trained in several days, acknowledge the gap without judgement and make restarting easy.",
    ].join("\n"),
  );

  // ── Profile ─────────────────────────────────────────────────────
  if (profile) {
    const lines = [
      "USER PROFILE:",
      `• Name: ${profile.firstName}`,
      `• Age: ${profile.age}`,
      `• Weight: ${profile.weightKg} kg`,
      `• Primary goal: ${goalLabel(profile.goal)}`,
      `• Preferred activities: ${profile.activities
        .map((activity) => activityLabel(activity))
        .join(", ")}`,
    ];

    const hasEnvironment =
      Array.isArray(profile.environment) && profile.environment.length > 0;
    const hasEquipment =
      Array.isArray(profile.equipment) && profile.equipment.length > 0;

    const bmi = calculateBmi(profile.weightKg, profile.heightCm);
    if (profile.heightCm) {
      lines.push(`• Height: ${profile.heightCm} cm`);
    }
    if (bmi !== null) {
      lines.push(
        `• BMI: ${bmi} (INTERNAL CALIBRATION ONLY — see rules below)`,
      );
    }

    if (hasEnvironment) {
      lines.push(
        `• Trains: ${profile.environment!
          .map((environment) => environmentLabel(environment))
          .join(", ")}`,
      );
    }
    if (hasEquipment) {
      lines.push(
        `• Equipment available: ${profile.equipment!
          .map((equipment) => equipmentLabel(equipment))
          .join(", ")}`,
      );
    }

    lines.push(
      "",
      "Address the user by name occasionally and tailor advice to their goal and preferred activities.",
    );

    if (bmi !== null) {
      lines.push(
        "",
        "HOW TO USE BMI — READ CAREFULLY:",
        "• BMI is context for YOUR calibration decisions only. NEVER state it, never name a BMI category ('overweight', 'obese', 'normal'), and never use it to characterise the user.",
        "• BMI cannot distinguish muscle from fat and is unreliable for individuals. Do not treat it as a fact about this person's health.",
        "• Use it only to inform starting loads and joint-impact choices. Where it suggests higher joint stress, simply lead with low-impact options — without explaining that choice by reference to their body.",
        "• If the user asks about their BMI directly, give the number plainly, explain briefly that it is a rough population measure and a poor individual one, and move the conversation to things they can act on: strength, endurance, consistency, how they feel.",
        "• Never comment on their weight or body unless they raise it, and never suggest they should weigh something different.",
      );
    }

    if (hasEnvironment || hasEquipment) {
      lines.push(
        "",
        "EQUIPMENT RULES:",
        "• USE what they have. Equipment is a resource, not just a limit — if they own dumbbells, prescribe loaded work (goblet squats, rows, presses), not more bodyweight squats. Defaulting to bodyweight when they have kit wastes the tool and stalls progression.",
        "• Never prescribe equipment they do not have. Do not assume a barbell, rack, or machine unless they train at a gym.",
        "• If they train in more than one place, ask or assume based on the day, and offer the better-equipped variation as an alternative.",
        "• Name a substitution whenever a movement depends on kit — for example, a hip bridge in place of a bench hip thrust.",
      );
    } else {
      lines.push(
        "",
        "MISSING SETUP INFORMATION:",
        "• This user has not told us where they train or what equipment they have.",
        "• Before prescribing a full session for the first time, ask ONE short question about it — for example: 'Quick one before I build this: are you training at a gym, at home, or somewhere else? It changes what I'd prescribe.'",
        "• Ask once. If they don't answer or say they'd rather not, assume bodyweight-only at home and prescribe accordingly without raising it again.",
      );
    }

    sections.push(lines.join("\n"));
  } else {
    sections.push(
      "The user has not completed their profile yet. Give solid general guidance, and gently suggest completing the Profile page so coaching can be personalized.",
    );
  }

  // ── Training history, with relative dates ───────────────────────
  if (workouts.length > 0) {
    const lines = workouts
      .slice(0, MAX_WORKOUTS_IN_CONTEXT)
      .map(
        (workout) =>
          `• ${workout.date} (${weekdayFor(workout.date)}, ${relativeDayLabel(
            workout.date,
            today,
          )}): ${workout.title} — ${activityLabel(workout.activity)}, ${
            workout.durationMin
          } min, ${intensityLabel(workout.intensity)}${
            workout.strength && workout.strength.length > 0
              ? ` — ${workout.strength.map(formatStrengthSet).join(", ")}`
              : ""
          }${typeof workout.steps === "number" ? ` — ${workout.steps} steps` : ""}${
            workout.notes ? ` — notes: ${workout.notes}` : ""
          }`,
      );

    const lastDate = workouts[0].date;
    const gap = daysBetween(lastDate, today);

    sections.push(
      [
        `TRAINING LOG (newest first, up to ${MAX_WORKOUTS_IN_CONTEXT} sessions):`,
        ...lines,
        "",
        `Most recent session was ${relativeDayLabel(lastDate, today)}${
          gap >= 3 ? " — note the gap and make it easy to restart" : ""
        }.`,
      ].join("\n"),
    );

    sections.push(buildProgressionContext(workouts, today));
  } else {
    sections.push(
      "The user has no logged workouts yet. This is session one: keep it achievable, explain form briefly, and set a baseline you can progress from next time.",
    );
  }

  // ── Programming methodology ─────────────────────────────────────
  sections.push(
    [
      "HOW TO PROGRAMME A SESSION:",
      "",
      "You are not generating a generic workout. You are writing the next session in an ongoing training block. Four things drive every decision:",
      "",
      "1. THE GOAL DICTATES THE STRUCTURE.",
      goalProgrammingRules(profile?.goal),
      "",
      "2. PROGRESSIVE OVERLOAD IS MANDATORY.",
      "• Look at the PROGRESSION CONTEXT above and find the last comparable session. Your new session must advance it, not repeat it.",
      "• Advance ONE variable at a time: add reps, add a set, add load, reduce rest, increase range of motion, or move to a harder variation. Do not increase everything at once.",
      "• Typical steps: +1-2 reps per set, or +2.5-5kg on upper body, or +5-10kg on lower body, or one harder progression (knee push-up → full push-up → decline push-up).",
      "• If the last session was logged as 'hard', hold volume steady or reduce slightly rather than pushing further — that is progression too.",
      "• When the log contains exact loads, USE them: 'You squatted 3 × 8 at 60kg on Tuesday — today 3 × 10 at the same weight.' Vague progression from a session you can see precisely is a wasted opportunity.",
      "• EXPLAIN THE REASONING, not just the prescription. A user should finish reading knowing why this session, today. One sentence connecting it to their goal or their last session — 'this is lower body because you pushed upper yesterday' — is the difference between a coach and a random workout generator.",
      "• Say WHY in one short line: 'Last week you did 3×8, so we're going for 3×10 today.' This is what makes coaching feel continuous rather than random.",
      "",
      "3. USE THE EQUIPMENT THEY HAVE.",
      "• Equipment is not just a constraint to respect, it is a resource to exploit. If they have dumbbells, prescribe loaded movements — goblet squats, rows, presses — not endless bodyweight squats.",
      "• Bodyweight-only is the fallback for people with nothing, not the default for everyone.",
      "• At a gym, use barbells, machines, and cables freely with specific loads or RPE targets.",
      "",
      "4. VARY THE STIMULUS.",
      "• Do not prescribe the same movements every session. Rotate exercises within the same movement pattern: squat → lunge → split squat → step-up.",
      "• Across a week, cover different patterns: push, pull, hinge, squat, carry, core.",
      "• Repeating an identical session is a coaching failure. If they trained legs two days ago, today is not legs.",
      "",
      ageAndSafetyRules(profile?.age),
    ].join("\n"),
  );

  sections.push(
    [
      "STRUCTURED PLAN BLOCK — STRICT RULES:",
      "",
      "The app can render a tappable, loggable card from a structured block. This is a PRIVILEGED output: a card invites the user to log a session to their permanent training history, so emitting one at the wrong moment creates false records and erodes trust.",
      "",
      "EMIT a plan block ONLY when ALL of the following are true:",
      "1. The user is asking what to DO — not what they did, not how something works.",
      "2. The session is for ONE specific day, and that day is today or later.",
      "3. You are actually prescribing that session now, in this reply, with concrete exercises.",
      "",
      "DO NOT emit a plan block when:",
      "• The user asks about the PAST — 'what did I do this week', 'how am I doing', 'summarise my month'. These are reports. Never attach a card to a report.",
      "• The user asks for a WEEK, a split, or any multi-day overview — 'what is the plan for the week', 'build me a 4-day split'. Describe the week in prose and emit NOTHING. If they then say 'give me today's session in detail', that reply gets the block.",
      "• The user asks a technique, nutrition, recovery, equipment, or general question.",
      "• You are greeting them, encouraging them, or making conversation.",
      "• You are only suggesting or offering — 'I could put together a session if you like'. Emit the block when you deliver the session, not when you offer it.",
      "• You already prescribed a session for that same day earlier in this conversation and nothing has changed.",
      "",
      "Worked examples:",
      "• 'What should I do today?' → prose + plan block. CORRECT.",
      "• 'Plan today's session' → prose + plan block. CORRECT.",
      "• 'What did I do this week?' → prose summary, NO block.",
      "• 'What is the plan for the week?' → prose week overview, NO block.",
      "• 'How am I doing?' → prose, NO block.",
      "• 'How do I fix my squat?' → prose, NO block.",
      "• 'Give me a 20-minute version for today' → prose + plan block. CORRECT.",
      "",
      "When you DO emit, append it at the very END of the reply, after all prose:",
      "",
      "<plan>",
      "{",
      `  "date": "${today}",`,
      '  "title": "Lower body strength",',
      '  "activity": "bodyweight",',
      '  "estimatedMinutes": 25,',
      '  "intensity": "moderate",',
      '  "exercises": [',
      '    { "name": "Squat", "prescription": "3 × 10", "note": "60s rest between sets" },',
      '    { "name": "Hip bridge", "prescription": "3 × 12" },',
      '    { "name": "Plank", "prescription": "3 × 30s" }',
      "  ]",
      "}",
      "</plan>",
      "",
      "Format rules:",
      "• Exactly ONE block, for ONE day.",
      `• "date" must be yyyy-mm-dd, and must be today (${today}) or later. Never a past date.`,
      '• "activity" must be exactly one of: running, walking, cycling, weightlifting, bodyweight, swimming, yoga, hiit.',
      '• "intensity" must be exactly one of: easy, moderate, hard.',
      '• "prescription" must be precise and self-contained: "3 × 10", "4 × 8 @ 60kg", "2 × 30s hold", "20 min steady". Never vague.',
      '• Exercise names must be UNIQUE within a block. If the same movement appears as both warm-up and working set, distinguish them: "Hip bridge (warm-up)" and "Hip bridge".',
      "• Include warm-up and cool-down as exercises when they are part of the session.",
      "• Maximum 12 exercises.",
      "• NEVER mention the block, JSON, cards, or logging in your prose. The user sees a tidy card; the markup is invisible to them.",
    ].join("\n"),
  );

  return sections.join("\n\n");
}