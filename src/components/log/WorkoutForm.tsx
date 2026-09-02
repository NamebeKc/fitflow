// src/components/log/WorkoutForm.tsx
"use client";

import { useRef, useState } from "react";
import {
  Bike,
  Dumbbell,
  Flower2,
  Footprints,
  PersonStanding,
  Plus,
  Trash2,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTIVITIES,
  INTENSITIES,
  todayISO,
  usesStepCount,
  usesStrengthDetail,
  type ActivityId,
  type IntensityId,
  type StrengthSet,
  type WorkoutEntry,
} from "@/lib/workouts";
import { activityLabel } from "@/lib/profile";

const ACTIVITY_ICONS: Record<ActivityId, LucideIcon> = {
  running: Footprints,
  walking: Footprints,
  cycling: Bike,
  weightlifting: Dumbbell,
  bodyweight: PersonStanding,
  swimming: Waves,
  yoga: Flower2,
  hiit: Zap,
};

interface WorkoutFormProps {
  onAdd: (entry: WorkoutEntry) => void;
}

/**
 * Manual workout entry.
 *
 * Only TWO things are required: an activity and a duration. Title was
 * mandatory before, which meant naming every walk you ever took — a
 * small tax paid on every single entry, and the most common reason
 * people stop logging. It now defaults from the activity and date.
 *
 * Date and intensity persist between entries, since people often log
 * several sessions from the same day in a row.
 */
export function WorkoutForm({ onAdd }: WorkoutFormProps) {
  const [activity, setActivity] = useState<ActivityId | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState<IntensityId>("moderate");
  const [notes, setNotes] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [steps, setSteps] = useState("");
  const [strength, setStrength] = useState<StrengthSet[]>([]);

  // Fired when the first field is touched, so the funnel can separate
  // "never tried to log" from "started and gave up".
  const startedRef = useRef(false);
  function markStarted(source: string) {
    if (startedRef.current) return;
    startedRef.current = true;
    track("workout_log_started", { source });
  }

  const showStrength = usesStrengthDetail(activity);
  const showSteps = usesStepCount(activity);

  function addSet() {
    setStrength((prev) => [
      ...prev,
      { exercise: "", sets: 3, reps: 10 },
    ]);
  }

  function updateSet(index: number, patch: Partial<StrengthSet>) {
    setStrength((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  }

  function removeSet(index: number) {
    setStrength((prev) => prev.filter((_, i) => i !== index));
  }

  const parsedDuration = Number(duration);
  const valid =
    activity !== null &&
    date.length > 0 &&
    Number.isFinite(parsedDuration) &&
    parsedDuration >= 1 &&
    parsedDuration <= 600;

  function submit() {
    if (!valid) return;

    track("workout_log_completed", {
      activity,
      intensity,
      duration_min: parsedDuration,
      source: "manual",
      had_notes: notes.trim().length > 0,
      strength_sets_logged: strength.filter((e) => e.exercise.trim()).length,
      steps_logged: showSteps && Number(steps) > 0,
      // The notes TEXT is never sent — only whether any exist.
    });

    onAdd({
      id: crypto.randomUUID(),
      activity: activity as ActivityId,
      title: title.trim() || defaultTitle(activity as ActivityId, date),
      date,
      durationMin: parsedDuration,
      intensity,
      notes: notes.trim(),
      // Only movements that were actually named are worth storing —
      // an empty row is noise in the coach's context.
      ...(showStrength && strength.some((entry) => entry.exercise.trim())
        ? {
            strength: strength
              .filter((entry) => entry.exercise.trim())
              .map((entry) => ({
                exercise: entry.exercise.trim(),
                sets: entry.sets,
                reps: entry.reps,
                ...(entry.weightKg ? { weightKg: entry.weightKg } : {}),
              })),
          }
        : {}),
      ...(showSteps && Number(steps) > 0 ? { steps: Number(steps) } : {}),
      createdAt: new Date().toISOString(),
    });

    setActivity(null);
    setTitle("");
    setDuration("");
    setNotes("");
    setSteps("");
    setStrength([]);
    setShowDetail(false);
    startedRef.current = false;
  }

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-[#14161A] p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
        Log a workout
      </p>

      {/* ── Activity ─────────────────────────────────────────────── */}
      <div className="mt-5 space-y-2.5">
        <p className="text-sm font-medium text-white/70">Activity</p>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map(({ id, label }) => {
            const Icon = ACTIVITY_ICONS[id];
            const selected = activity === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  markStarted("manual");
                  setActivity(id);
                }}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium outline-none transition-all active:scale-[0.98]",
                  "focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50",
                  selected
                    ? "border-[#CCFF00]/40 bg-[#CCFF00]/[0.08] text-white"
                    : "border-white/[0.07] bg-black/30 text-white/60 hover:border-white/15 hover:text-white",
                )}
              >
                <Icon
                  className={cn(
                    "size-4",
                    selected ? "text-[#CCFF00]" : "text-white/50",
                  )}
                  strokeWidth={2}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Duration + date ──────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="workout-duration"
            className="text-sm font-medium text-white/70"
          >
            Duration (min)
          </label>
          <Input
            id="workout-duration"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            placeholder="e.g. 45"
            className="h-11 rounded-xl border-white/[0.07] bg-black/50 px-4 font-mono text-white tabular-nums placeholder:font-sans placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="workout-date"
            className="text-sm font-medium text-white/70"
          >
            Date
          </label>
          <Input
            id="workout-date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(event) => setDate(event.target.value)}
            className="h-11 rounded-xl border-white/[0.07] bg-black/50 px-4 text-white [color-scheme:dark] focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
          />
        </div>
      </div>

      {/* ── Intensity ────────────────────────────────────────────── */}
      <div className="mt-5 space-y-2.5">
        <p className="text-sm font-medium text-white/70">Intensity</p>
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map(({ id, label }) => {
            const selected = intensity === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setIntensity(id)}
                aria-pressed={selected}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-medium outline-none transition-all active:scale-[0.98]",
                  "focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50",
                  selected
                    ? "border-[#CCFF00]/40 bg-[#CCFF00]/[0.08] text-white"
                    : "border-white/[0.07] bg-black/30 text-white/60 hover:border-white/15 hover:text-white",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Steps (walking and running only) ─────────────────────── */}
      {showSteps && (
        <div className="mt-5 space-y-2">
          <label
            htmlFor="workout-steps"
            className="text-sm font-medium text-white/70"
          >
            Steps{" "}
            <span className="font-normal text-white/50">(optional)</span>
          </label>
          <Input
            id="workout-steps"
            type="number"
            inputMode="numeric"
            min={0}
            max={100000}
            value={steps}
            onChange={(event) => setSteps(event.target.value)}
            placeholder="e.g. 6500"
            className="h-11 rounded-xl border-white/[0.07] bg-black/50 px-4 font-mono text-white tabular-nums placeholder:font-sans placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
          />
          <p className="text-xs leading-relaxed text-white/50">
            Copy this from your phone&apos;s health app. AdimFit can&apos;t
            read your pedometer from the browser, so a number you enter is
            the only honest one.
          </p>
        </div>
      )}

      {/* ── Strength detail ──────────────────────────────────────── */}
      {showStrength && (
        <div className="mt-5 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-white/70">
              Exercises{" "}
              <span className="font-normal text-white/50">(optional)</span>
            </p>
            <button
              type="button"
              onClick={addSet}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#CCFF00] outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              <Plus className="size-3" strokeWidth={3} />
              Add
            </button>
          </div>

          {strength.length === 0 ? (
            <p className="rounded-xl border border-white/[0.07] bg-black/30 px-4 py-3 text-xs leading-relaxed text-white/50">
              Recording what you lifted is what lets your coach progress
              you — &ldquo;3 × 8 at 60kg last week, let&apos;s try 3 × 10&rdquo;.
              Skip it and the session still logs.
            </p>
          ) : (
            <ul className="space-y-2">
              {strength.map((entry, index) => (
                <li
                  key={index}
                  className="rounded-xl border border-white/[0.07] bg-black/30 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={entry.exercise}
                      onChange={(event) =>
                        updateSet(index, { exercise: event.target.value })
                      }
                      placeholder="Exercise, e.g. Squat"
                      className="h-9 flex-1 rounded-lg border-white/[0.07] bg-black/50 px-3 text-sm text-white placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => removeSet(index)}
                      aria-label="Remove exercise"
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/50 outline-none transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
                    >
                      <Trash2 className="size-3.5" strokeWidth={2} />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <NumberField
                      label="Sets"
                      value={entry.sets}
                      onChange={(value) => updateSet(index, { sets: value })}
                      min={1}
                      max={20}
                    />
                    <NumberField
                      label="Reps"
                      value={entry.reps}
                      onChange={(value) => updateSet(index, { reps: value })}
                      min={1}
                      max={100}
                    />
                    <NumberField
                      label="kg"
                      value={entry.weightKg ?? ""}
                      onChange={(value) =>
                        updateSet(index, {
                          weightKg: value > 0 ? value : undefined,
                        })
                      }
                      min={0}
                      max={500}
                      placeholder="—"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Optional detail ──────────────────────────────────────── */}
      {showDetail ? (
        <div className="mt-5 space-y-4 border-t border-white/[0.06] pt-5">
          <div className="space-y-2">
            <label
              htmlFor="workout-title"
              className="text-sm font-medium text-white/70"
            >
              Title{" "}
              <span className="font-normal text-white/50">
                (auto if left blank)
              </span>
            </label>
            <Input
              id="workout-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                activity
                  ? defaultTitle(activity, date)
                  : "e.g. Upper body strength"
              }
              className="h-11 rounded-xl border-white/[0.07] bg-black/50 px-4 text-white placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="workout-notes"
              className="text-sm font-medium text-white/70"
            >
              Notes{" "}
              <span className="font-normal text-white/50">(optional)</span>
            </label>
            <Textarea
              id="workout-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Squats 3×8 @ 60kg, felt strong"
              rows={3}
              className="resize-none rounded-xl border-white/[0.07] bg-black/50 px-4 py-3 text-white placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:bg-black/70 focus-visible:ring-0"
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowDetail(true)}
          className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
        >
          + Add title or notes
        </button>
      )}

      {/* ── Submit ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-5 py-3 text-sm font-semibold text-black shadow-[0_10px_30px_-10px_rgba(204,255,0,0.5)] outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14161A] active:scale-[0.99] disabled:opacity-30 disabled:shadow-none"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        Log workout
      </button>
    </section>
  );
}

/** Compact labelled number input for the sets/reps/load row. */
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  label: string;
  value: number | "";
  onChange: (value: number) => void;
  min: number;
  max: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/50">
        {label}
      </span>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        placeholder={placeholder}
        className="mt-1 h-9 rounded-lg border-white/[0.07] bg-black/50 px-2.5 text-center font-mono text-sm tabular-nums text-white placeholder:text-white/50 focus-visible:border-[#CCFF00]/60 focus-visible:ring-0"
      />
    </label>
  );
}

/** "Walking · Fri" — enough to identify an entry without typing one. */
function defaultTitle(activity: ActivityId, date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  const day = Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString(undefined, { weekday: "short" });
  return day ? `${activityLabel(activity)} · ${day}` : activityLabel(activity);
}