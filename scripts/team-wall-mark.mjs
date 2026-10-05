// Puts the hostOS fingerprint on the wall behind each portrait.
//
//   node scripts/team-wall-mark.mjs <folder of originals> <output folder>
//
// The studio renders carry an older "H" glyph above the "HostOS" lettering
// on the wall. For each photo this finds the lettering (the widest bright
// band in the upper-right of the frame), then the glyph above it, paints
// the glyph out with the wall's own colour (sampled row by row either side
// of it) and draws the fingerprint mark in the glyph's place — brushed
// silver, softened to the wall's depth of field. The lettering stays.
import sharp from "sharp";
import fs from "fs";

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("usage: node scripts/team-wall-mark.mjs <src> <out>"); process.exit(1); }
fs.mkdirSync(out, { recursive: true });

const RIDGES = ["M18 46V36a14 14 0 0 1 28 0v5", "M23 50V36a9 9 0 0 1 18 0v8", "M27.5 47.5V36.5a4.5 4.5 0 0 1 9 0v9"];
const CORE = "M32 40v13";

/** The mark in brushed silver, `size` px square, on a transparent ground. */
async function markPng(size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
  <defs>
    <linearGradient id="s" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F4F6FA"/><stop offset="0.5" stop-color="#C9D1DC"/><stop offset="1" stop-color="#EEF1F6"/>
    </linearGradient>
  </defs>
  <rect x="7" y="7" width="50" height="50" rx="14" stroke="url(#s)" stroke-width="3.6"/>
  ${RIDGES.map((d) => `<path d="${d}" stroke="url(#s)" stroke-width="3.3" stroke-linecap="round"/>`).join("")}
  <path d="${CORE}" stroke="url(#s)" stroke-width="3.3" stroke-linecap="round"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * Finds the glyph on the wall: the one bright connected shape in the
 * upper-right of the frame that is glyph-sized (taller than wide, a hand's
 * width across) and does not touch the search region's edge — window
 * light and faces are far bigger and run off the edge; the lettering's
 * letters are far smaller. Returns its pixel box in the full frame.
 */
function locate(data, W, H, region) {
  const step = 2; // work at half resolution
  const rw = Math.floor((region.right - region.left) / step), rh = Math.floor((region.bottom - region.top) / step);
  const mask = new Uint8Array(rw * rh);
  for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) {
    const x = region.left + i * step, y = region.top + j * step, k = (y * W + x) * 3;
    mask[j * rw + i] = luma(data[k], data[k + 1], data[k + 2]) > 150 ? 1 : 0;
  }
  const seen = new Uint8Array(rw * rh);
  const blobs = [];
  const stack = [];
  for (let start = 0; start < rw * rh; start++) {
    if (!mask[start] || seen[start]) continue;
    let n = 0, x0 = rw, x1 = 0, y0 = rh, y1 = 0;
    stack.push(start); seen[start] = 1;
    while (stack.length) {
      const p = stack.pop(); const px = p % rw, py = (p - px) / rw;
      n++; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = px + dx, ny = py + dy; if (nx < 0 || ny < 0 || nx >= rw || ny >= rh) continue;
        const q = ny * rw + nx; if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    const w = (x1 - x0 + 1) * step, h = (y1 - y0 + 1) * step;
    const edge = x0 === 0 || y0 === 0 || x1 === rw - 1 || y1 === rh - 1;
    const fill = (n * step * step) / (w * h);
    // a whole glyph, or one blade of it (the glyph's two blades can split at this threshold)
    if (!edge && w >= 28 && w <= 240 && h >= 80 && h <= 300 && h / w >= 1.05 && h / w <= 4.5 && fill >= 0.15 && fill <= 0.8) {
      blobs.push({ left: region.left + x0 * step, right: region.left + x1 * step + step - 1, top: region.top + y0 * step, bottom: region.top + y1 * step + step - 1, area: n });
    }
  }
  if (blobs.length === 0) return null;
  // blades that sit side by side are one glyph
  blobs.sort((a, b) => b.area - a.area);
  const g = { ...blobs[0] };
  for (const b of blobs.slice(1)) {
    const near = b.left <= g.right + 40 && b.right >= g.left - 40 && b.top <= g.bottom && b.bottom >= g.top;
    if (near) { g.left = Math.min(g.left, b.left); g.right = Math.max(g.right, b.right); g.top = Math.min(g.top, b.top); g.bottom = Math.max(g.bottom, b.bottom); g.area += b.area; }
  }
  // then take in the dimmer metal around it (luma > 100, the wall is under 95), without reaching the lettering below
  const w = g.right - g.left + 1, h = g.bottom - g.top + 1;
  const win = { left: Math.max(region.left, g.left - Math.round(w * 0.9)), right: Math.min(region.right - 1, g.right + Math.round(w * 0.5)), top: Math.max(region.top, g.top - Math.round(h * 0.12)), bottom: Math.min(region.bottom - 1, g.bottom + Math.round(h * 0.06)) };
  const ext = { ...g };
  for (let y = win.top; y <= win.bottom; y++) for (let x = win.left; x <= win.right; x++) {
    const k = (y * W + x) * 3;
    if (luma(data[k], data[k + 1], data[k + 2]) > 100) { ext.left = Math.min(ext.left, x); ext.right = Math.max(ext.right, x); ext.top = Math.min(ext.top, y); ext.bottom = Math.max(ext.bottom, y); }
  }
  // a glyph is about three-quarters as wide as it is tall; when only the brighter blade was found, widen to the left
  const eh = ext.bottom - ext.top + 1, ew = ext.right - ext.left + 1;
  if (ew < eh * 0.6) ext.left = Math.max(region.left, ext.right - Math.round(eh * 0.78));
  return { glyph: ext };
}

for (const file of fs.readdirSync(src).filter((f) => /\.(webp|jpe?g|png)$/i.test(f)).sort()) {
  const path = `${src}/${file}`;
  const img = sharp(path);
  const { width: W, height: H } = await img.metadata();
  const { data } = await img.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const found = locate(data, W, H, { left: Math.round(W * 0.58), right: Math.round(W * 0.985), top: Math.round(H * 0.04), bottom: Math.round(H * 0.42) });
  if (!found) { console.log(`${file}: wall lettering not found — copied as is`); fs.copyFileSync(path, `${out}/${file}`); continue; }
  const { glyph } = found;
  const pad = 16, feather = 12; // the outer 12px of the patch fade into the wall
  const box = { left: Math.max(0, glyph.left - pad), top: Math.max(0, glyph.top - pad), right: Math.min(W, glyph.right + pad), bottom: Math.min(H, glyph.bottom + pad) };
  // paint the glyph out with the wall: blend the wall sampled just outside the box on all four sides,
  // so a vertical light falloff on the wall carries through the patch
  const bw = box.right - box.left, bh = box.bottom - box.top;
  const at = (x, y) => { const i = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const patch = Buffer.alloc(bw * bh * 4);
  for (let y = box.top; y < box.bottom; y++) {
    const l = at(box.left - 12, y), r = at(box.right + 12, y);
    const ty = (y - box.top) / bh;
    for (let x = box.left; x < box.right; x++) {
      const tx = (x - box.left) / bw;
      const t = at(x, box.top - 6), b = at(x, box.bottom + 3);
      const o = ((y - box.top) * bw + (x - box.left)) * 4;
      for (let c = 0; c < 3; c++) patch[o + c] = Math.round(0.5 * (l[c] * (1 - tx) + r[c] * tx) + 0.5 * (t[c] * (1 - ty) + b[c] * ty));
      const edge = Math.min(x - box.left, box.right - 1 - x, y - box.top, box.bottom - 1 - y);
      patch[o + 3] = Math.round(255 * Math.min(1, edge / feather));
    }
  }
  const patchPng = await sharp(patch, { raw: { width: bw, height: bh, channels: 4 } }).blur(1.2).png().toBuffer();
  // the mark: as tall as the glyph, centred on it, softened like the wall
  const size = Math.round((glyph.bottom - glyph.top) * 1.02);
  const cx = Math.round((glyph.left + glyph.right) / 2), cy = Math.round((glyph.top + glyph.bottom) / 2);
  const mark = await sharp(await markPng(size)).blur(0.9).png().toBuffer();
  await img
    .composite([
      { input: patchPng, left: box.left, top: box.top },
      { input: mark, left: Math.max(0, cx - Math.round(size / 2)), top: Math.max(0, cy - Math.round(size / 2)) },
    ])
    .webp({ quality: 95 })
    .toFile(`${out}/${file.replace(/\.[a-z]+$/i, ".webp")}`);
  console.log(`${file}: glyph ${glyph.right - glyph.left}×${glyph.bottom - glyph.top} at (${glyph.left},${glyph.top}) → mark ${size}px`);
}
