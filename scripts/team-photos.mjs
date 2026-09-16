// Team portraits for /team and The Collective.
//
//   node scripts/team-photos.mjs <folder of originals> public/team
//
// Originals are named 01.webp … 12.webp (see MAP). Each becomes a full-frame
// 4:5 portrait, 900×1125 JPEG, with lighting and colour matched to one
// reference frame (per-channel mean/std over the face region, 80% of the
// way), a little less saturation, soft-light grain and a light sharpen, so
// twelve separate renders read as one studio session.
import sharp from "sharp";
import fs from "fs";

const src = process.argv[2], out = process.argv[3];
const MAP = { "01": "john", "02": "karl", "03": "gerald", "04": "belle", "05": "devie", "06": "red", "07": "jb", "08": "loisa", "09": "karu", "10": "david", "11": "princess", "12": "ayie" };
const REF = "04";
const W = 900, H = 1125;
const K = 0.8;

/** Skin-tone centroid over the top 60% of the frame (arms and hands sit lower). */
async function faceCentre(file) {
  const w = 112, h = 140;
  const { data } = await sharp(file).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h * 0.6; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    if (r > 95 && g > 40 && b > 20 && r > g && g > b && r - g > 12 && r - b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15) { sx += x; sy += y; n++; }
  }
  const meta = await sharp(file).metadata();
  const c = n < 30 ? { x: 0.5, y: 0.33 } : { x: (sx / n + 0.5) / w, y: (sy / n + 0.5) / h };
  return { x: c.x * meta.width, y: c.y * meta.height, w: meta.width, h: meta.height };
}

/** The face region the colour match is measured on — a square around the face. */
async function faceBox(file) {
  const f = await faceCentre(file);
  const side = Math.round(Math.min(f.w, f.h) * 0.55);
  const left = Math.max(0, Math.min(Math.round(f.x - side / 2), f.w - side));
  const top = Math.max(0, Math.min(Math.round(f.y - side * 0.45), f.h - side));
  return { left, top, width: side, height: side };
}

const stats = async (file, box) => (await sharp(file).extract(box).stats()).channels.slice(0, 3).map((c) => ({ mean: c.mean, std: c.stdev }));

const files = fs.readdirSync(src).filter((f) => /\.(webp|png|jpe?g)$/i.test(f)).sort();
const refFile = `${src}/${files.find((f) => f.startsWith(REF))}`;
const ref = await stats(refFile, await faceBox(refFile));
fs.mkdirSync(out, { recursive: true });

for (const f of files) {
  const slug = MAP[f.slice(0, 2)];
  if (!slug) continue;
  const path = `${src}/${f}`;
  const cur = await stats(path, await faceBox(path));
  const a = cur.map((c, i) => 1 + K * (ref[i].std / c.std - 1));
  const b = cur.map((c, i) => c.mean + K * (ref[i].mean - c.mean) - a[i] * c.mean);
  const grain = await sharp({ create: { width: W, height: H, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 9 } } }).png().toBuffer();
  await sharp(path)
    .resize(W, H, { fit: "cover", position: "top", kernel: "lanczos3" })
    .linear(a, b)
    .modulate({ saturation: 0.94 })
    .composite([{ input: grain, blend: "soft-light" }])
    .sharpen({ sigma: 0.8, m1: 0.6, m2: 0.4 })
    .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(`${out}/${slug}.jpg`);
  console.log(slug.padEnd(9), `gain ${a.map((v) => v.toFixed(2)).join("/")}`, `${(fs.statSync(`${out}/${slug}.jpg`).size / 1024).toFixed(0)}KB`);
}
