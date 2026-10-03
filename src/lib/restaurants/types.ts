/**
 * Domain types for restaurant operations. Ported from the DoorDash-edition
 * draft (where they were IndexedDB entities) and re-keyed to Supabase rows;
 * the comparison vocabulary is unchanged so the engine's tests still read.
 */

export type UploadSource = "pos" | "doordash";

export type RestaurantStatus = "open" | "closed" | "paused" | "deactivated" | "unknown";

export interface Restaurant {
  id: string;
  hostId: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  posSystem: string | null;
  doordashStoreId: string | null;
  address: string | null;
  timezone: string;
  status: RestaurantStatus;
  statusObservedAt: string | null;
  lowStockThreshold: number;
  priceTolerance: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Canonical fields every uploaded file's columns are mapped onto. */
export type CanonicalField = "sku" | "name" | "price" | "quantity" | "available" | "category";

export const CANONICAL_FIELD_LABELS: Record<CanonicalField, string> = {
  sku: "SKU / UPC / PLU",
  name: "Item name",
  price: "Price",
  quantity: "Quantity / stock",
  available: "Available / 86'd status",
  category: "Category",
};

export const CANONICAL_FIELDS = Object.keys(CANONICAL_FIELD_LABELS) as CanonicalField[];

export type ColumnMapping = Partial<Record<CanonicalField, string>>;

export interface MenuUpload {
  id: string;
  restaurantId: string;
  source: UploadSource;
  fileName: string;
  headers: string[];
  mapping: ColumnMapping;
  rows: Record<string, string>[];
  rowCount: number;
  uploadedBy: string | null;
  uploadedAt: string;
}

/** A lightweight view of an upload — everything but the rows. */
export type MenuUploadSummary = Omit<MenuUpload, "rows">;

export interface NormalizedItem {
  sku?: string;
  name: string;
  price?: number;
  quantity?: number;
  available?: boolean;
  category?: string;
  raw: Record<string, string>;
}

export type MatchMethod = "sku" | "name" | "fuzzy" | "manual";

export type ResultStatus = "needs-update" | "in-sync" | "missing-on-doordash" | "unmatched-on-doordash";

export interface MismatchDetail {
  field: "price" | "quantity" | "available";
  pos?: string;
  doordash?: string;
}

export interface ComparisonRow {
  key: string;
  status: ResultStatus;
  matchMethod?: MatchMethod;
  matchConfidence?: number;
  pos?: NormalizedItem;
  doordash?: NormalizedItem;
  mismatches: MismatchDetail[];
  lowStock?: boolean;
}

export interface ComparisonSummary {
  total: number;
  needsUpdate: number;
  inSync: number;
  missingOnDoordash: number;
  unmatchedOnDoordash: number;
  lowStock: number;
}

export interface Comparison {
  id: string;
  restaurantId: string;
  posUploadId: string | null;
  doordashUploadId: string | null;
  createdAt: string;
  createdBy: string | null;
  summary: ComparisonSummary;
  rows: ComparisonRow[];
}

export interface ItemLink {
  id: string;
  restaurantId: string;
  posKey: string;
  doordashKey: string;
  createdAt: string;
}

export type OrderStatus = "placed" | "confirmed" | "preparing" | "ready" | "picked_up" | "delivered" | "cancelled" | "unknown";

export interface RestaurantOrder {
  id: string;
  restaurantId: string;
  externalId: string;
  channel: string;
  status: OrderStatus;
  customerName: string | null;
  placedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  subtotal: number | null;
  total: number | null;
  tip: number | null;
  commission: number | null;
  itemCount: number | null;
  items: { name: string; quantity: number; price?: number }[];
  source: string;
}

export interface RestaurantMessage {
  id: string;
  restaurantId: string;
  channel: string;
  customerName: string | null;
  orderExternalId: string | null;
  body: string;
  fromStore: boolean;
  sentAt: string;
}

export interface StatusEvent {
  id: string;
  restaurantId: string;
  status: RestaurantStatus;
  source: string;
  detail: string | null;
  observedAt: string;
}

export interface InventoryItem {
  id: string;
  restaurantId: string;
  sku: string | null;
  name: string;
  category: string | null;
  price: number | null;
  quantity: number | null;
  available: boolean;
  lowStockThreshold: number | null;
  updatedAt: string;
}
