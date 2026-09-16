// Face-centred square crops with lighting matched to a reference portrait (Belle),
// a touch of grain and a little less saturation so the set reads as one shoot.
import sharp from "sharp";
import fs from "fs";

const src = process.argv[2], out = process.argv[3];
const MAP = { "01": "john", "02": "karl", "03": "gerald", "04": "belle", "05": "devie", "06": "red", "07": "jb", "08": "loisa", "09": "karu", "10": "david", "11": "princess", "12": "ayie" };
const REF = "04";
const SIDE = 820;       // crop size in source pixels
const OUT = 800;        // output size
const FACE_AT = 0.42;   // where the face centre sits in the crop (fraction from top)

async function faceCentre(file) {
  // Skin-tone centroid over the top 60% of the frame (arms/hands sit lower).
  const W = 112, H = 140;
  const { data } = await sharp(file).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < H * 0.6; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    const skin = r > 95 && g > 40 && b > 20 && r > g && g > b && r - g > 12 && r - b > 20 && Math.max(r, g, b) - Math.min(r, g, b) > 15;
    if (skin) { sx += x; sy += y; n++; }
  }
  const meta = await sharp(file).metadata();
  if (n < 30) return { x: meta.width / 2, y: meta.height * 0.33, w: meta.width, h: meta.height };
  return { x: (sx / n + 0.5) * (meta.width / W), y: (sy / n + 0.5) * (meta.height / H), w: meta.width, h: meta.height };
}

async function cropBox(file) {
  const f = await faceCentre(file);
  const side = Math.min(SIDE, f.w, f.h);
  let left = Math.round(f.x - side / 2), top = Math.round(f.y - side * FACE_AT);
  left = Math.max(0, Math.min(left, f.w - side)); top = Math.max(0, Math.min(top, f.h - side));
  return { left, top, width: side, height: side, face: f };
}

async function stats(file, box) {
  const s = await sharp(file).extract(box).stats();
  return s.channels.slice(0, 3).map((c) => ({ mean: c.mean, std: c.stdev }));
}

const files = fs.readdirSync(src).filter((f) => /\.(webp|png|jpe?g)$/i.test(f)).sort();
const refFile = files.find((f) => f.startsWith(REF));
const refBox = await cropBox(`${src}/${refFile}`);
const ref = await stats(`${src}/${refFile}`, { left: refBox.left, top: refBox.top, width: refBox.width, height: refBox.height });

for (const f of files) {
  const key = f.slice(0, 2), slug = MAP[key];
  if (!slug) continue;
  const path = `${src}/${f}`;
  const { face, ...box } = await cropBox(path);
  const cur = await stats(path, box);
  // Partial match of per-channel mean/std to the reference (80%), so faces keep their own tone.
  const K = 0.8;
  const a = cur.map((c, i) => 1 + K * (ref[i].std / c.std - 1));
  const b = cur.map((c, i) => (c.mean + K * (ref[i].mean - c.mean)) - a[i] * c.mean);
  const grain = await sharp({ create: { width: OUT, height: OUT, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 9 } } }).png().toBuffer();
  await sharp(path)
    .extract(box)
    .resize(OUT, OUT, { kernel: "lanczos3" })
    .linear(a, b)
    .modulate({ saturation: 0.94 })
    .composite([{ input: grain, blend: "soft-light" }])
    .sharpen({ sigma: 0.8, m1: 0.6, m2: 0.4 })
    .jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toFile(`${out}/${slug}.jpg`);
  const size = fs.statSync(`${out}/${slug}.jpg`).size;
  console.log(slug.padEnd(9), `face (${face.x.toFixed(0)},${face.y.toFixed(0)})`, `crop ${box.left},${box.top}`, `gain ${a.map((v) => v.toFixed(2)).join("/")}`, `${(size / 1024).toFixed(0)}KB`);
}
