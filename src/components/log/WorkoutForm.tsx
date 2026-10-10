// src/components/log/WorkoutForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
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
import { takePendingDuration } from "@/lib/session-timer";

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
  const [fromTimer, setFromTimer] = useState(false);
  const [intensity, setIntensity] = useState<IntensityId>("moderate");
  const [notes, setNotes] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [steps, setSteps] = useState("");
  const [strength, setStrength] = useState<StrengthSet[]>([]);

  /**
   * Prefill the duration when the session stopwatch measured one.
   *
   * `takePendingDuration` clears as it reads, so this fires once per
   * timed session and never resurfaces a stale number against a workout
   * logged days later. The field stays editable — the clock keeps
   * running through a phone call, and only the user knows that.
   */
  useEffect(() => {
    const measured = takePendingDuration();
    if (measured === null) return;
    setDuration(String(measured));
    setFromTimer(true);
  }, []);

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
    <section className="rounded-lg border border-rule bg-paper-raised p-6 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
        Log a workout
      </p>

      {/* ── Activity ─────────────────────────────────────────────── */}
      <div className="mt-6 space-y-2.5">
        <p className="text-sm font-medium text-ink-muted">Activity</p>
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
                  "flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium outline-none transition-all active:translate-y-px",
                  "focus-visible:ring-2 focus-visible:ring-indigo/50",
                  selected
                    ? "border-indigo/40 bg-indigo/[0.08] text-ink"
                    : "border-rule bg-paper-sunken text-ink-muted hover:border-rule hover:text-ink",
                )}
              >
                <Icon
                  className={cn(
                    "size-4",
                    selected ? "text-indigo" : "text-ink-muted",
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
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="workout-duration"
            className="flex items-baseline gap-2 text-sm font-medium text-ink-muted"
          >
            Duration (min)
            {/* A number that appears on its own reads as a glitch. Say
                where it came from, and stop saying it the moment the
                user edits it — at that point it is their number. */}
            {fromTimer && (
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-indigo/70">
                from timer
              </span>
            )}
          </label>
          <Input
            id="workout-duration"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            value={duration}
            onChange={(event) => {
              setDuration(event.target.value);
              setFromTimer(false);
            }}
            placeholder="e.g. 45"
            className="h-11 rounded-md border-rule bg-paper px-4 font-mono text-ink tabular-nums placeholder:font-sans placeholder:text-ink-muted focus-visible:border-indigo/60 focus-visible:bg-paper focus-visible:ring-0"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="workout-date"
            className="text-sm font-medium text-ink-muted"
          >
            Date
          </label>
          <Input
            id="workout-date"
            type="date"
            value={date}
            max={todayISO()}
            onChange={(event) => setDate(event.target.value)}
            className="h-11 rounded-md border-rule bg-paper px-4 text-ink [color-scheme:dark] focus-visible:border-indigo/60 focus-visible:bg-paper focus-visible:ring-0"
          />
        </div>
      </div>

      {/* ── Intensity ────────────────────────────────────────────── */}
      <div className="mt-6 space-y-2.5">
        <p className="text-sm font-medium text-ink-muted">Intensity</p>
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
                  "rounded-md border px-3 py-2.5 text-sm font-medium outline-none transition-all active:translate-y-px",
                  "focus-visible:ring-2 focus-visible:ring-indigo/50",
                  selected
                    ? "border-indigo/40 bg-indigo/[0.08] text-ink"
                    : "border-rule bg-paper-sunken text-ink-muted hover:border-rule hover:text-ink",
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
        <div className="mt-6 space-y-2">
          <label
            htmlFor="workout-steps"
            className="text-sm font-medium text-ink-muted"
          >
            Steps{" "}
            <span className="font-normal text-ink-muted">(optional)</span>
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
            className="h-11 rounded-md border-rule bg-paper px-4 font-mono text-ink tabular-nums placeholder:font-sans placeholder:text-ink-muted focus-visible:border-indigo/60 focus-visible:bg-paper focus-visible:ring-0"
          />
          <p className="text-xs leading-relaxed text-ink-muted">
            Copy this from your phone&apos;s health app. AdimFit can&apos;t
            read your pedometer from the browser, so a number you enter is
            the only honest one.
          </p>
        </div>
      )}

      {/* ── Strength detail ──────────────────────────────────────── */}
      {showStrength && (
        <div className="mt-6 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-ink-muted">
              Exercises{" "}
              <span className="font-normal text-ink-muted">(optional)</span>
            </p>
            <button
              type="button"
              onClick={addSet}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-indigo outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-indigo/50"
            >
              <Plus className="size-3" strokeWidth={3} />
              Add
            </button>
          </div>

          {strength.length === 0 ? (
            <p className="rounded-md border border-rule bg-paper-sunken px-4 py-3 text-xs leading-relaxed text-ink-muted">
              Recording what you lifted is what lets your coach progress
              you — &ldquo;3 × 8 at 60kg last week, let&apos;s try 3 × 10&rdquo;.
              Skip it and the session still logs.
            </p>
          ) : (
            <ul className="space-y-2">
              {strength.map((entry, index) => (
                <li
                  key={index}
                  className="rounded-md border border-rule bg-paper-sunken p-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={entry.exercise}
                      onChange={(event) =>
                        updateSet(index, { exercise: event.target.value })
                      }
                      placeholder="Exercise, e.g. Squat"
                      className="h-9 flex-1 rounded-sm border-rule bg-paper px-3 text-sm text-ink placeholder:text-ink-muted focus-visible:border-indigo/60 focus-visible:ring-0"
                    />
                    <button
                      type="button"
                      onClick={() => removeSet(index)}
                      aria-label="Remove exercise"
                      className="flex size-9 shrink-0 items-center justify-center rounded-sm text-ink-muted outline-none transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-indigo/50"
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
        <div className="mt-6 space-y-4 border-t border-rule pt-6">
          <div className="space-y-2">
            <label
              htmlFor="workout-title"
              className="text-sm font-medium text-ink-muted"
            >
              Title{" "}
              <span className="font-normal text-ink-muted">
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
              className="h-11 rounded-md border-rule bg-paper px-4 text-ink placeholder:text-ink-muted focus-visible:border-indigo/60 focus-visible:bg-paper focus-visible:ring-0"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="workout-notes"
              className="text-sm font-medium text-ink-muted"
            >
              Notes{" "}
              <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <Textarea
              id="workout-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="e.g. Squats 3×8 @ 60kg, felt strong"
              rows={3}
              className="resize-none rounded-md border-rule bg-paper px-4 py-3 text-ink placeholder:text-ink-muted focus-visible:border-indigo/60 focus-visible:bg-paper focus-visible:ring-0"
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowDetail(true)}
          className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-indigo/50"
        >
          + Add title or notes
        </button>
      )}

      {/* ── Submit ───────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={submit}
        disabled={!valid}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-indigo px-6 py-3 text-sm font-semibold text-on-indigo outline-none transition-all hover:bg-indigo-lift focus-visible:ring-2 focus-visible:ring-indigo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:translate-y-px disabled:opacity-30 disabled:shadow-none"
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
      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-muted">
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
        className="mt-1 h-9 rounded-sm border-rule bg-paper px-2.5 text-center font-mono text-sm tabular-nums text-ink placeholder:text-ink-muted focus-visible:border-indigo/60 focus-visible:ring-0"
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