/**
 * Loads Karl's Turo-Context-Library into the turo_articles table.
 *
 * The knowledge base HostOS already had holds the host's own house rules —
 * their check-in process, their tone. What it never had is Turo's actual
 * published policy, so a drafted reply could be perfectly on-brand and still
 * tell a guest something Turo's own help centre contradicts. This is the 725
 * articles that fix that.
 *
 *   node scripts/import-turo-articles.mjs [path/to/articles.json]
 *
 * Idempotent: rows are upserted on the article id, and an article whose
 * content_hash already matches is skipped, so a re-run after Karl re-scrapes
 * only writes what actually changed.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const DEFAULT_SOURCE = resolve(
  projectRoot,
  "..",
  "vendor",
  "Turo-Context-Library",
  "data",
  "articles.json"
);

/**
 * Longest article body we store.
 *
 * One article — Turo's airport-and-delivery-locations page — is 593 KB, more
 * than the other 724 combined. It is a directory of every airport Turo
 * operates at, and past the first page of it there is nothing a reply would
 * ever need to cite. Storing it whole bloats the table and, worse, hands the
 * full-text index one document so large it skews ranking against everything
 * else.
 */
const MAX_CONTENT = 40_000;

const BATCH = 40;

function readEnv() {
  const path = join(projectRoot, ".env.local");
  if (!existsSync(path)) {
    console.error(`[import] No .env.local at ${path}.`);
    process.exit(1);
  }

  const env = Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[import] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set.");
    process.exit(1);
  }
  return { url, key };
}

/** Collapses the scraper's stray whitespace so excerpts read as prose. */
function tidy(text) {
  return (text ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function main() {
  const sourcePath = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SOURCE;

  if (!existsSync(sourcePath)) {
    console.error(
      `[import] No article index at ${sourcePath}.\n` +
        `         Pass the path to Turo-Context-Library/data/articles.json as an argument.`
    );
    process.exit(1);
  }

  const { url, key } = readEnv();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  console.log(`[import] Reading ${sourcePath}`);
  const raw = JSON.parse(readFileSync(sourcePath, "utf8"));
  const articles = Array.isArray(raw) ? raw : (raw.articles ?? []);
  console.log(`[import] ${articles.length} articles in the index.`);

  // What's already stored, so an unchanged article costs nothing to re-run.
  const existing = new Map();
  let from = 0;
  for (;;) {
    const res = await fetch(`${url}/rest/v1/turo_articles?select=id,content_hash`, {
      headers: { ...headers, Range: `${from}-${from + 999}` },
    });

    if (res.status === 404 || res.status === 400) {
      console.error(
        "[import] turo_articles doesn't exist yet — apply " +
          "supabase/migrations/0014_board_and_library.sql first."
      );
      process.exit(1);
    }
    if (!res.ok) {
      console.error(`[import] Couldn't read existing rows: ${res.status} ${await res.text()}`);
      process.exit(1);
    }

    const page = await res.json();
    for (const row of page) existing.set(row.id, row.content_hash);
    if (page.length < 1000) break;
    from += 1000;
  }
  console.log(`[import] ${existing.size} already stored.`);

  const rows = [];
  let skipped = 0;
  let truncated = 0;

  for (const a of articles) {
    const id = a.id ?? a.slug;
    if (!id || !a.title) continue;

    if (existing.has(id) && a.content_hash && existing.get(id) === a.content_hash) {
      skipped++;
      continue;
    }

    let content = tidy(a.content ?? a.body ?? "");
    if (content.length > MAX_CONTENT) {
      content = `${content.slice(0, MAX_CONTENT)}\n\n[Truncated — read the rest on Turo's help centre: ${a.url}]`;
      truncated++;
    }

    rows.push({
      id,
      title: a.title,
      url: a.url ?? "",
      category: a.category ?? null,
      excerpt: tidy(a.excerpt ?? "").slice(0, 600) || null,
      content,
      content_hash: a.content_hash ?? null,
      last_updated: a.last_updated ?? null,
    });
  }

  console.log(
    `[import] ${rows.length} to write, ${skipped} unchanged` +
      (truncated ? `, ${truncated} truncated at ${MAX_CONTENT / 1000}k` : "") +
      "."
  );

  if (rows.length === 0) {
    console.log("[import] Nothing to do.");
    return;
  }

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch(`${url}/rest/v1/turo_articles?on_conflict=id`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      console.error(`[import] Batch at ${i} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
      process.exit(1);
    }

    written += batch.length;
    process.stdout.write(`\r[import] ${written}/${rows.length}`);
  }

  console.log(`\n[import] Done. ${written} articles written.`);
}

main().catch((err) => {
  console.error(`[import] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
