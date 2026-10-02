import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The 4-digit key for Matthew's page. No Google sign-in: he types the key once and the browser remembers it for 60 days.
 *
 * A 4-digit key is a convenience lock, not a vault: there are only 10,000 of them, so the protections around it matter:
 *  - the page is read-only and carries no payment details, only the fleet's trips, guests' first names and toll amounts
 *  - five wrong tries from one address lock that address out for 15 minutes, and every wrong try is slowed down
 *  - the key is compared in constant time and the remembered login is a signed, expiring cookie, not the key itself
 *  - the key can be changed any time with COCRUISERS_PIN in the project's environment; with no secret configured at all
 *    the page refuses everyone (it fails closed)
 */

export const ACCESS_COOKIE = "cc_access";
export const ACCESS_MAX_AGE_S = 60 * 60 * 24 * 60;
const DEFAULT_PIN = "0444";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

function secret(): string {
  return process.env.COCRUISERS_SECRET || process.env.AUTH_SECRET || "";
}

export function accessConfigured(): boolean {
  return secret().length > 0;
}

export function expectedPin(): string {
  const configured = (process.env.COCRUISERS_PIN ?? "").trim();
  return /^\d{4}$/.test(configured) ? configured : DEFAULT_PIN;
}

/** Constant-time comparison of what was typed with the key. */
export function checkPin(input: unknown): boolean {
  if (typeof input !== "string" || !/^\d{4}$/.test(input)) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expectedPin());
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update("cocruisers:v1:" + payload).digest("base64url");
}

/** A remembered login: the moment it expires and a signature over it. Changing the key invalidates every one. */
export function makeToken(now: number = Date.now()): string {
  const expires = String(now + ACCESS_MAX_AGE_S * 1000);
  return expires + "." + sign(expires + ":" + expectedPin());
}

export function verifyToken(token: string | undefined | null, now: number = Date.now()): boolean {
  if (!token || !accessConfigured()) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expires = token.slice(0, dot);
  const given = token.slice(dot + 1);
  if (!/^\d{10,15}$/.test(expires) || Number(expires) < now) return false;
  const want = sign(expires + ":" + expectedPin());
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- wrong tries, per address. In memory: it slows a guesser down on each server instance, which is what it is for.
const failures = new Map<string, { count: number; since: number }>();

export function lockedFor(address: string, now: number = Date.now()): number {
  const entry = failures.get(address);
  if (!entry) return 0;
  if (now - entry.since > WINDOW_MS) { failures.delete(address); return 0; }
  return entry.count >= MAX_FAILURES ? Math.ceil((entry.since + WINDOW_MS - now) / 1000) : 0;
}

export function recordFailure(address: string, now: number = Date.now()): number {
  const entry = failures.get(address);
  if (!entry || now - entry.since > WINDOW_MS) {
    failures.set(address, { count: 1, since: now });
    return MAX_FAILURES - 1;
  }
  entry.count += 1;
  return Math.max(0, MAX_FAILURES - entry.count);
}

export function clearFailures(address: string): void {
  failures.delete(address);
}
