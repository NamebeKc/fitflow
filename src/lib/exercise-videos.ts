// src/lib/exercise-videos.ts

/**
 * ── EXERCISE DEMONSTRATIONS ─────────────────────────────────────────
 * One ordered list. FIRST MATCH WINS, so entries are sorted
 * most-specific-first — "oblique V-up" must sit above "V-up", and
 * "jump squat" above "squat", or the general entry swallows the
 * specific one.
 *
 * An earlier version split this into curated and uncurated tiers and
 * checked curated first. That silently broke specificity: a pike
 * push-up resolved to the plain push-up video purely because push-up
 * happened to be curated. One list with one ordering rule removes the
 * whole class of bug.
 *
 * `youtubeId` is optional. Entries that have one play inline; the rest
 * open a YouTube search. That fallback matters — hardcoded IDs rot
 * when channels delete uploads, and a dead embed is worse than no
 * button. It also means every movement the coach can name gets a
 * demo, curated or not.
 * ─────────────────────────────────────────────────────────────────────
 */

export interface ExerciseVideo {
  /** Stable key, also used for dedupe. */
  id: string;
  /** Human-readable exercise name shown on the card. */
  exercise: string;
  /** Video title, or a search description for fallback entries. */
  title: string;
  /** YouTube video ID. Null when this entry falls back to search. */
  youtubeId: string | null;
}

interface Movement {
  id: string;
  exercise: string;
  pattern: RegExp;
  /** Present only for verified demos. */
  youtubeId?: string;
  /** Overrides the generated title when a video is curated. */
  title?: string;
}

/**
 * Every movement the app recognises, ordered most-specific-first.
 *
 * To curate a demo: find an instructional video (not a critique or a
 * vlog), take the `v=` parameter from its URL, and add `youtubeId` and
 * `title` to that entry. Nothing else changes.
 */
const MOVEMENTS: Movement[] = [
  /* ══ Core ═══════════════════════════════════════════════════════ */
  { id: "oblique-v-up", exercise: "Oblique V-up", pattern: /\boblique v[- ]?ups?\b/i },
  { id: "v-up", exercise: "V-up", pattern: /\bv[- ]?ups?\b/i },
  { id: "reverse-crunch", exercise: "Reverse crunch", pattern: /\breverse crunch(es)?\b/i },
  { id: "bicycle-crunch", exercise: "Bicycle crunch", pattern: /\bbicycles?\b|\bbicycle crunch(es)?\b/i },
  { id: "crunch", exercise: "Crunch", pattern: /\bcrunch(es)?\b/i },
  { id: "sit-up", exercise: "Sit-up", pattern: /\bsit[- ]?ups?\b/i },
  { id: "hollow-hold", exercise: "Hollow hold", pattern: /\bhollow (body )?(holds?|rocks?)\b/i },
  { id: "flutter-kick", exercise: "Flutter kick", pattern: /\bflutter kicks?\b|\bscissors?\b/i },
  { id: "leg-raise", exercise: "Leg raise", pattern: /\b(hanging |lying )?leg raises?\b|\bknee raises?\b/i },
  { id: "hip-raise", exercise: "Hip raise", pattern: /\bhip raises?\b/i },
  { id: "russian-twist", exercise: "Russian twist", pattern: /\brussian twists?\b/i },
  { id: "dead-bug", exercise: "Dead bug", pattern: /\bdead ?bugs?\b/i },
  { id: "bird-dog", exercise: "Bird dog", pattern: /\bbird ?dogs?\b/i },
  { id: "superman", exercise: "Superman", pattern: /\bsupermans?\b/i },
  { id: "pallof-press", exercise: "Pallof press", pattern: /\bpallof press(es)?\b/i },
  { id: "toe-touch", exercise: "Toe touch", pattern: /\btoe touch(es)?\b/i },
  { id: "mountain-climber", exercise: "Mountain climber", pattern: /\bmountain climbers?\b/i },
  {
    id: "plank",
    exercise: "Plank",
    pattern: /\b(side |forearm |high )?planks?\b/i,
    youtubeId: "A2b2EmIg0dA",
    title: "How to Plank — Form, Cues & Progressions",
  },

  /* ══ Lower body ═════════════════════════════════════════════════ */
  { id: "bulgarian-split-squat", exercise: "Bulgarian split squat", pattern: /\bbulgarian split squats?\b/i },
  { id: "jump-squat", exercise: "Jump squat", pattern: /\bjump squats?\b|\bsquat jumps?\b/i },
  { id: "wall-sit", exercise: "Wall sit", pattern: /\bwall sits?\b/i },
  { id: "leg-press", exercise: "Leg press", pattern: /\bleg press(es)?\b/i },
  { id: "leg-curl", exercise: "Leg curl", pattern: /\b(hamstring |lying |seated )?leg curls?\b|\bhamstring curls?\b/i },
  { id: "leg-extension", exercise: "Leg extension", pattern: /\bleg extensions?\b/i },
  { id: "nordic-curl", exercise: "Nordic curl", pattern: /\bnordic (hamstring )?curls?\b/i },
  { id: "deadlift", exercise: "Deadlift", pattern: /\b(romanian |stiff[- ]?leg |conventional |sumo |dumbbell )?deadlifts?\b|\brdls?\b/i },
  { id: "good-morning", exercise: "Good morning", pattern: /\bgood mornings?\b/i },
  { id: "hip-thrust", exercise: "Hip thrust", pattern: /\bhip thrusts?\b/i },
  { id: "step-up", exercise: "Step-up", pattern: /\b(box |bench )?step[- ]?ups?\b/i },
  { id: "box-jump", exercise: "Box jump", pattern: /\bbox jumps?\b/i },
  { id: "calf-raise", exercise: "Calf raise", pattern: /\bcalf raises?\b/i },
  { id: "clamshell", exercise: "Clamshell", pattern: /\bclam ?shells?\b/i },
  { id: "fire-hydrant", exercise: "Fire hydrant", pattern: /\bfire hydrants?\b/i },
  { id: "glute-kickback", exercise: "Glute kickback", pattern: /\b(glute )?kick[- ]?backs?\b|\bdonkey kicks?\b/i },
  {
    id: "hip-bridge",
    exercise: "Hip bridge",
    pattern: /\b(hip|glute) bridges?\b/i,
    youtubeId: "wPM8icPu6H8",
    title: "How to Do a Glute Bridge the Right Way",
  },
  {
    id: "lunge",
    exercise: "Lunge",
    pattern: /\b(walking |reverse |forward |split |static )?lunges?\b/i,
    youtubeId: "mBhqeQm8RdM",
    title: "Lunges for Beginners — How to Do a Lunge",
  },
  {
    id: "squat",
    exercise: "Squat",
    pattern: /\b(bodyweight |air |goblet |back |front )?squats?\b/i,
    youtubeId: "otzWCWpuW-A",
    title: "How to Do Squats — Correct Form, Step by Step",
  },

  /* ══ Upper body: push ═══════════════════════════════════════════ */
  { id: "pike-push-up", exercise: "Pike push-up", pattern: /\bpike push[- ]?ups?\b/i },
  { id: "bench-press", exercise: "Bench press", pattern: /\b(dumbbell |barbell |incline |flat |close[- ]?grip )?bench press(es)?\b/i },
  { id: "overhead-press", exercise: "Overhead press", pattern: /\b(overhead|shoulder|military|arnold) press(es)?\b/i },
  { id: "dip", exercise: "Dip", pattern: /\b(tricep |chest |bench )?dips?\b/i },
  { id: "chest-fly", exercise: "Chest fly", pattern: /\b(chest |pec |dumbbell )?fl(y|ies)\b|\bpec deck\b/i },
  { id: "rear-delt-fly", exercise: "Rear delt fly", pattern: /\brear (delt|deltoid) fl(y|ies)\b|\breverse fl(y|ies)\b/i },
  { id: "lateral-raise", exercise: "Lateral raise", pattern: /\b(lateral|side) raises?\b/i },
  { id: "front-raise", exercise: "Front raise", pattern: /\bfront raises?\b/i },
  { id: "tricep-extension", exercise: "Tricep extension", pattern: /\btricep(s)? (extension|pushdown|kickback)s?\b|\bskull ?crushers?\b/i },
  { id: "shoulder-tap", exercise: "Shoulder tap", pattern: /\bshoulder taps?\b/i },
  {
    id: "push-up",
    exercise: "Push-up",
    pattern: /\b(incline |decline |knee |wide |diamond )?push[- ]?ups?\b/i,
    youtubeId: "mECzqUIDWfU",
    title: "How to Do a Proper Push-up",
  },

  /* ══ Upper body: pull ═══════════════════════════════════════════ */
  { id: "pull-up", exercise: "Pull-up", pattern: /\b(assisted |wide[- ]?grip )?pull[- ]?ups?\b/i },
  { id: "chin-up", exercise: "Chin-up", pattern: /\bchin[- ]?ups?\b/i },
  { id: "lat-pulldown", exercise: "Lat pulldown", pattern: /\blat pull[- ]?downs?\b/i },
  { id: "face-pull", exercise: "Face pull", pattern: /\bface pulls?\b/i },
  { id: "shrug", exercise: "Shrug", pattern: /\bshrugs?\b/i },
  { id: "bicep-curl", exercise: "Bicep curl", pattern: /\b(bicep|hammer|preacher|dumbbell|barbell)? ?curls?\b/i },
  {
    id: "row",
    exercise: "Dumbbell row",
    pattern: /\b(dumbbell |bent[- ]?over |single[- ]?arm |barbell |seated |cable |upright )?rows?\b/i,
    youtubeId: "roCP6wCXPqo",
    title: "How to Perfect Your Dumbbell Row",
  },

  /* ══ Conditioning & carries ═════════════════════════════════════ */
  { id: "burpee", exercise: "Burpee", pattern: /\bburpees?\b/i },
  { id: "jumping-jack", exercise: "Jumping jack", pattern: /\bjumping jacks?\b/i },
  { id: "high-knees", exercise: "High knees", pattern: /\bhigh knees\b/i },
  { id: "jump-rope", exercise: "Jump rope", pattern: /\b(jump|skipping) ropes?\b/i },
  { id: "kettlebell-swing", exercise: "Kettlebell swing", pattern: /\b(kettlebell )?swings?\b/i },
  { id: "thruster", exercise: "Thruster", pattern: /\bthrusters?\b/i },
  { id: "bear-crawl", exercise: "Bear crawl", pattern: /\bbear crawls?\b/i },
  { id: "inchworm", exercise: "Inchworm", pattern: /\binch ?worms?\b/i },
  { id: "skater", exercise: "Skater", pattern: /\bskaters?\b/i },
  { id: "farmers-carry", exercise: "Farmer's carry", pattern: /\bfarmer'?s? (carry|carries|walk)\b|\bloaded carr(y|ies)\b/i },
  { id: "battle-ropes", exercise: "Battle ropes", pattern: /\bbattle ropes?\b/i },
  { id: "rowing-machine", exercise: "Rowing machine", pattern: /\browing machine\b|\bconcept ?2\b/i },

  /* ══ Mobility ═══════════════════════════════════════════════════ */
  { id: "cat-cow", exercise: "Cat-cow stretch", pattern: /\bcat[- ](cow|camel)\b/i },
  { id: "cobra", exercise: "Cobra stretch", pattern: /\bcobra( pose| stretch)?\b/i },
  { id: "childs-pose", exercise: "Child's pose", pattern: /\bchild'?s pose\b/i },
  { id: "downward-dog", exercise: "Downward dog", pattern: /\bdownward[- ]?(facing )?dog\b/i },
  { id: "pigeon-pose", exercise: "Pigeon pose", pattern: /\bpigeon (pose|stretch)\b/i },
  { id: "hip-flexor-stretch", exercise: "Hip flexor stretch", pattern: /\bhip flexor stretch(es)?\b/i },
  { id: "hamstring-stretch", exercise: "Hamstring stretch", pattern: /\bhamstring stretch(es)?\b/i },
  { id: "world-greatest-stretch", exercise: "World's greatest stretch", pattern: /\bworld'?s greatest stretch\b/i },
  { id: "thoracic-rotation", exercise: "Thoracic rotation", pattern: /\bthoracic (rotations?|twists?)\b|\bopen ?books?\b/i },
];

/** Max demos attached to a coach reply — keeps plans from becoming a wall of video. */
const MAX_VIDEOS_PER_MESSAGE = 3;

function toVideo(movement: Movement): ExerciseVideo {
  return {
    id: movement.id,
    exercise: movement.exercise,
    title:
      movement.title ?? `Search YouTube for ${movement.exercise} technique`,
    youtubeId: movement.youtubeId ?? null,
  };
}

/**
 * Scans text for known movements, in the order they appear.
 *
 * Ordering by first mention means a lunge-focused reply leads with the
 * lunge, rather than whatever happens to sit first in the library.
 */
export function findExerciseVideos(text: string): ExerciseVideo[] {
  const hits: Array<{ video: ExerciseVideo; index: number }> = [];

  for (const movement of MOVEMENTS) {
    const index = text.search(movement.pattern);
    if (index !== -1) hits.push({ video: toVideo(movement), index });
  }

  const seen = new Set<string>();
  return hits
    .sort((a, b) => a.index - b.index)
    .filter((hit) => {
      if (seen.has(hit.video.id)) return false;
      seen.add(hit.video.id);
      return true;
    })
    .map((hit) => hit.video)
    .slice(0, MAX_VIDEOS_PER_MESSAGE);
}

/**
 * The single best demo for one exercise name.
 *
 * Used by plan cards, where the name is already known and the
 * per-message cap shouldn't apply.
 */
export function findExerciseVideo(name: string): ExerciseVideo | null {
  for (const movement of MOVEMENTS) {
    if (movement.pattern.test(name)) return toVideo(movement);
  }
  return null;
}

/** YouTube search URL for a movement without a curated demo. */
export function searchUrlFor(video: ExerciseVideo): string {
  const query = encodeURIComponent(`how to do ${video.exercise} proper form`);
  return `https://www.youtube.com/results?search_query=${query}`;
}