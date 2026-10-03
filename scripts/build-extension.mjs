/**
 * Packages extension/ into public/hostos-companion.zip.
 *
 * The Companion is the only real data source HostOS has, so "how do I get the
 * extension" is the first question every new fleet has, and the app had no
 * answer: no download, no instructions, no packaged build anywhere in the
 * repo.
 *
 * Runs as part of `npm run build`, so the zip a deployment serves is always
 * built from the extension source in the same commit. Publishing a stale
 * hand-made zip is how you end up debugging a version of the extension that
 * no longer exists.
 *
 * WRITES THE ARCHIVE ITSELF rather than shelling out to `zip` or
 * Compress-Archive. Those are the obvious approach and neither is portable:
 * Compress-Archive is Windows-only, `zip` is not installed on every Linux
 * build image, and this has to produce an identical file on a Windows laptop
 * and on Vercel's build container. Node ships DEFLATE in zlib, and the ZIP
 * container around it is a well-specified ~80 lines, so there is nothing to
 * depend on.
 */

import { deflateRawSync } from "node:zlib";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "extension");
const outFile = join(root, "public", "hostos-companion.zip");

// ---------------------------------------------------------------- crc32

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

// ----------------------------------------------------------------- files

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/**
 * ZIP paths are always forward-slashed and always relative to the archive
 * root. Chrome's "Load unpacked" wants a directory containing manifest.json,
 * so nesting everything one level deeper — the classic zip-the-folder mistake
 * — produces "Manifest file is missing or unreadable" on install.
 */
function archiveName(file) {
  return relative(source, file).split(sep).join("/");
}

const files = walk(source).sort((a, b) => archiveName(a).localeCompare(archiveName(b)));

if (!files.some((f) => archiveName(f) === "manifest.json")) {
  console.error(`[extension] No manifest.json at the root of ${source} — refusing to package.`);
  process.exit(1);
}

// ------------------------------------------------------------- the archive

const localParts = [];
const centralParts = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(archiveName(file), "utf8");
  const contents = readFileSync(file);
  const crc = crc32(contents);

  // Store the file uncompressed when DEFLATE makes it bigger, which happens
  // with the already-compressed PNGs. Method 0 vs 8 is per-entry in ZIP.
  const deflated = deflateRawSync(contents, { level: 9 });
  const useDeflate = deflated.length < contents.length;
  const body = useDeflate ? deflated : contents;
  const method = useDeflate ? 8 : 0;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); // local file header signature
  local.writeUInt16LE(20, 4); // version needed (2.0 — deflate)
  local.writeUInt16LE(0x0800, 6); // flags: filenames are UTF-8
  local.writeUInt16LE(method, 8);
  // Zero the DOS timestamp rather than writing the file's mtime: the zip is
  // rebuilt on every deploy, and a moving timestamp makes two byte-identical
  // extensions produce two different downloads.
  local.writeUInt16LE(0, 10); // mod time
  local.writeUInt16LE(0x0021, 12); // mod date — 1980-01-01, the format's epoch
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(body.length, 18); // compressed size
  local.writeUInt32LE(contents.length, 22); // uncompressed size
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28); // extra field length

  localParts.push(local, name, body);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); // central directory header signature
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(0x0021, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(body.length, 20);
  central.writeUInt32LE(contents.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30); // extra
  central.writeUInt16LE(0, 32); // comment
  central.writeUInt16LE(0, 34); // disk number
  central.writeUInt16LE(0, 36); // internal attrs
  central.writeUInt32LE(0o644 << 16, 38); // external attrs — regular file, rw-r--r--
  central.writeUInt32LE(offset, 42); // offset of the local header
  centralParts.push(central, name);

  offset += local.length + name.length + body.length;
}

const centralDirectory = Buffer.concat(centralParts);

const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
end.writeUInt16LE(0, 4); // this disk
end.writeUInt16LE(0, 6); // disk with the central directory
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralDirectory.length, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20); // comment length

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, Buffer.concat([...localParts, centralDirectory, end]));

const kb = Math.round(statSync(outFile).size / 1024);
console.log(
  `[extension] Packaged HostOS Companion -> public/hostos-companion.zip (${files.length} files, ${kb} KB)`
);
