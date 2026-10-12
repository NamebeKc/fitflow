// src/components/ui/switch.tsx
"use client";

import { cn } from "@/lib/utils";

/**
 * ── SWITCH ──────────────────────────────────────────────────────────
 * A button with `role="switch"`, not a styled checkbox.
 *
 * The role carries the semantics a checkbox doesn't: screen readers
 * announce "on"/"off" rather than "checked", which is what a setting
 * that takes effect immediately should say. There is no form here and
 * nothing to submit, so there is nothing for a hidden input to do.
 *
 * STATE IS NOT CARRIED BY COLOUR ALONE. WCAG 1.4.1 — the knob moves,
 * and the accessible name changes with it. Someone who cannot
 * distinguish the lime track from the sunken one still gets both the
 * position and the announcement.
 *
 * The knob stays dark in both states. A pale knob on #CCFF00 measures
 * about 1.3:1 and disappears; dark reads against the lime fill and
 * against the off-state track equally well, so the fill colour is the
 * redundant signal rather than the only one.
 */

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Points at the visible label. Required unless `aria-label` is given. */
  "aria-labelledby"?: string;
  "aria-label"?: string;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  ...aria
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border",
        "outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-moss bg-lime"
          : "border-field-border bg-paper-sunken",
        className,
      )}
      {...aria}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block size-4 rounded-full transition-transform",
          checked ? "translate-x-[22px] bg-on-lime" : "translate-x-[3px] bg-ink-muted",
        )}
      />
    </button>
  );
}
