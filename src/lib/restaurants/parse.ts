import Papa from "papaparse";
import * as XLSX from "xlsx";
import { CANONICAL_FIELDS, type CanonicalField, type ColumnMapping } from "@/lib/restaurants/types";

/**
 * File parsing for menu and order exports. Browser-side: the file never
 * leaves the operator's machine until they've confirmed the column mapping,
 * and the server only ever receives already-parsed rows.
 */

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

/** Uploads are capped so a 40 MB "export everything" file can't wedge a request. */
export const MAX_ROWS = 20_000;

function normalizeRows(rows: Record<string, unknown>[]): ParsedFile {
  const headerSet = new Set<string>();
  const cleaned = rows.slice(0, MAX_ROWS).map((row) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;
      headerSet.add(cleanKey);
      out[cleanKey] = value == null ? "" : String(value).trim();
    }
    return out;
  });
  return { headers: Array.from(headerSet), rows: cleaned };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";

  if (isCsv) {
    const text = await file.text();
    const result = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
    return normalizeRows(result.data);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  return normalizeRows(json);
}

/**
 * Guesses which uploaded column maps to which canonical field, from headers
 * commonly seen in NRS / Square / Clover / Toast POS exports and DoorDash
 * Merchant Portal menu exports. Exact header wins over substring.
 */
const FIELD_HINTS: Record<CanonicalField, string[]> = {
  sku: ["sku", "upc", "plu", "item id", "item #", "item number", "barcode", "product id", "merchant supplied id", "external id"],
  name: ["name", "item name", "product name", "description", "title", "menu item", "item"],
  price: ["price", "unit price", "retail price", "sale price", "base price", "cost"],
  quantity: ["qty", "quantity", "stock", "on hand", "in stock", "inventory", "count", "quantity available"],
  available: ["availability", "available", "status", "86", "active", "enabled", "is available", "visibility", "is active", "sold out"],
  category: ["category", "dept", "department", "menu category", "group", "menu", "section"],
};

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();

  for (const field of CANONICAL_FIELDS) {
    let best: string | undefined;
    let bestScore = 0;
    for (const header of headers) {
      if (used.has(header)) continue;
      const h = header.toLowerCase().trim();
      for (const hint of FIELD_HINTS[field]) {
        let score = 0;
        if (h === hint) score = 3;
        else if (h.includes(hint)) score = 2;
        if (score > bestScore) {
          bestScore = score;
          best = header;
        }
      }
    }
    if (best) {
      mapping[field] = best;
      used.add(best);
    }
  }
  return mapping;
}

/* ------------------------------------------------------------------ orders */

export interface ParsedOrder {
  externalId: string;
  status: string;
  customerName: string | null;
  placedAt: string | null;
  deliveredAt: string | null;
  subtotal: number | null;
  total: number | null;
  tip: number | null;
  commission: number | null;
  itemCount: number | null;
  items: { name: string; quantity: number }[];
  raw: Record<string, string>;
}

const ORDER_HINTS = {
  id: ["order id", "order #", "order number", "id", "external id", "delivery id"],
  status: ["status", "order status", "state"],
  customer: ["customer", "customer name", "consumer", "guest"],
  placedAt: ["placed", "created", "order time", "time placed", "date", "timestamp", "order date"],
  deliveredAt: ["delivered", "delivered at", "completed", "fulfilled"],
  subtotal: ["subtotal", "sub total", "food total", "items subtotal"],
  total: ["total", "order total", "gross", "amount"],
  tip: ["tip", "tips", "dasher tip"],
  commission: ["commission", "fees", "doordash fee", "marketplace fee"],
  items: ["items", "line items", "item names", "products"],
  itemCount: ["item count", "number of items", "qty", "quantity"],
} as const;

function pick(headers: string[], hints: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const header of headers) {
    const h = header.toLowerCase().trim();
    for (const hint of hints) {
      const score = h === hint ? 3 : h.includes(hint) ? 2 : 0;
      if (score > bestScore) {
        bestScore = score;
        best = header;
      }
    }
  }
  return best;
}

function money(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isoDate(value: string | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Turns a DoorDash order export (or anything shaped like one) into orders.
 * Column detection is heuristic, so the result is previewed before import.
 */
export function parseOrders(parsed: ParsedFile): { orders: ParsedOrder[]; columns: Record<string, string | undefined> } {
  const cols = {
    id: pick(parsed.headers, ORDER_HINTS.id),
    status: pick(parsed.headers, ORDER_HINTS.status),
    customer: pick(parsed.headers, ORDER_HINTS.customer),
    placedAt: pick(parsed.headers, ORDER_HINTS.placedAt),
    deliveredAt: pick(parsed.headers, ORDER_HINTS.deliveredAt),
    subtotal: pick(parsed.headers, ORDER_HINTS.subtotal),
    total: pick(parsed.headers, ORDER_HINTS.total),
    tip: pick(parsed.headers, ORDER_HINTS.tip),
    commission: pick(parsed.headers, ORDER_HINTS.commission),
    items: pick(parsed.headers, ORDER_HINTS.items),
    itemCount: pick(parsed.headers, ORDER_HINTS.itemCount),
  };

  const orders: ParsedOrder[] = [];
  parsed.rows.forEach((row, i) => {
    const externalId = (cols.id ? row[cols.id] : "")?.trim() || `row-${i + 1}`;
    const itemsRaw = cols.items ? row[cols.items] : "";
    const items = itemsRaw
      ? itemsRaw
          .split(/[;,|]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => {
            const m = s.match(/^(\d+)\s*[x×]\s*(.+)$/i);
            return m ? { name: m[2].trim(), quantity: Number(m[1]) } : { name: s, quantity: 1 };
          })
      : [];
    const itemCountRaw = cols.itemCount ? money(row[cols.itemCount]) : null;

    orders.push({
      externalId,
      status: (cols.status ? row[cols.status] : "")?.trim().toLowerCase() || "unknown",
      customerName: (cols.customer ? row[cols.customer] : "")?.trim() || null,
      placedAt: isoDate(cols.placedAt ? row[cols.placedAt] : undefined),
      deliveredAt: isoDate(cols.deliveredAt ? row[cols.deliveredAt] : undefined),
      subtotal: money(cols.subtotal ? row[cols.subtotal] : undefined),
      total: money(cols.total ? row[cols.total] : undefined),
      tip: money(cols.tip ? row[cols.tip] : undefined),
      commission: money(cols.commission ? row[cols.commission] : undefined),
      itemCount: itemCountRaw ?? (items.length ? items.reduce((n, it) => n + it.quantity, 0) : null),
      items,
      raw: row,
    });
  });

  return { orders, columns: cols };
}

const STATUS_WORDS: [RegExp, string][] = [
  [/cancel|void|refund/i, "cancelled"],
  [/deliver|complete|fulfil/i, "delivered"],
  [/pick/i, "picked_up"],
  [/ready/i, "ready"],
  [/prep|cook|progress/i, "preparing"],
  [/confirm|accept/i, "confirmed"],
  [/place|new|receiv|pending/i, "placed"],
];

/** Maps whatever a platform calls a status onto the app's vocabulary. */
export function normalizeOrderStatus(raw: string): string {
  for (const [re, status] of STATUS_WORDS) if (re.test(raw)) return status;
  return "unknown";
}
