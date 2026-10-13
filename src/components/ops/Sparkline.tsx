// src/components/ops/Sparkline.tsx
"use client";

import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * ── SPARKLINE ───────────────────────────────────────────────────────
 * One series, one hue, no axes. The number above it carries the value;
 * this carries the shape.
 *
 * ONE SERIES MEANS NO LEGEND. There is only one colour, and the tile's
 * label already says what is plotted — a legend box with a single
 * swatch restates the label and costs the space the chart needs.
 *
 * THE PATH IS DE-EMPHASISED, THE END IS NOT. History is drawn in a
 * washed-out moss and the current point in full moss with a ring in
 * the surface colour, so the eye lands on "where it is now" and reads
 * the trend as context. The ring is what keeps the dot legible where
 * it sits on top of the line.
 *
 * THE PATH STILL HAS TO CLEAR 3:1. De-emphasis is not permission to
 * fade a mark out of legibility — the line is a graphical object the
 * reader needs, so it is measured against the surface like any other.
 *
 * NO GRIDLINES, NO AXIS. At this size they would be most of the ink
 * and none of the information. The value, the delta and the hover
 * readout carry everything an axis would.
 *
 * A FLAT SERIES IS DRAWN FLAT. When every value is equal the range is
 * zero; the line is centred rather than divided by zero, because a
 * dashboard that renders NaN as a blank tile hides an outage.
 */

export interface SparkPoint {
  label: string;
  value: number;
}

interface SparklineProps {
  points: SparkPoint[];
  /** Formats the hover readout. Defaults to a plain integer. */
  format?: (value: number) => string;
  className?: string;
  /** Accessible summary; the chart is decorative without it. */
  title: string;
}

const WIDTH = 240;
const HEIGHT = 44;
const PAD = 5; // keeps the 8px end dot and its ring inside the viewBox

export function Sparkline({
  points,
  format = (v) => v.toLocaleString(),
  className,
  title,
}: SparklineProps) {
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();

  const geometry = useMemo(() => {
    if (points.length === 0) return null;

    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    const x = (i: number) =>
      points.length === 1
        ? WIDTH / 2
        : PAD + (i * (WIDTH - PAD * 2)) / (points.length - 1);

    const y = (v: number) =>
      range === 0
        ? HEIGHT / 2
        : HEIGHT - PAD - ((v - min) / range) * (HEIGHT - PAD * 2);

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`)
      .join(" ");

    return { x, y, path, last: points.length - 1 };
  }, [points]);

  if (!geometry) {
    return (
      <p className={cn("text-[12px] text-ink-faint", className)}>No data yet</p>
    );
  }

  const active = hover ?? geometry.last;
  const activePoint = points[active];

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-11 w-full"
        role="img"
        aria-label={title}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - box.left) / box.width;
          const index = Math.round(ratio * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, index)));
        }}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={WIDTH} height={HEIGHT} />
          </clipPath>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <path
            d={geometry.path}
            fill="none"
            stroke="var(--moss)"
            /* 0.7, not the 0.35 this started at. De-emphasis is the
               intent, but the trend line is a graphical object the
               reader needs, so WCAG 1.4.11 wants 3:1 against the
               surface. Measured: 0.35 is 1.77:1 and effectively
               invisible on a bright screen; 0.7 is 3.58:1 and still
               clearly recessive beside the 7.39:1 end dot. */
            strokeOpacity="0.7"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Surface ring first, mark on top — the ring is what keeps
              the dot readable where it lands on the line. */}
          <circle
            cx={geometry.x(active)}
            cy={geometry.y(activePoint.value)}
            r="6"
            fill="var(--paper-raised)"
          />
          <circle
            cx={geometry.x(active)}
            cy={geometry.y(activePoint.value)}
            r="4"
            fill="var(--moss)"
          />
        </g>
      </svg>

      <p className="mt-1 font-mono text-[10px] tabular-nums text-ink-faint">
        {activePoint.label} · {format(activePoint.value)}
      </p>
    </div>
  );
}
