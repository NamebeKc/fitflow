// src/lib/share-card.ts
import { activityLabel } from "@/lib/profile";
import {
  formatStrengthSet,
  intensityLabel,
  type WorkoutEntry,
} from "@/lib/workouts";
import { lineForCard } from "@/lib/share-lines";

/**
 * ── SHAREABLE WORKOUT CARD ──────────────────────────────────────────
 * Renders a logged session as a 1080×1080 PNG, entirely in the
 * browser.
 *
 * Client-side canvas rather than server-rendered images: a share costs
 * nothing, needs no Cloud Run compute, and appears instantly. Since
 * every share is potential acquisition, the marginal cost of the
 * channel being zero matters.
 *
 * Square is deliberate — 1080×1080 posts natively to Instagram feed,
 * X, LinkedIn, WhatsApp status, and Facebook without cropping. A
 * portrait card looks better in one place and gets cut in five.
 *
 * WHAT IS NEVER ON THE CARD: weight, BMI, height, or any body metric.
 * People share these publicly and permanently. The card celebrates
 * what someone DID, which is the part they actually earned.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * The card is an advertisement, so the destination has to be legible
 * and memorable at a glance in a feed. This is the one place a URL
 * earns more space than a tagline.
 */
const SHARE_DOMAIN = "adimfit.com";

const SIZE = 1080;
const OBSIDIAN = "#090A0C";
const SURFACE = "#14161A";
const LIME = "#CCFF00";

export interface ShareCardData {
  workout: WorkoutEntry;
  /** Consecutive weeks with 2+ sessions. Omitted when below 2. */
  streakWeeks?: number;
  /** First name, if the user wants it on the card. */
  name?: string;
}

/** Draws the card and returns it as a PNG blob. */
export async function renderShareCard(
  data: ShareCardData,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // next/font loads Geist asynchronously. Drawing before it's ready
  // silently falls back to a system font, so wait for it.
  try {
    await document.fonts.ready;
  } catch {
    // Non-fatal — system fallback still renders.
  }

  drawBackground(ctx);
  await drawLogo(ctx);
  drawContent(ctx, data);
  drawFooter(ctx);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = OBSIDIAN;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Lime bloom, top-left — the same ambient glow the app uses, so a
  // shared card is recognisably the same product.
  const bloom = ctx.createRadialGradient(220, 140, 0, 220, 140, 760);
  bloom.addColorStop(0, "rgba(204, 255, 0, 0.14)");
  bloom.addColorStop(1, "rgba(204, 255, 0, 0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Inner card edge
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 2;
  roundedRect(ctx, 48, 48, SIZE - 96, SIZE - 96, 48);
  ctx.stroke();
}

async function drawLogo(ctx: CanvasRenderingContext2D) {
  try {
    // Horizontal lockup: on a shared image the wordmark is doing the
    // work, since a stranger seeing the mark alone learns nothing.
    const logo = await loadImage("/logo-horizontal.png");
    const height = 64;
    const width = (logo.width / logo.height) * height;
    ctx.drawImage(logo, 96, 96, width, height);
  } catch {
    // If the logo fails to load, the card still works — draw a dot.
    ctx.fillStyle = LIME;
    ctx.beginPath();
    ctx.arc(120, 132, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * The card body.
 *
 * Laid out from a running Y cursor rather than fixed coordinates,
 * because the content genuinely varies: a strength session lists
 * exercises, a walk doesn't. Fixed positions would leave a hole in one
 * case and overlap in the other.
 *
 * Order is deliberate — what you did, then how much, then the specific
 * work, then the line. The quote sits last because it's the part
 * someone else reads; everything above it is the proof that earns it.
 */
/**
 * The card body.
 *
 * Laid out from a running Y cursor rather than fixed coordinates,
 * because the content genuinely varies: a strength session lists
 * exercises, a walk doesn't.
 *
 * VERTICAL ADVANCES MUST EXCEED THE FONT SIZE THAT FOLLOWS. Canvas
 * draws from the baseline, so a 140px number placed 100px below the
 * previous baseline will overlap it by roughly the cap height. Each
 * step below is sized against the type it precedes.
 */
/**
 * The card body.
 *
 * TWO RULES LEARNED THE HARD WAY:
 *
 * 1. Vertical advances must exceed the font size that FOLLOWS. Canvas
 *    draws from the baseline, so a 128px number placed 100px below the
 *    previous baseline overlaps it by roughly its cap height.
 *
 * 2. The quote is bottom-anchored and the exercise list is bounded to
 *    fit above it — not the reverse. An earlier version clamped the
 *    quote upward when the list was long, which pushed it straight
 *    through the exercises.
 */
function drawContent(ctx: CanvasRenderingContext2D, data: ShareCardData) {
  const { workout, streakWeeks } = data;
  const LEFT = 96;
  const RIGHT = SIZE - 96;
  const WIDTH = RIGHT - LEFT;

  let y = 240;

  // Eyebrow
  ctx.fillStyle = LIME;
  ctx.font = `500 26px ${monoStack()}`;
  ctx.letterSpacing = "5px";
  ctx.fillText("SESSION COMPLETE", LEFT, y);
  ctx.letterSpacing = "0px";

  // Activity
  y += 84;
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `600 72px ${sansStack()}`;
  y = wrapText(ctx, activityLabel(workout.activity), LEFT, y, WIDTH, 80);

  // Duration
  y += 140;
  ctx.fillStyle = LIME;
  ctx.font = `500 128px ${monoStack()}`;
  const minutes = String(workout.durationMin);
  ctx.fillText(minutes, LEFT, y);

  const minutesWidth = ctx.measureText(minutes).width;
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = `400 36px ${sansStack()}`;
  ctx.fillText("min", LEFT + minutesWidth + 18, y);

  // Detail row
  y += 48;
  const details: string[] = [
    intensityLabel(workout.intensity),
    formatDate(workout.date),
  ];
  if (streakWeeks && streakWeeks >= 2) {
    details.push(`${streakWeeks}-WEEK STREAK`);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = `400 28px ${monoStack()}`;
  ctx.letterSpacing = "2px";
  ctx.fillText(details.join("   ·   ").toUpperCase(), LEFT, y);
  ctx.letterSpacing = "0px";

  // ── The work itself ───────────────────────────────────────────────
  const all = exerciseLines(workout);

  // Four rows maximum, always. When there are more, the fourth row
  // becomes the overflow note rather than being added below it — so
  // the block height is fixed and the quote below it can be too.
  const MAX_ROWS = 4;
  let rows = all.slice(0, MAX_ROWS);
  if (all.length > MAX_ROWS) {
    rows = [...all.slice(0, MAX_ROWS - 1), `+ ${all.length - (MAX_ROWS - 1)} more`];
  }

  if (rows.length > 0) {
    y += 46;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LEFT, y);
    ctx.lineTo(RIGHT, y);
    ctx.stroke();

    y += 42;
    rows.forEach((line, index) => {
      const overflow = all.length > MAX_ROWS && index === MAX_ROWS - 1;

      if (!overflow) {
        ctx.fillStyle = LIME;
        ctx.font = `400 24px ${monoStack()}`;
        ctx.fillText("—", LEFT, y);
      }

      ctx.fillStyle = overflow
        ? "rgba(255, 255, 255, 0.45)"
        : "rgba(255, 255, 255, 0.82)";
      ctx.font = `400 ${overflow ? 24 : 28}px ${sansStack()}`;
      ctx.fillText(truncate(ctx, line, WIDTH - 48), LEFT + 40, y);
      y += 40;
    });
  }

  // ── The line ──────────────────────────────────────────────────────
  // Fixed position, chosen so the bounded list above always clears it.
  const quoteTop = rows.length > 0 ? 806 : 748;

  ctx.strokeStyle = LIME;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(LEFT, quoteTop - 46);
  ctx.lineTo(LEFT + 52, quoteTop - 46);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = `500 32px ${sansStack()}`;
  wrapText(ctx, quote(workout), LEFT, quoteTop, WIDTH - 40, 42);
}

/** The rotating line for this specific card. */
function quote(workout: WorkoutEntry): string {
  return lineForCard(workout.date, workout.id);
}

/**
 * The exercises to print.
 *
 * Structured sets carry exact loads and are preferred. Failing that,
 * the notes field holds the bullet list written by a one-tap plan log,
 * which is the next best thing.
 */
function exerciseLines(workout: WorkoutEntry): string[] {
  if (workout.strength && workout.strength.length > 0) {
    return workout.strength.map(formatStrengthSet);
  }

  if (workout.notes) {
    return workout.notes
      .split("\n")
      .map((line) => line.replace(/^[•\-\s]+/, "").trim())
      .filter((line) => line.length > 0 && line.length < 60);
  }

  return [];
}

/** Clips a string to a pixel width, with an ellipsis. */
function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trim()}…`;
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  const y = SIZE - 140;

  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, y - 52);
  ctx.lineTo(SIZE - 96, y - 52);
  ctx.stroke();

  // The lockup at the top already carries the name, so the footer
  // gives the pitch rather than repeating the brand.
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = `400 28px ${sansStack()}`;
  ctx.fillText("AI coaching that remembers every session", 96, y + 6);

  // Right: where to get it. Lime, because it's the call to action and
  // the eye should land here last.
  ctx.fillStyle = LIME;
  ctx.font = `500 34px ${monoStack()}`;
  const width = ctx.measureText(SHARE_DOMAIN).width;
  ctx.fillText(SHARE_DOMAIN, SIZE - 96 - width, y + 14);
}

/**
 * Shares the card, or downloads it where sharing isn't available.
 *
 * `navigator.share` with files works on iOS Safari and Android
 * Chrome — the platforms where people actually post to social. Desktop
 * support is patchy, so the fallback saves the PNG and the user posts
 * it themselves.
 */
export async function shareCard(
  blob: Blob,
  workout: WorkoutEntry,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const filename = `adimfit-${workout.date}.png`;
  const file = new File([blob], filename, { type: "image/png" });

  const shareData: ShareData = {
    files: [file],
    title: "AdimFit",
    // Some targets (WhatsApp, X) show this text alongside the image,
    // so the URL travels even when the picture is all people look at.
    text: `${workout.durationMin} minutes of ${activityLabel(
      workout.activity,
    ).toLowerCase()}. Logged with AdimFit — https://${SHARE_DOMAIN}`,
  };

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare(shareData)
  ) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      // AbortError means the user dismissed the sheet — not a failure.
      if (error instanceof Error && error.name === "AbortError") {
        return "cancelled";
      }
      // Anything else: fall through to download.
    }
  }

  downloadBlob(blob, filename);
  return "downloaded";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ══ Drawing helpers ══════════════════════════════════════════════ */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

/** Wraps long activity names rather than letting them overflow. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let offsetY = y;

  for (const word of words) {
    const attempt = line ? `${line} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && line) {
      ctx.fillText(line, x, offsetY);
      line = word;
      offsetY += lineHeight;
    } else {
      line = attempt;
    }
  }
  if (line) ctx.fillText(line, x, offsetY);

  // Returned so callers can flow content beneath a block whose height
  // depends on how many lines it wrapped to.
  return offsetY;
}

function sansStack(): string {
  return `"Geist", ui-sans-serif, system-ui, -apple-system, sans-serif`;
}

function monoStack(): string {
  return `"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace`;
}

function formatDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}