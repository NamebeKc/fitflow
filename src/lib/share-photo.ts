// src/lib/share-photo.ts

/**
 * ── SHARE PHOTO — DECODED, DRAWN, DISCARDED ─────────────────────────
 * Turns a file the user picks at share time into something the card
 * renderer can draw, and nothing else.
 *
 * THE INVARIANT THIS MODULE EXISTS TO HOLD: the image never leaves the
 * device. There is no fetch, no Firebase import, and no storage API in
 * this file, and there must never be one. The photo lives as an
 * ImageBitmap in memory, is drawn onto a canvas, and is released when
 * the dialog closes. It is not written to Firestore, not uploaded to
 * Cloud Storage, not cached, and not attached to any analytics event.
 *
 * Two consequences worth knowing:
 *
 * 1. A CANVAS RE-ENCODE STRIPS EXIF. The PNG the user shares carries
 *    none of the original metadata — no GPS coordinates, no device
 *    model, no capture timestamp. That is a real privacy improvement
 *    over posting the camera roll file directly, and it happens for
 *    free because we rasterise rather than re-wrap.
 *
 * 2. ORIENTATION MUST BE ASKED FOR. Stripping EXIF also strips the
 *    rotation flag, so a portrait photo from an iPhone lands sideways
 *    unless the decode applies orientation first. Hence
 *    `imageOrientation: "from-image"` below — the single most common
 *    bug in this kind of feature.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * Largest file we will attempt to decode.
 *
 * A 48MP phone photo is comfortably under this; the cap exists to fail
 * fast and legibly on a video or a RAW file rather than freezing a
 * mid-range Android for ten seconds and then throwing.
 */
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

/**
 * Longest edge retained in memory.
 *
 * The card is 1080², drawn cover-fit, so nothing above ~2160 on the
 * long edge can contribute a visible pixel. Decoding a 8000×6000 image
 * at full size costs ~190MB of RGBA and is the most likely way this
 * feature OOMs a low-end device.
 */
const MAX_DECODE_EDGE = 2160;

export type SharePhotoError = "not-an-image" | "too-large" | "decode-failed";

export class SharePhotoDecodeError extends Error {
  readonly reason: SharePhotoError;

  constructor(reason: SharePhotoError) {
    super(reason);
    this.name = "SharePhotoDecodeError";
    this.reason = reason;
  }
}

/**
 * A decoded photo, plus the means to let go of it.
 *
 * Wrapping rather than exposing `ImageBitmap` directly lets the element
 * fallback (older Safari, exotic codecs) satisfy the same contract, and
 * it puts `release()` next to the thing that needs releasing so callers
 * cannot forget which cleanup a given object needs.
 */
export interface SharePhoto {
  readonly source: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  /** Idempotent. Frees the bitmap or revokes the object URL. */
  release(): void;
}

/** User-facing copy for a failed pick. */
export function sharePhotoMessage(reason: SharePhotoError): string {
  switch (reason) {
    case "not-an-image":
      return "That file isn't an image.";
    case "too-large":
      return "That image is too large. Try one under 25MB.";
    case "decode-failed":
      return "That image format isn't supported here — try a JPEG or PNG.";
  }
}

/**
 * Decodes a picked file for drawing.
 *
 * Throws `SharePhotoDecodeError` so the caller can show the reason
 * rather than a generic failure.
 */
export async function decodeSharePhoto(file: File): Promise<SharePhoto> {
  if (!file.type.startsWith("image/")) {
    throw new SharePhotoDecodeError("not-an-image");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new SharePhotoDecodeError("too-large");
  }

  const bitmap = await decodeToBitmap(file);
  if (bitmap) return fromBitmap(await clampBitmap(bitmap));

  // HEIC on Chrome lands here, as does any browser without
  // createImageBitmap. The element path uses the ordinary image decoder,
  // which applies EXIF orientation itself.
  return fromElement(await decodeToElement(file));
}

/* ══ Decode paths ═════════════════════════════════════════════════ */

async function decodeToBitmap(file: File): Promise<ImageBitmap | null> {
  if (typeof createImageBitmap !== "function") return null;

  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Either the codec is unsupported, or the options bag is (Safari
    // before 16.4). Retry bare: a landscape photo still renders
    // correctly, and a rotated portrait is better than no photo.
  }

  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

/**
 * Caps memory before the bitmap reaches the renderer.
 *
 * Failure here is deliberately non-fatal — drawing the full-size bitmap
 * produces an identical card, it just costs more memory to get there.
 */
async function clampBitmap(bitmap: ImageBitmap): Promise<ImageBitmap> {
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_DECODE_EDGE) return bitmap;

  const scale = MAX_DECODE_EDGE / longest;
  try {
    const resized = await createImageBitmap(bitmap, {
      resizeWidth: Math.round(bitmap.width * scale),
      resizeHeight: Math.round(bitmap.height * scale),
      resizeQuality: "high",
    });
    bitmap.close();
    return resized;
  } catch {
    return bitmap;
  }
}

function decodeToElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const element = new Image();

    element.onload = () => resolve(element);
    element.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new SharePhotoDecodeError("decode-failed"));
    };

    element.src = url;
  });
}

/* ══ Wrappers ═════════════════════════════════════════════════════ */

function fromBitmap(bitmap: ImageBitmap): SharePhoto {
  let released = false;
  return {
    source: bitmap,
    width: bitmap.width,
    height: bitmap.height,
    release() {
      if (released) return;
      released = true;
      bitmap.close();
    },
  };
}

function fromElement(element: HTMLImageElement): SharePhoto {
  let released = false;
  return {
    source: element,
    width: element.naturalWidth,
    height: element.naturalHeight,
    release() {
      if (released) return;
      released = true;
      // Revoking while the element still points at the URL is safe; the
      // decoded frame is already owned by the element.
      URL.revokeObjectURL(element.src);
      element.src = "";
    },
  };
}
