/**
 * Renders the Companion's icon set from one SVG source.
 *
 *   node scripts/build-icons.mjs
 *
 * The mark is a rounded square in the app's accent blue carrying a white "H",
 * with the counter cut as a horizontal bar rather than a letterform crossbar —
 * so at 16px, where a real H's stems merge into a blob, it still reads as a
 * distinct shape rather than a smudge.
 *
 * Generated rather than hand-drawn because the three sizes must stay
 * identical, and because a 16px icon is not a scaled-down 128px one: the small
 * size gets thicker strokes and less corner rounding, or it turns to mush.
 */

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "extension");

// The app's dark-theme accent, so the toolbar icon and the dashboard it opens
// are visibly the same product. See globals.css.
const ACCENT = "#0A84FF";
const ACCENT_DEEP = "#0060DF";

/**
 * @param size      pixel size of the square
 * @param radius    corner radius, as a fraction of size
 * @param stemRatio stem width, as a fraction of size
 */
function mark(size, radius, stemRatio) {
  const r = size * radius;
  const stem = size * stemRatio;

  // The H, centred, with generous side bearing so it never touches the edge.
  const boxW = size * 0.46;
  const boxH = size * 0.44;
  const x0 = (size - boxW) / 2;
  const y0 = (size - boxH) / 2;
  const barH = Math.max(stem * 0.9, size * 0.075);
  const barY = y0 + boxH / 2 - barH / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_DEEP}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <g fill="#FFFFFF">
    <rect x="${x0}" y="${y0}" width="${stem}" height="${boxH}" rx="${stem / 2}"/>
    <rect x="${x0 + boxW - stem}" y="${y0}" width="${stem}" height="${boxH}" rx="${stem / 2}"/>
    <rect x="${x0}" y="${barY}" width="${boxW}" height="${barH}" rx="${barH / 2}"/>
  </g>
</svg>`;
}

/**
 * Per-size tuning. Smaller icons get proportionally thicker stems and less
 * rounding — the usual optical correction, because at 16px a mathematically
 * scaled stem is a single grey pixel.
 */
const SIZES = [
  { size: 16, radius: 0.22, stem: 0.115, file: "icon16.png" },
  { size: 48, radius: 0.235, stem: 0.098, file: "icon48.png" },
  { size: 128, radius: 0.24, stem: 0.09, file: "icon128.png" },
];

const written = [];

for (const { size, radius, stem, file } of SIZES) {
  const svg = mark(size, radius, stem);
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(out, file), png);
  written.push(`${file} (${size}px, ${png.length} B)`);
}

// The side panel's header wordmark. Transparent so it sits on the panel's own
// background rather than carrying a box of its own.
const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="96" viewBox="0 0 420 96">
  <text x="0" y="68" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="64" font-weight="700" letter-spacing="-2" fill="#F5F5F7">host<tspan fill="${ACCENT}">OS</tspan></text>
</svg>`;

const wordmarkPng = await sharp(Buffer.from(wordmark)).png({ compressionLevel: 9 }).toBuffer();
writeFileSync(join(out, "logo_white.png"), wordmarkPng);
written.push(`logo_white.png (wordmark, ${wordmarkPng.length} B)`);

console.log(`[icons] ${written.join("\n[icons] ")}`);
