// src/components/progress/WeighInDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics";

interface WeighInDialogProps {
  open: boolean;
  currentWeight?: number;
  onOpenChange: (open: boolean) => void;
  onSave: (weightKg: number) => Promise<void>;
}

/**
 * Records a weigh-in.
 *
 * Deliberately plain. No goal field, no target, no projection, no
 * "you're X kg from your goal" — a weight entry screen that sets
 * targets is a weight entry screen that invites people to chase them.
 *
 * The input is pre-filled with the last known value so the common case
 * is a small adjustment rather than typing from scratch, and the copy
 * makes clear this is optional.
 */
export function WeighInDialog({
  open,
  currentWeight,
  onOpenChange,
  onSave,
}: WeighInDialogProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(currentWeight ? String(currentWeight) : "");
      setError(null);
    }
  }, [open, currentWeight]);

  const parsed = Number(value);
  const valid = Number.isFinite(parsed) && parsed >= 30 && parsed <= 300;

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onSave(parsed);
      track("measurement_logged");
      onOpenChange(false);
    } catch (saveError) {
      console.error("[progress] Failed to save measurement:", saveError);
      setError("Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-white/[0.09] bg-[#14161A] text-white">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-base font-semibold tracking-[-0.02em] text-white">
            Record your weight
          </DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-white/50">
            Optional, and only visible to you. Fitflow uses it to calibrate
            training loads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <label className="block">
            <span className="text-[13px] font-medium text-white/60">
              Weight (kg)
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={30}
              max={300}
              step="0.1"
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void save();
              }}
              className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-black/50 px-4 py-3 font-mono text-lg tabular-nums text-white outline-none transition-colors placeholder:font-sans placeholder:text-white/50 focus:border-[#CCFF00]/60 focus:bg-black/70"
              placeholder="78.5"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-200"
            >
              {error}
            </p>
          )}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white/60 outline-none transition-colors hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-[#CCFF00]/50"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!valid || busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#CCFF00] px-5 py-3 text-sm font-semibold text-black outline-none transition-all hover:bg-[#d9ff33] focus-visible:ring-2 focus-visible:ring-[#CCFF00]/60 active:scale-[0.99] disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
              ) : (
                "Save"
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}