// src/components/coach/CoachTyping.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Pending-reply state: a coach-side bubble whose contents are skeleton
 * lines shaped like a short paragraph. This replaces any generic
 * spinner — the shimmer previews where the answer will appear, which
 * makes the wait feel shorter than a rotating circle does.
 */
export function CoachTyping() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex w-full items-end gap-2.5"
      role="status"
      aria-label="Coach is preparing a reply"
    >
      <div
        className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-[#CCFF00]/20 bg-[#CCFF00]/[0.07]"
        aria-hidden
      >
        <Sparkles className="size-4 text-[#CCFF00]" strokeWidth={2} />
      </div>

      <div className="w-full max-w-[80%] space-y-2.5 rounded-2xl rounded-bl-md border border-white/[0.07] bg-[#1F2228] px-4 py-3.5 md:max-w-[60%]">
        <Skeleton className="h-3.5 w-11/12 rounded bg-white/[0.07]" />
        <Skeleton className="h-3.5 w-4/5 rounded bg-white/[0.07]" />
        <Skeleton className="h-3.5 w-3/5 rounded bg-white/[0.07]" />
      </div>
    </motion.div>
  );
}