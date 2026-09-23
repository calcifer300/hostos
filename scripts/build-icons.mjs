/**
 * Renders the Companion's icon set from the brand mark.
 *
 *   node scripts/build-icons.mjs
 *
 * The mark is the hostOS fingerprint (src/components/brand/logo-mark.tsx,
 * public/icon.svg): a rounded square in the brand gradient with three
 * ridges over a core line. Generated rather than hand-drawn because the
 * three sizes must stay identical in spirit but not in geometry: at 16px a
 * scaled-down print is a smudge, so the small icon keeps the frame, the
 * outer ridge and the core only, with heavier strokes.
 */

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "extension");

// The app's accents (globals.css), so the toolbar icon and the dashboard it opens are visibly one product.
const ACCENT = "#3B9CFF";
const ACCENT_2 = "#9B6BFF";

/**
 * @param size    pixel size of the square
 * @param stroke  stroke width in 64-unit mark space
 * @param detail  "full" (three ridges) or "small" (outer ridge and core only)
 */
function mark(size, stroke, detail) {
  const ridges = detail === "full" ? ["M18 46V36a14 14 0 0 1 28 0v5", "M23 50V36a9 9 0 0 1 18 0v8", "M27.5 47.5V36.5a4.5 4.5 0 0 1 9 0v9"] : ["M19 47V36a13 13 0 0 1 26 0v6"];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="frame" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${ACCENT}"/>
      <stop offset="1" stop-color="${ACCENT_2}"/>
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="62" height="62" rx="17" fill="#0B0D14"/>
  <rect x="${detail === "full" ? 8 : 7}" y="${detail === "full" ? 8 : 7}" width="${detail === "full" ? 48 : 50}" height="${detail === "full" ? 48 : 50}" rx="14" stroke="url(#frame)" stroke-width="${stroke + 0.5}"/>
  <g stroke="#F5F7FF" stroke-width="${stroke}" stroke-linecap="round">
    ${ridges.map((d) => `<path d="${d}"/>`).join("\n    ")}
    <path d="M32 40v13"/>
  </g>
</svg>`;
}

/** Per-size tuning: heavier strokes and less detail as the icon shrinks. */
const SIZES = [
  { size: 16, stroke: 6, detail: "small", file: "icon16.png" },
  { size: 48, stroke: 4, detail: "full", file: "icon48.png" },
  { size: 128, stroke: 3.25, detail: "full", file: "icon128.png" },
];

const written = [];

for (const { size, stroke, detail, file } of SIZES) {
  const svg = mark(size, stroke, detail);
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
