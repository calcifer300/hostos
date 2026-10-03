/**
 * The look of a team portrait, done in the browser before upload.
 *
 * Every photo on /team is a 4:5 frame, 900×1125, with its lighting nudged
 * toward one reference frame so twelve separate shoots read as one session
 * (scripts/team-photos.mjs did the same for the first set, with sharp).
 * The Founder's uploader runs this on a canvas: crop, resize, match, grain.
 *
 * Client-safe: no imports.
 */

export const PORTRAIT_W = 900;
export const PORTRAIT_H = 1125;

/** Per-channel mean / standard deviation of the reference frame (public/team/belle.jpg). */
const REFERENCE = [
  { mean: 88.1, std: 73.8 },
  { mean: 83.2, std: 69.5 },
  { mean: 84.4, std: 69.3 },
];
/** How far toward the reference an upload moves — gentler than the studio set, since a real photo may be lit very differently. */
const MATCH = 0.5;

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 12 * 1024 * 1024;

/** Photos next/image may optimise: files on this site, and uploads in our own storage bucket. */
export const isOptimizableSrc = (url: string): boolean => url.startsWith("/") || /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(url);

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    img.src = url;
  });
}

/** Crop to 4:5 — centred, but keeping the top of a tall frame, where a face sits — and resize to the portrait size. */
function drawCropped(img: HTMLImageElement, ctx: CanvasRenderingContext2D) {
  const target = PORTRAIT_W / PORTRAIT_H;
  const ratio = img.naturalWidth / img.naturalHeight;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (ratio > target) {
    sw = Math.round(sh * target);
    sx = Math.round((img.naturalWidth - sw) / 2);
  } else if (ratio < target) {
    sh = Math.round(sw / target);
    sy = Math.round((img.naturalHeight - sh) * 0.12);
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PORTRAIT_W, PORTRAIT_H);
}

/** Move each channel's mean and spread part-way to the reference, then lay a little grain over it. */
function matchLook(ctx: CanvasRenderingContext2D) {
  const image = ctx.getImageData(0, 0, PORTRAIT_W, PORTRAIT_H);
  const d = image.data;
  const n = PORTRAIT_W * PORTRAIT_H;
  const sum = [0, 0, 0], sq = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) { sum[c] += d[i + c]; sq[c] += d[i + c] * d[i + c]; }
  const gain: number[] = [], lift: number[] = [];
  for (let c = 0; c < 3; c++) {
    const mean = sum[c] / n;
    const std = Math.sqrt(Math.max(1, sq[c] / n - mean * mean));
    const a = Math.min(1.35, Math.max(0.75, 1 + MATCH * (REFERENCE[c].std / std - 1)));
    gain[c] = a;
    lift[c] = mean + MATCH * (REFERENCE[c].mean - mean) - a * mean;
  }
  for (let i = 0; i < d.length; i += 4) {
    const grain = (Math.random() - 0.5) * 9;
    for (let c = 0; c < 3; c++) {
      const v = gain[c] * d[i + c] + lift[c] + grain;
      d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** A file from the Founder's disk → the 4:5 JPEG the page expects (~150 KB). */
export async function prepareTeamPhoto(file: File, { match = true }: { match?: boolean } = {}): Promise<Blob> {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error("Use a JPG, PNG or WebP photo.");
  if (file.size > PHOTO_MAX_BYTES) throw new Error("That photo is over 12 MB — export a smaller copy.");
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = PORTRAIT_W;
  canvas.height = PORTRAIT_H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser could not prepare the photo.");
  ctx.imageSmoothingQuality = "high";
  drawCropped(img, ctx);
  if (match) matchLook(ctx);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The photo could not be encoded."))), "image/jpeg", 0.86));
}
