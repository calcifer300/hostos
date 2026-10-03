import Papa from "papaparse";
import type { Comparison, ComparisonRow, RestaurantOrder } from "@/lib/restaurants/types";

/**
 * CSV builders for the restaurant module. Browser-safe (no server imports);
 * the download itself happens in the component via a Blob URL.
 */

const availability = (v: boolean | undefined, yes: string, no: string) => (v === undefined ? "" : v ? yes : no);

/**
 * "What needs to change on DoorDash": every row needing an update plus every
 * item missing from DoorDash, using the POS (source of truth) values.
 */
export function buildActionListCsv(comparison: Pick<Comparison, "rows">): string {
  const rows = comparison.rows
    .filter((r) => r.status === "needs-update" || r.status === "missing-on-doordash")
    .map((r) => {
      const item = r.pos!;
      return {
        Action: r.status === "missing-on-doordash" ? "ADD TO DOORDASH" : "UPDATE ON DOORDASH",
        SKU: item.sku ?? "",
        Name: item.name,
        "POS Price": item.price !== undefined ? item.price.toFixed(2) : "",
        "DoorDash Price": r.doordash?.price !== undefined ? r.doordash.price.toFixed(2) : "",
        "POS Quantity": item.quantity ?? "",
        "DoorDash Quantity": r.doordash?.quantity ?? "",
        "POS Availability": availability(item.available, "In stock", "86'd"),
        "DoorDash Availability": availability(r.doordash?.available, "Active", "86'd"),
        "What changed": r.mismatches.map((m) => m.field).join(", "),
        Category: item.category ?? "",
      };
    });
  return Papa.unparse(rows, { header: true });
}

export function buildFullComparisonCsv(comparison: Pick<Comparison, "rows">): string {
  const rows = comparison.rows.map((r: ComparisonRow) => {
    const item = r.pos ?? r.doordash!;
    return {
      Status: r.status,
      "Match Method": r.matchMethod ?? "",
      Confidence: r.matchConfidence !== undefined ? Math.round(r.matchConfidence * 100) + "%" : "",
      SKU: item.sku ?? "",
      Name: item.name,
      "POS Price": r.pos?.price !== undefined ? r.pos.price.toFixed(2) : "",
      "DoorDash Price": r.doordash?.price !== undefined ? r.doordash.price.toFixed(2) : "",
      "POS Quantity": r.pos?.quantity ?? "",
      "DoorDash Quantity": r.doordash?.quantity ?? "",
      "POS Availability": availability(r.pos?.available, "In stock", "86'd"),
      "DoorDash Availability": availability(r.doordash?.available, "Active", "86'd"),
      "Low Stock": r.lowStock ? "Yes" : "",
    };
  });
  return Papa.unparse(rows, { header: true });
}

export function buildOrdersCsv(orders: RestaurantOrder[]): string {
  const rows = orders.map((o) => ({
    "Order ID": o.externalId,
    Channel: o.channel,
    Status: o.status,
    Customer: o.customerName ?? "",
    Placed: o.placedAt ?? "",
    Delivered: o.deliveredAt ?? "",
    Subtotal: o.subtotal ?? "",
    Total: o.total ?? "",
    Tip: o.tip ?? "",
    Commission: o.commission ?? "",
    Items: o.items.map((i) => `${i.quantity}x ${i.name}`).join("; "),
  }));
  return Papa.unparse(rows, { header: true });
}

export function downloadCsv(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
