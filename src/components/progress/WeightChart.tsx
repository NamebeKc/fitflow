// src/components/progress/WeightChart.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

import type { Measurement } from "@/lib/measurements";

interface WeightChartProps {
  measurements: Measurement[];
}

/**
 * Weight over time.
 *
 * Two decisions about honesty in charting:
 *
 * 1. The y-axis is padded around the actual range rather than starting
 *    at zero. For weight this is correct — nobody weighs zero, and a
 *    zero-based axis would flatten a real 4kg change into a
 *    meaningless straight line.
 *
 * 2. But the padding is FIXED (2kg minimum), not proportional. A
 *    tightly-zoomed axis makes a 0.3kg fluctuation look like a
 *    dramatic swing, which is exactly how weight charts drive anxiety.
 *    The floor keeps normal daily noise looking like normal noise.
 *
 * No goal line, no target weight, no colour-coded "good" direction.
 * The chart reports; it does not judge.
 */
export function WeightChart({ measurements }: WeightChartProps) {
  const prefersReducedMotion = useReducedMotion();

  if (measurements.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/30 px-6 text-center">
        <p className="max-w-xs text-sm leading-relaxed text-white/50">
          Record a weight to start tracking. Entirely optional.
        </p>
      </div>
    );
  }

  // A single entry can't make a trend line, but it CAN be shown. The
  // previous version hid the number entirely until a second reading
  // existed, so someone who had just saved their weight was told to
  // come back later — it looked like the save had failed.
  if (measurements.length === 1) {
    const only = measurements[0];
    return (
      <div className="space-y-4">
        <div>
          <p className="font-mono text-2xl tabular-nums text-white">
            {only.weightKg}
            <span className="ml-1 text-sm text-white/50">kg</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
            Recorded {formatDate(only.date)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-black/30 px-4 py-5 text-center">
          <p className="text-sm leading-relaxed text-white/50">
            Your trend line appears once you record a second reading.
          </p>
        </div>
      </div>
    );
  }

  const values = measurements.map((entry) => entry.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);

  // Minimum 2kg visible range — see note above.
  const span = Math.max(max - min, 2);
  const mid = (max + min) / 2;
  const low = mid - span / 2 - span * 0.15;
  const high = mid + span / 2 + span * 0.15;

  const width = 100;
  const height = 46;

  const points = measurements.map((entry, index) => {
    const x = (index / (measurements.length - 1)) * width;
    const y = height - ((entry.weightKg - low) / (high - low)) * height;
    return { x, y, entry };
  });

  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  const first = measurements[0];
  const latest = measurements[measurements.length - 1];
  const change = latest.weightKg - first.weightKg;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-2xl tabular-nums text-white">
            {latest.weightKg}
            <span className="ml-1 text-sm text-white/50">kg</span>
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
            Latest · {formatDate(latest.date)}
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm tabular-nums text-white/70">
            {change > 0 ? "+" : ""}
            {change.toFixed(1)} kg
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-white/50">
            Since {formatDate(first.date)}
          </p>
        </div>
      </div>

      <div className="relative h-32 w-full rounded-2xl border border-white/[0.07] bg-black/30 p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`Weight trend from ${first.weightKg} kg to ${latest.weightKg} kg`}
        >
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#CCFF00" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#CCFF00" stopOpacity="0" />
            </linearGradient>
          </defs>

          <polygon points={area} fill="url(#weightFill)" />

          <motion.polyline
            points={line}
            fill="none"
            stroke="#CCFF00"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={prefersReducedMotion ? undefined : { pathLength: 0 }}
            animate={prefersReducedMotion ? undefined : { pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />

          {points.map((point) => (
            <circle
              key={point.entry.date}
              cx={point.x}
              cy={point.y}
              r="2"
              fill="#090A0C"
              stroke="#CCFF00"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-white/50">
        Weight moves 2–3 kg on water, salt, and sleep alone. Look at the
        direction over weeks, not the number today.
      </p>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}