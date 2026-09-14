import { itemKey, normalizeName, normalizeSku, similarity, FUZZY_MATCH_THRESHOLD } from "../src/lib/restaurants/match.ts";
import { compareInventories, normalizeUploadRows } from "../src/lib/restaurants/compare.ts";
import { calculateCheckDigit, formatUpc, generateUpc, generateUpcBatch, generateUpcFromName, validateUpc } from "../src/lib/restaurants/upc.ts";

let fail = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(` ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`}`);
};
const ok = (label: string, cond: boolean) => eq(label, cond, true);

console.log("\n=== matching ===");
eq("SKU normalises to upper alphanumerics", normalizeSku(" ab-12.3 "), "AB123");
eq("name normalises punctuation and case", normalizeName("Coca-Cola  (20oz)!"), "coca cola 20oz");
eq("item key prefers SKU", itemKey({ sku: "x-1", name: "Anything" }), "X1");
eq("item key falls back to name", itemKey({ sku: "", name: "Iced Matcha Latte" }), "iced matcha latte");
eq("identical names score 1", similarity("falafel wrap", "falafel wrap"), 1);
ok("variant suffix still clears the threshold", similarity("bic lighter", "bic lighter classic") >= FUZZY_MATCH_THRESHOLD);
ok("unrelated names stay below the threshold", similarity("chicken shawarma bowl", "wool beanie charcoal") < FUZZY_MATCH_THRESHOLD);

console.log("\n=== normalizeUploadRows ===");
const pos = normalizeUploadRows(
  [
    { SKU: "A1", Item: "Chicken Shawarma Bowl", Price: "$13.50", Qty: "12", Active: "yes" },
    { SKU: "", Item: "Iced Matcha Latte", Price: "5.25", Qty: "2", Active: "86'd" },
    { SKU: "", Item: "", Price: "1", Qty: "1", Active: "yes" },
  ],
  { sku: "SKU", name: "Item", price: "Price", quantity: "Qty", available: "Active" }
);
eq("blank names drop", pos.length, 2);
eq("prices parse through currency symbols", pos[0].price, 13.5);
eq("availability words parse", [pos[0].available, pos[1].available], [true, false]);

console.log("\n=== compareInventories ===");
const result = compareInventories(
  [
    { SKU: "A1", Item: "Chicken Shawarma Bowl", Price: "13.50", Qty: "12", Active: "yes" },
    { SKU: "", Item: "Iced Matcha Latte", Price: "5.25", Qty: "2", Active: "yes" },
    { SKU: "", Item: "Halloumi Fries", Price: "8.00", Qty: "20", Active: "yes" },
    { SKU: "", Item: "Falafel Wrap", Price: "10.50", Qty: "30", Active: "yes" },
  ],
  { sku: "SKU", name: "Item", price: "Price", quantity: "Qty", available: "Active" },
  [
    { Code: "A1", Name: "Shawarma Bowl (Chicken)", Price: "12.00", Status: "active" },
    { Code: "", Name: "Iced Matcha Latte", Price: "5.25", Status: "86'd" },
    { Code: "", Name: "Falafel Wrap", Price: "10.50", Status: "active" },
    { Code: "", Name: "Mystery Special", Price: "9.00", Status: "active" },
  ],
  { sku: "Code", name: "Name", price: "Price", available: "Status" },
  { priceTolerance: 0.01, lowStockThreshold: 5 }
);
const byName = (name: string) => result.rows.find((r) => r.pos?.name === name || r.doordash?.name === name);
eq("SKU match wins even when names differ", byName("Chicken Shawarma Bowl")?.matchMethod, "sku");
eq("price drift is a needs-update", byName("Chicken Shawarma Bowl")?.status, "needs-update");
eq("86'd on DoorDash while in stock on POS is a needs-update", byName("Iced Matcha Latte")?.status, "needs-update");
eq("low stock flagged from POS quantity", byName("Iced Matcha Latte")?.lowStock, true);
eq("identical rows are in sync", byName("Falafel Wrap")?.status, "in-sync");
eq("POS-only item is missing on DoorDash", byName("Halloumi Fries")?.status, "missing-on-doordash");
eq("DoorDash-only item is unmatched", byName("Mystery Special")?.status, "unmatched-on-doordash");
eq("summary counts add up", result.summary, { total: 5, needsUpdate: 2, inSync: 1, missingOnDoordash: 1, unmatchedOnDoordash: 1, lowStock: 1 });

const linked = compareInventories(
  [{ SKU: "", Item: "Halloumi Fries", Price: "8.00" }],
  { sku: "SKU", name: "Item", price: "Price" },
  [{ Code: "", Name: "Mystery Special", Price: "8.00" }],
  { sku: "Code", name: "Name", price: "Price" },
  { manualLinks: [{ posKey: "halloumi fries", doordashKey: "mystery special" }] }
);
eq("a manual link pairs otherwise unrelated rows", [linked.rows[0]?.matchMethod, linked.rows[0]?.status], ["manual", "in-sync"]);

console.log("\n=== UPC-A ===");
eq("GS1 check digit of a known code (036000291452)", calculateCheckDigit("03600029145"), 2);
eq("valid UPC validates", validateUpc("036000291452"), { valid: true });
eq("bad check digit is caught", validateUpc("036000291453").valid, false);
eq("wrong length is caught", validateUpc("12345").valid, false);
const generated = generateUpc();
eq("generated codes are 12 digits starting with the restricted prefix", [generated.length, generated[0]], [12, "2"]);
eq("generated codes validate", validateUpc(generated).valid, true);
eq("batch is unique and capped", new Set(generateUpcBatch(25)).size, 25);
eq("name-derived codes are deterministic", generateUpcFromName("Iced Matcha Latte"), generateUpcFromName("  iced matcha LATTE "));
eq("name-derived codes validate", validateUpc(generateUpcFromName("Halloumi Fries")).valid, true);
eq("formatting groups 1-5-5-1", formatUpc("036000291452"), "0 36000 29145 2");

if (fail > 0) process.exitCode = 1;
