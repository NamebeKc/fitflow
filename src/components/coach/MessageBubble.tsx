// src/components/coach/MessageBubble.tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { ExerciseVideoLink } from "@/components/coach/ExerciseVideoLink";
import type { ExerciseVideo } from "@/lib/exercise-videos";

interface MessageBubbleProps {
  role: "user" | "coach";
  content: string;
  videos?: ExerciseVideo[];
  /** True while this reply is still being written. */
  isStreaming?: boolean;
}

/**
 * Renders **bold** spans so actionable parts of a reply stand out.
 *
 * The coach writes plain text — full markdown would mean a parser and
 * a security review for one formatting feature. But a wall of
 * undifferentiated prose buries the thing you're supposed to DO, so
 * emphasis alone earns its place. Anything else passes through as
 * literal text.
 */
function renderEmphasis(content: string, isUser: boolean) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong
          key={index}
          className={
            isUser ? "font-semibold" : "font-semibold text-[#CCFF00]"
          }
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

/**
 * A single chat message.
 *
 * User messages sit right in lime on black — the accent marks "you",
 * which is the one thing worth distinguishing at a glance in a
 * transcript. Coach replies sit left on a raised charcoal surface.
 *
 * While a reply streams, a caret trails the text so it reads as being
 * written rather than stalled.
 */
export function MessageBubble({
  role,
  content,
  videos,
  isStreaming = false,
}: MessageBubbleProps) {
  const prefersReducedMotion = useReducedMotion();
  const isUser = role === "user";

  const entrance = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      };

  return (
    <motion.div
      {...entrance}
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[88%] space-y-3 rounded-2xl px-4 py-3 text-[15px] leading-relaxed sm:max-w-[78%]",
          isUser
            ? "rounded-br-md bg-[#CCFF00] font-medium text-black"
            : "rounded-bl-md border border-white/[0.07] bg-[#1F2228] text-white/80",
        )}
      >
        <p className="whitespace-pre-wrap break-words">
          {renderEmphasis(content, isUser)}
          {isStreaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse rounded-full bg-[#CCFF00] align-baseline"
            />
          )}
        </p>

        {/* Exercise demos, attached once the reply is complete. */}
        {!isUser && videos && videos.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {videos.map((video) => (
              <ExerciseVideoLink key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}