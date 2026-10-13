// src/components/ops/StatTile.tsx
"use client";

import { cn } from "@/lib/utils";
import { Sparkline, type SparkPoint } from "@/components/ops/Sparkline";

/**
 * ── STAT TILE ───────────────────────────────────────────────────────
 * Label, value, optional delta, optional trend. The unit of this
 * dashboard.
 *
 * THE DELTA NEEDS A DIRECTION AND A JUDGEMENT, and they are not the
 * same thing. Churn going up is red; MRR going up is green; AI cost
 * going up is amber. `goodWhen` carries that, because colouring every
 * rise green is how a dashboard congratulates you on your costs.
 *
 * TEXT NEVER WEARS THE SERIES COLOUR. The value and label are ink
 * tokens; the only thing carrying the hue is the sparkline beside
 * them. A moss-coloured number would be both off-key and, at some
 * sizes, below contrast.
 *
 * PROPORTIONAL FIGURES ON THE VALUE, tabular only in the hover readout
 * and the tables. `tabular-nums` gives every digit the width of a
 * zero, which at 28px makes a number like 121 look gappy.
 */

interface StatTileProps {
  label: string;
  value: string;
  /** Change against the comparison period, already computed. */
  delta?: number | null;
  deltaLabel?: string;
  /** Which direction is good. "none" shows the delta in plain ink. */
  goodWhen?: "up" | "down" | "none";
  points?: SparkPoint[];
  format?: (value: number) => string;
  /** A short clarification under the value, where one is needed. */
  note?: string;
  className?: string;
}

function deltaTone(
  delta: number,
  goodWhen: "up" | "down" | "none",
): string {
  if (goodWhen === "none" || delta === 0) return "text-ink-muted";
  const good = goodWhen === "up" ? delta > 0 : delta < 0;
  return good ? "text-success" : "text-danger";
}

export function StatTile({
  label,
  value,
  delta,
  deltaLabel = "vs previous period",
  goodWhen = "up",
  points,
  format,
  note,
  className,
}: StatTileProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-rule bg-paper-raised p-5",
        className,
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted">
        {label}
      </p>

      <p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink">
        {value}
      </p>

      {note && <p className="mt-1.5 text-[12px] text-ink-faint">{note}</p>}

      {typeof delta === "number" && Number.isFinite(delta) && (
        <p className={cn("mt-2 text-[12px]", deltaTone(delta, goodWhen))}>
          {delta > 0 ? "+" : ""}
          {Math.abs(delta) < 10
            ? delta.toFixed(1).replace(/\.0$/, "")
            : Math.round(delta)}
          % <span className="text-ink-faint">{deltaLabel}</span>
        </p>
      )}

      {points && points.length > 1 && (
        <Sparkline
          className="mt-4"
          points={points}
          format={format}
          title={`${label} over the last ${points.length} days`}
        />
      )}
    </section>
  );
}
