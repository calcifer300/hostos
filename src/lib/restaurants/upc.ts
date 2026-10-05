/**
 * UPC-A generation and validation using the GS1 Modulo-10 check digit.
 *
 * Generated codes default to the "2" prefix — GS1's reserved range for
 * restricted (in-store / internal) circulation — so a code minted here can
 * never collide with a globally registered product barcode.
 *
 * A freshly generated code is correctly formatted; nothing can guarantee it
 * appears in a third-party barcode database, which is outside any
 * generator's control.
 */

const UPC_LENGTH = 12;
const DATA_DIGITS = 11;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function calculateCheckDigit(elevenDigits: string): number {
  const digits = digitsOnly(elevenDigits);
  if (digits.length !== DATA_DIGITS) throw new Error(`Expected ${DATA_DIGITS} digits, got ${digits.length}`);
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < DATA_DIGITS; i++) {
    const digit = Number(digits[i]);
    if ((i + 1) % 2 === 1) oddSum += digit;
    else evenSum += digit;
  }
  return (10 - ((oddSum * 3 + evenSum) % 10)) % 10;
}

export function generateUpc(prefix = "2"): string {
  const cleanPrefix = digitsOnly(prefix).slice(0, DATA_DIGITS);
  let data = cleanPrefix;
  while (data.length < DATA_DIGITS) data += Math.floor(Math.random() * 10).toString();
  return data + calculateCheckDigit(data);
}

export function generateUpcBatch(count: number, prefix = "2"): string[] {
  const seen = new Set<string>();
  const cap = Math.max(1, Math.min(count, 500));
  while (seen.size < cap) seen.add(generateUpc(prefix));
  return Array.from(seen);
}

/** cyrb53 — small, fast, well-distributed 53-bit string hash. Deterministic. */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Derives a UPC-A from a product name deterministically: the same name
 * (trimmed, case-insensitive) always yields the same code, so it can be
 * regenerated later and still match. Still a self-issued "2"-prefix code —
 * there is no way to derive a product's real GS1 barcode from its name.
 */
export function generateUpcFromName(name: string, prefix = "2"): string {
  const normalized = name.trim().toLowerCase();
  const cleanPrefix = digitsOnly(prefix).slice(0, DATA_DIGITS);
  const remaining = DATA_DIGITS - cleanPrefix.length;
  const hash = cyrb53(normalized).toString().padStart(remaining, "0");
  const data = cleanPrefix + hash.slice(-remaining);
  return data + calculateCheckDigit(data);
}

export interface UpcValidation {
  valid: boolean;
  reason?: string;
  expectedCheckDigit?: number;
}

export function validateUpc(value: string): UpcValidation {
  const digits = digitsOnly(value);
  if (digits.length !== UPC_LENGTH) {
    return { valid: false, reason: `UPC-A must be ${UPC_LENGTH} digits (got ${digits.length}).` };
  }
  const expected = calculateCheckDigit(digits.slice(0, DATA_DIGITS));
  const actual = Number(digits[UPC_LENGTH - 1]);
  if (expected !== actual) {
    return { valid: false, reason: `Check digit mismatch — expected ${expected}, found ${actual}.`, expectedCheckDigit: expected };
  }
  return { valid: true };
}

/** Standard UPC-A visual grouping: 1 - 5 - 5 - 1. */
export function formatUpc(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length !== UPC_LENGTH) return digits;
  return `${digits[0]} ${digits.slice(1, 6)} ${digits.slice(6, 11)} ${digits[11]}`;
}
