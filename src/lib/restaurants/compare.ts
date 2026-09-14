import { FUZZY_MATCH_THRESHOLD, itemKey, normalizeName, normalizeSku, similarity } from "@/lib/restaurants/match";
import type {
  ColumnMapping,
  ComparisonRow,
  ComparisonSummary,
  ItemLink,
  MismatchDetail,
  NormalizedItem,
} from "@/lib/restaurants/types";

/**
 * The POS-vs-DoorDash comparison engine. Pure: takes two sets of parsed rows
 * with their column mappings and returns the bucketed result. Ported from the
 * draft unchanged in behaviour; the only additions are explicit types and a
 * summary that the restaurant list can render without loading rows.
 */

function parseNumber(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

const TRUE_WORDS = /^(1|true|yes|y|active|activated|available|in stock|enabled|instock|live)$/i;
const FALSE_WORDS =
  /^(0|false|no|n|inactive|deactivated|deactivate|paused|snoozed|unavailable|86|86'd|86d|out of stock|disabled|sold out|oos|hidden)$/i;

function parseAvailable(value: string | undefined): boolean | undefined {
  if (value == null || value === "") return undefined;
  const v = value.trim();
  if (TRUE_WORDS.test(v)) return true;
  if (FALSE_WORDS.test(v)) return false;
  return undefined;
}

export function normalizeUploadRows(rows: Record<string, string>[], mapping: ColumnMapping): NormalizedItem[] {
  const items: NormalizedItem[] = [];
  for (const row of rows) {
    const name = mapping.name ? row[mapping.name] : undefined;
    if (!name || !name.trim()) continue;

    const quantity = mapping.quantity ? parseNumber(row[mapping.quantity]) : undefined;
    let available = mapping.available ? parseAvailable(row[mapping.available]) : undefined;
    // A quantity with no explicit availability column implies it.
    if (available === undefined && quantity !== undefined) available = quantity > 0;

    items.push({
      sku: mapping.sku ? row[mapping.sku]?.trim() || undefined : undefined,
      name: name.trim(),
      price: mapping.price ? parseNumber(row[mapping.price]) : undefined,
      quantity,
      available,
      category: mapping.category ? row[mapping.category]?.trim() || undefined : undefined,
      raw: row,
    });
  }
  return items;
}

interface Pool {
  item: NormalizedItem;
  used: boolean;
}

function buildMismatches(pos: NormalizedItem, dd: NormalizedItem, priceTolerance: number): MismatchDetail[] {
  const mismatches: MismatchDetail[] = [];

  if (pos.price !== undefined && dd.price !== undefined && Math.abs(pos.price - dd.price) > priceTolerance) {
    mismatches.push({ field: "price", pos: pos.price.toFixed(2), doordash: dd.price.toFixed(2) });
  }
  if (pos.quantity !== undefined && dd.quantity !== undefined && pos.quantity !== dd.quantity) {
    mismatches.push({ field: "quantity", pos: String(pos.quantity), doordash: String(dd.quantity) });
  }
  if (pos.available !== undefined && dd.available !== undefined && pos.available !== dd.available) {
    mismatches.push({
      field: "available",
      pos: pos.available ? "In stock" : "86'd",
      doordash: dd.available ? "Active" : "86'd",
    });
  }
  return mismatches;
}

export interface CompareOptions {
  priceTolerance?: number;
  lowStockThreshold?: number;
  manualLinks?: Pick<ItemLink, "posKey" | "doordashKey">[];
}

export interface CompareResult {
  summary: ComparisonSummary;
  rows: ComparisonRow[];
}

export function compareInventories(
  posRows: Record<string, string>[],
  posMapping: ColumnMapping,
  ddRows: Record<string, string>[],
  ddMapping: ColumnMapping,
  options: CompareOptions = {}
): CompareResult {
  const priceTolerance = options.priceTolerance ?? 0.01;
  const lowStockThreshold = options.lowStockThreshold ?? 5;
  const manualLinks = options.manualLinks ?? [];

  const posPool: Pool[] = normalizeUploadRows(posRows, posMapping).map((item) => ({ item, used: false }));
  const ddPool: Pool[] = normalizeUploadRows(ddRows, ddMapping).map((item) => ({ item, used: false }));

  const rows: ComparisonRow[] = [];

  const matchPair = (posEntry: Pool, ddEntry: Pool, method: ComparisonRow["matchMethod"], confidence?: number) => {
    posEntry.used = true;
    ddEntry.used = true;
    const mismatches = buildMismatches(posEntry.item, ddEntry.item, priceTolerance);
    rows.push({
      key: `${itemKey(posEntry.item)}::${itemKey(ddEntry.item)}`,
      status: mismatches.length > 0 ? "needs-update" : "in-sync",
      matchMethod: method,
      matchConfidence: confidence,
      pos: posEntry.item,
      doordash: ddEntry.item,
      mismatches,
      lowStock: posEntry.item.quantity !== undefined && posEntry.item.quantity <= lowStockThreshold,
    });
  };

  // 1. Manual links first — explicit operator overrides.
  for (const link of manualLinks) {
    const posEntry = posPool.find(
      (p) => !p.used && (normalizeSku(p.item.sku) === link.posKey || normalizeName(p.item.name) === link.posKey)
    );
    const ddEntry = ddPool.find(
      (d) => !d.used && (normalizeSku(d.item.sku) === link.doordashKey || normalizeName(d.item.name) === link.doordashKey)
    );
    if (posEntry && ddEntry) matchPair(posEntry, ddEntry, "manual");
  }

  // 2. Exact SKU.
  const ddBySku = new Map<string, Pool>();
  for (const entry of ddPool) {
    const sku = normalizeSku(entry.item.sku);
    if (sku && !entry.used) ddBySku.set(sku, entry);
  }
  for (const posEntry of posPool) {
    if (posEntry.used) continue;
    const sku = normalizeSku(posEntry.item.sku);
    if (!sku) continue;
    const ddEntry = ddBySku.get(sku);
    if (ddEntry && !ddEntry.used) matchPair(posEntry, ddEntry, "sku", 1);
  }

  // 3. Exact normalised name.
  const ddByName = new Map<string, Pool>();
  for (const entry of ddPool) {
    if (entry.used) continue;
    const name = normalizeName(entry.item.name);
    if (name && !ddByName.has(name)) ddByName.set(name, entry);
  }
  for (const posEntry of posPool) {
    if (posEntry.used) continue;
    const ddEntry = ddByName.get(normalizeName(posEntry.item.name));
    if (ddEntry && !ddEntry.used) matchPair(posEntry, ddEntry, "name", 1);
  }

  // 4. Fuzzy — score every remaining pair, assign best-first so one great
  // match isn't stolen by an earlier mediocre one.
  const remainingPos = posPool.filter((p) => !p.used);
  const remainingDd = ddPool.filter((d) => !d.used);
  const candidates: { pos: Pool; dd: Pool; score: number }[] = [];
  for (const posEntry of remainingPos) {
    const posName = normalizeName(posEntry.item.name);
    for (const ddEntry of remainingDd) {
      const score = similarity(posName, normalizeName(ddEntry.item.name));
      if (score >= FUZZY_MATCH_THRESHOLD) candidates.push({ pos: posEntry, dd: ddEntry, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (c.pos.used || c.dd.used) continue;
    matchPair(c.pos, c.dd, "fuzzy", c.score);
  }

  // 5. Leftovers.
  for (const posEntry of posPool) {
    if (posEntry.used) continue;
    rows.push({
      key: itemKey(posEntry.item),
      status: "missing-on-doordash",
      pos: posEntry.item,
      mismatches: [],
      lowStock: posEntry.item.quantity !== undefined && posEntry.item.quantity <= lowStockThreshold,
    });
  }
  for (const ddEntry of ddPool) {
    if (ddEntry.used) continue;
    rows.push({ key: itemKey(ddEntry.item), status: "unmatched-on-doordash", doordash: ddEntry.item, mismatches: [] });
  }

  const summary: ComparisonSummary = {
    total: rows.length,
    needsUpdate: rows.filter((r) => r.status === "needs-update").length,
    inSync: rows.filter((r) => r.status === "in-sync").length,
    missingOnDoordash: rows.filter((r) => r.status === "missing-on-doordash").length,
    unmatchedOnDoordash: rows.filter((r) => r.status === "unmatched-on-doordash").length,
    lowStock: rows.filter((r) => r.lowStock).length,
  };

  const statusOrder: Record<ComparisonRow["status"], number> = {
    "needs-update": 0,
    "missing-on-doordash": 1,
    "unmatched-on-doordash": 2,
    "in-sync": 3,
  };
  rows.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  return { summary, rows };
}

/** Rows shrink for storage: raw source rows are kept on the upload, not repeated per comparison. */
export function stripRawRows(rows: ComparisonRow[]): ComparisonRow[] {
  const slim = (item?: NormalizedItem) => (item ? { ...item, raw: {} } : undefined);
  return rows.map((r) => ({ ...r, pos: slim(r.pos), doordash: slim(r.doordash) }));
}
