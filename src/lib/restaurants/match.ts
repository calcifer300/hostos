/**
 * String normalisation and similarity for matching menu items across a POS
 * export and a DoorDash export when SKUs don't line up. Pure functions —
 * shared by the server (comparisons are stored) and the browser (previews).
 */

export function normalizeSku(value: string | undefined | null): string {
  if (!value) return "";
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normalizeName(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dice coefficient over character bigrams — cheap, dependency-free, and good
 * enough for short product names ("Coca Cola 20oz" vs "Coke 20 oz Bottle").
 */
function bigramDice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = (s: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const gram = s.slice(i, i + 2);
      map.set(gram, (map.get(gram) ?? 0) + 1);
    }
    return map;
  };

  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const [gram, countA] of ba) {
    const countB = bb.get(gram);
    if (countB) intersection += Math.min(countA, countB);
  }
  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

/**
 * One export often truncates or appends a variant suffix to a name
 * ("Bic Lighter" vs "Bic Lighter Classic"). A plain bigram score penalises
 * that too harshly, so a clean substring match gets a confidence floor.
 */
export function similarity(a: string, b: string): number {
  const dice = bigramDice(a, b);
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 4 && longer.includes(shorter)) return Math.max(dice, 0.85);
  return dice;
}

export const FUZZY_MATCH_THRESHOLD = 0.6;

/** The identity a row is matched and linked on: SKU when present, else the normalised name. */
export function itemKey(item: { sku?: string | null; name: string }): string {
  return normalizeSku(item.sku) || normalizeName(item.name);
}
