/**
 * Renders the PWA icons from the brand SVG. Run after changing public/icon.svg:
 *   node scripts/build-pwa-icons.mjs
 * Uses sharp, which Next already ships. The maskable variant keeps the mark
 * inside the 80% safe zone Android crops to.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync(new URL("../public/icon.svg", import.meta.url));
mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });

async function render(size, out, padRatio = 0) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const mark = await sharp(svg).resize(inner, inner).png().toBuffer();
  const pad = Math.round(size * padRatio);
  const buf = await sharp({ create: { width: size, height: size, channels: 4, background: "#0F0F12" } })
    .composite([{ input: mark, left: pad, top: pad }])
    .png()
    .toBuffer();
  writeFileSync(new URL(`../public/icons/${out}`, import.meta.url), buf);
  console.log(`icons/${out} (${size}px)`);
}

await render(192, "icon-192.png");
await render(512, "icon-512.png");
await render(512, "icon-maskable-512.png", 0.12);
await render(180, "apple-touch-icon.png", 0.06);
