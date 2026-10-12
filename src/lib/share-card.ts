// src/lib/share-card.ts
import { activityLabel } from "@/lib/profile";
import {
  formatStrengthSet,
  intensityLabel,
  type WorkoutEntry,
} from "@/lib/workouts";
import { lineForCard } from "@/lib/share-lines";
import type { SharePhoto } from "@/lib/share-photo";

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

/**
 * Height of the photo band in the photo-forward layout.
 *
 * 600 of 1080 — the photo has to be the first thing read, or attaching
 * one is pointless. Everything below is solid obsidian, so text
 * contrast in the lower 44% does not depend on the image at all.
 */
const PHOTO_BAND = 600;

/**
 * The card carries LITERAL colours because canvas cannot read CSS
 * custom properties. These are the dark ("press") theme values from
 * globals.css, copied by hand — a shared card lands in a feed, not
 * in the app, and dark is the right ground there.
 *
 * KEEP IN SYNC WITH globals.css .dark BY HAND. There is no import
 * that can do it for you, and a drift here shows up as a card that
 * is subtly the wrong brand.
 */
const PRESS = "#13100C";
const ACCENT = "#80A5E7";
const INK = "#EEEBE5";

export interface ShareCardData {
  workout: WorkoutEntry;
  /** Consecutive weeks with 2+ sessions. Omitted when below 2. */
  streakWeeks?: number;
  /** First name, if the user wants it on the card. */
  name?: string;
  /**
   * An optional photo the user attached at share time, decoded by
   * `share-photo.ts`.
   *
   * Drawn here and dropped when the dialog closes. Nothing in this
   * module or that one uploads or persists it — the only artefact that
   * outlives the share is the composited PNG the user chose to post.
   */
  photo?: SharePhoto | null;
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

  // The @font-face faces in globals.css load asynchronously. Drawing
  // before they are ready silently falls back to a system font, so
  // wait. (This used to say next/font and Geist; the mechanism changed
  // with the redesign, the hazard did not.)
  try {
    await document.fonts.ready;
  } catch {
    // Non-fatal — system fallback still renders.
  }

  const photo = data.photo ?? null;

  drawBackground(ctx, photo);
  await drawLogo(ctx);

  // Two templates, not one template with a photo switch. The card
  // without a photo is a dense text card and every measurement in
  // `drawContent` is tuned for that; the card with one is a poster and
  // wants different type sizes, a different order, and less of the
  // session detail. Branching here keeps the original card byte-for-
  // byte identical rather than slowly compromising both.
  if (photo) {
    drawPhotoContent(ctx, data);
  } else {
    drawContent(ctx, data);
  }

  drawFooter(ctx);

  // FORMAT FOLLOWS CONTENT, and it matters more than it looks.
  //
  // Measured on a 1080² render of this card:
  //
  //   no photo, PNG    ~630KB   (flat fields, crisp type — PNG's job)
  //   photo,    PNG    ~730KB
  //   photo,    JPEG    ~95KB   ← 7-8× smaller
  //
  // A photograph is close to the worst case for PNG, and the gap widens
  // with real sensor noise — a large file is slow to hand to a share
  // sheet and gets recompressed by some targets anyway. At q=0.9 the
  // JPEG is
  // indistinguishable here: the top band is a photo already, and
  // everything below it is flat obsidian, which JPEG encodes almost
  // perfectly.
  const type = data.photo ? "image/jpeg" : "image/png";

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, 0.9);
  });
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  photo: SharePhoto | null,
) {
  ctx.fillStyle = PRESS;
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (photo) drawPhoto(ctx, photo);

  // NO BLOOM. The lime radial glow that used to sit top-left is gone
  // with the rest of the glows (design.md section 4.4). It was already
  // suppressed on the photo layout for reading as an olive stain; the
  // honest conclusion was that a low-alpha accent wash over near-black
  // reads as dirt in every layout, not just that one.

  // Inner card edge
  ctx.strokeStyle = photo
    ? "rgba(255, 255, 255, 0.14)"
    : "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 2;
  roundedRect(ctx, 48, 48, SIZE - 96, SIZE - 96, 48);
  ctx.stroke();
}

/**
 * The user's photo, as the top band of the card.
 *
 * WHY A BAND AND NOT A FULL-BLEED BACKGROUND. Full-bleed was the first
 * version and it worked, but it cost the photo everything: keeping text
 * legible across a whole 1080² frame means ~0.6–0.8 darkening
 * everywhere, and a face under 0.7 darkening is no longer a face. The
 * point of attaching a photo is that the person is in it.
 *
 * Confining the image to the top 600px means only the logo and the
 * caption sit on it. Everything with real contrast demands — the
 * activity, the duration, the footer — sits on solid obsidian below,
 * where legibility is guaranteed by construction instead of by scrim
 * arithmetic.
 *
 * THE BAND HAS NO EDGE. The bottom gradient resolves to the same
 * obsidian the card is filled with, so the photo dissolves rather than
 * stopping at a visible seam. A hard line there reads as two images
 * stuck together.
 *
 * THE CROP IS ANCHORED ON THE FACE, NOT THE CENTRE. Cover-fit centres
 * by default, which on a portrait phone photo frames the chest. A fixed
 * upward bias was tried and fails in the other direction: the same
 * offset that frames a full-body shot beheads a square selfie, because
 * the two overflow the band by wildly different amounts. Anchoring on a
 * fraction of the SOURCE image is stable across both.
 */
function drawPhoto(ctx: CanvasRenderingContext2D, photo: SharePhoto) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, SIZE, PHOTO_BAND);
  ctx.clip();

  const scale = Math.max(SIZE / photo.width, PHOTO_BAND / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;

  // Faces sit around a third of the way down a portrait. Put that point
  // at the centre of the band, then clamp so the image can never be
  // pulled far enough to expose background at either edge.
  const FOCUS = 0.32;
  const offsetY = Math.min(
    0,
    Math.max(PHOTO_BAND - height, PHOTO_BAND / 2 - height * FOCUS),
  );

  ctx.drawImage(photo.source, (SIZE - width) / 2, offsetY, width, height);

  // Flat knock-back. Enough to stop a blown-out highlight glaring in a
  // feed, light enough that the photo still reads as a photograph.
  // Indigo-deep, not neutral black: a cool scrim keeps skin tones warm
  // by contrast instead of greying them. design.md section 6.9.
  ctx.fillStyle = "rgba(28, 43, 83, 0.22)";
  ctx.fillRect(0, 0, SIZE, PHOTO_BAND);

  // Top scrim: the logo sits at y=96 and has to survive a white sky or
  // a bright wall.
  const top = ctx.createLinearGradient(0, 0, 0, 200);
  top.addColorStop(0, "rgba(9, 10, 12, 0.60)");
  top.addColorStop(1, "rgba(9, 10, 12, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, SIZE, 200);

  // Bottom scrim: holds nothing until y≈300, then ramps hard so the
  // caption at y≈470–554 sits on near-solid ground and the band ends
  // flush with the card's own background.
  const bottom = ctx.createLinearGradient(0, 300, 0, PHOTO_BAND);
  bottom.addColorStop(0, "rgba(9, 10, 12, 0)");
  bottom.addColorStop(0.55, "rgba(9, 10, 12, 0.66)");
  bottom.addColorStop(1, "rgba(9, 10, 12, 1)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 300, SIZE, PHOTO_BAND - 300);

  ctx.restore();
}

/**
 * The photo-forward card body.
 *
 * WHAT THIS LAYOUT DROPS, AND WHY. No exercise list. There is room for
 * the photo or for the set-by-set breakdown, not both, and the photo is
 * the version someone posts. The list was always the lossiest element
 * on the card anyway — four rows and a "+8 more" is a summary of a
 * summary. The plain card still carries it in full.
 *
 * ORDER IS INVERTED RELATIVE TO `drawContent`. There, the quote sits
 * last because everything above it is the proof that earns it. Here the
 * photo is the proof, so the quote becomes its caption and the numbers
 * follow on solid ground.
 *
 * POSITIONS ARE FIXED, NOT FLOWED. This layout has no variable-height
 * block left in it, so a running Y cursor would buy nothing and would
 * reintroduce the overlap class of bug documented on `drawContent`.
 */
function drawPhotoContent(ctx: CanvasRenderingContext2D, data: ShareCardData) {
  const { workout, streakWeeks } = data;
  const LEFT = 96;
  const RIGHT = SIZE - 96;
  const WIDTH = RIGHT - LEFT;

  // ── Caption, over the foot of the photo ───────────────────────────
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(LEFT, 470);
  ctx.lineTo(LEFT + 52, 470);
  ctx.stroke();

  ctx.fillStyle = INK;
  ctx.font = `500 32px ${sansStack()}`;
  wrapText(ctx, quote(workout), LEFT, 512, WIDTH - 40, 42);

  // ── Eyebrow ───────────────────────────────────────────────────────
  ctx.fillStyle = ACCENT;
  ctx.font = `500 26px ${monoStack()}`;
  ctx.letterSpacing = "5px";
  ctx.fillText("SESSION COMPLETE", LEFT, 650);
  ctx.letterSpacing = "0px";

  // ── Activity ──────────────────────────────────────────────────────
  // Shrunk to fit rather than wrapped: a second line here would push
  // into the duration, and there is no slack below to absorb it.
  const label = activityLabel(workout.activity);
  ctx.fillStyle = INK;
  fitFont(ctx, label, WIDTH, 72, 40, 600, sansStack());
  ctx.fillText(label, LEFT, 728);

  // ── Duration ──────────────────────────────────────────────────────
  ctx.fillStyle = ACCENT;
  ctx.font = `500 100px ${monoStack()}`;
  const minutes = String(workout.durationMin);
  ctx.fillText(minutes, LEFT, 836);

  const minutesWidth = ctx.measureText(minutes).width;
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = `400 32px ${sansStack()}`;
  ctx.fillText("min", LEFT + minutesWidth + 16, 836);

  // ── Detail row ────────────────────────────────────────────────────
  const details: string[] = [
    intensityLabel(workout.intensity),
    formatDate(workout.date),
  ];
  if (streakWeeks && streakWeeks >= 2) {
    details.push(`${streakWeeks}-WEEK STREAK`);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = `400 24px ${monoStack()}`;
  ctx.letterSpacing = "2px";
  ctx.fillText(details.join("   ·   ").toUpperCase(), LEFT, 872);
  ctx.letterSpacing = "0px";
}

/**
 * Sets the largest font size at or below `start` that fits `text` into
 * `maxWidth`, and returns it.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  weight: number,
  stack: string,
): number {
  let size = start;
  ctx.font = `${weight} ${size}px ${stack}`;
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${stack}`;
  }
  return size;
}

async function drawLogo(ctx: CanvasRenderingContext2D) {
  try {
    // Horizontal lockup: on a shared image the wordmark is doing the
    // work, since a stranger seeing the mark alone learns nothing.
    // The LIGHT variant. The main logo went indigo with the redesign,
    // and indigo on this card's near-black ground measures 1.85:1 —
    // invisible. The light variant is the same geometry with its
    // value structure inverted, at 17.76:1.
    const logo = await loadImage("/logo-horizontal-light.png");
    const height = 64;
    const width = (logo.width / logo.height) * height;
    ctx.drawImage(logo, 96, 96, width, height);
  } catch {
    // If the logo fails to load, the card still works — draw a dot.
    ctx.fillStyle = ACCENT;
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
  ctx.fillStyle = ACCENT;
  ctx.font = `500 26px ${monoStack()}`;
  ctx.letterSpacing = "5px";
  ctx.fillText("SESSION COMPLETE", LEFT, y);
  ctx.letterSpacing = "0px";

  // Activity
  y += 84;
  ctx.fillStyle = INK;
  ctx.font = `600 72px ${sansStack()}`;
  y = wrapText(ctx, activityLabel(workout.activity), LEFT, y, WIDTH, 80);

  // Duration
  y += 140;
  ctx.fillStyle = ACCENT;
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
        ctx.fillStyle = ACCENT;
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

  ctx.strokeStyle = ACCENT;
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
  ctx.fillStyle = ACCENT;
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
  // Derived from the blob rather than assumed: `renderShareCard`
  // switches to JPEG when a photo is attached, and a .png named file
  // carrying JPEG bytes confuses enough share targets to matter.
  const extension = blob.type === "image/jpeg" ? "jpg" : "png";
  const filename = `adimfit-${workout.date}.${extension}`;
  const file = new File([blob], filename, {
    type: blob.type || "image/png",
  });

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
  return `"Archivo", ui-sans-serif, system-ui, -apple-system, sans-serif`;
}

function monoStack(): string {
  // Archivo, not a monospace. Canvas2D exposes no font-feature-settings,
  // so tabular figures cannot be requested here anyway, and nothing on
  // a share card is in a column that needs aligning.
  return `"Archivo", ui-sans-serif, system-ui, sans-serif`;
}

function formatDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}