import type { SyncedEmail } from "@/types/gmail";
import type { TuroEvent, TuroEventKind, TuroReservation } from "@/types/turo";

/**
 * Turns synced Gmail messages into normalized Turo events.
 *
 * Turo's email templates are not a published contract and change without
 * notice, so every rule here is a heuristic. The parser is written to fail
 * quietly: an unrecognized email becomes `kind: "other"` with null fields
 * rather than a wrong guess, and the dashboard renders what it has.
 */

interface KindRule {
  kind: TuroEventKind;
  patterns: RegExp[];
}

/** Order matters — the first match wins, so specific rules precede general ones. */
const KIND_RULES: KindRule[] = [
  {
    kind: "cancellation",
    patterns: [/\bcancell?ed\b/i, /\bcancellation\b/i, /\btrip was cancell?ed\b/i],
  },
  {
    kind: "review",
    // Anchored to Turo's review phrasings. A bare /review/ matched unrelated
    // mail ("review your account", "security review") and mislabelled it.
    patterns: [
      /\bleft (you )?an? .{0,12}review\b/i,
      /\brated your\b/i,
      /\bstar review\b/i,
      /\breview (for )?your trip\b/i,
      /\breviewed your\b/i,
    ],
  },
  {
    kind: "payment",
    patterns: [/\bpayout\b/i, /\byou've been paid\b/i, /\byou have been paid\b/i, /\bearnings\b/i, /\breimbursement\b/i, /\binvoice\b/i],
  },
  {
    kind: "verification",
    patterns: [/\bverif(y|ied|ication)\b/i, /\bdriver'?s? licen[cs]e\b/i, /\bid check\b/i],
  },
  {
    kind: "return",
    patterns: [/\btrip (has )?ended\b/i, /\btrip complete[d]?\b/i, /\breturned?\b/i, /\bcheck[- ]?out\b/i, /\bdrop[- ]?off\b/i],
  },
  {
    kind: "pickup",
    patterns: [/\btrip (starts|begins|is starting)\b/i, /\bcheck[- ]?in\b/i, /\bpick[- ]?up\b/i, /\byour trip with\b/i],
  },
  {
    kind: "booking",
    patterns: [/\bbooked\b/i, /\bnew (trip|booking|reservation)\b/i, /\breservation confirmed\b/i, /\btrip confirmed\b/i, /\bbooking confirmed\b/i],
  },
  {
    kind: "message",
    patterns: [/\bnew message\b/i, /\bsent you a message\b/i, /\bmessage from\b/i, /\breplied\b/i],
  },
];

function classify(subject: string, body: string): TuroEventKind {
  // Subjects are far more reliable than bodies, which quote prior messages
  // and footers that trip every rule at once.
  for (const rule of KIND_RULES) {
    if (rule.patterns.some((p) => p.test(subject))) return rule.kind;
  }
  for (const rule of KIND_RULES) {
    if (rule.patterns.some((p) => p.test(body))) return rule.kind;
  }
  return "other";
}

const GUEST_PATTERNS: RegExp[] = [
  /\bnew message from\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?)/,
  /\byour trip with\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?)/,
  // "Daniel has sent you a message about your Nissan Pathfinder"
  /\b([A-Z][\w'-]*)\s+(?:has\s+)?(?:sent|left|requested|booked|cancell?ed|returned)\b/,
  /\b([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?)\s+booked your\b/,
  /\btrip with\s+([A-Z][\w'-]*(?:\s+[A-Z][\w'-]*)?)/,
];

/** Senders that are the platform, not a guest — never use these as a name. */
const NON_GUEST_SENDER = /^(turo|google|gmail|no-?reply|notification|support|team|billing)\b/i;

/**
 * The subject is checked first: Sprint 3 stored the Gmail From name, which
 * for Turo notifications is "Turo" — the real guest is named in the subject.
 *
 * `allowStoredName` gates the fallback to the sender name. It's only passed
 * when the email is demonstrably about one of the host's vehicles; without
 * that guard every unrelated sender (Pinterest, Vercel, GitHub) would be
 * labelled a guest.
 */
function extractGuest(
  subject: string,
  storedName: string | null,
  allowStoredName: boolean
): string | null {
  for (const pattern of GUEST_PATTERNS) {
    const match = subject.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && !NON_GUEST_SENDER.test(candidate)) return candidate;
  }
  if (allowStoredName && storedName && !NON_GUEST_SENDER.test(storedName)) return storedName;
  return null;
}

const VEHICLE_PATTERNS: RegExp[] = [
  /\b(?:your|the)\s+((?:[A-Z][\w-]*|\d{2,4})(?:\s+(?:[A-Z][\w-]*|\d{2,4})){1,3})\b/,
  /\bbooked your\s+((?:[A-Z][\w-]*)(?:\s+(?:[A-Z0-9][\w-]*)){0,3})/,
];

/** Words that look like vehicles to the regex but never are. */
const VEHICLE_STOPWORDS = /^(trip|reservation|booking|account|profile|listing|host|guest|payout|earnings|review|message)/i;

function extractVehicle(subject: string, storedVehicle: string | null): string | null {
  if (storedVehicle) return storedVehicle;
  for (const pattern of VEHICLE_PATTERNS) {
    const match = subject.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && !VEHICLE_STOPWORDS.test(candidate)) return candidate;
  }
  return null;
}

/**
 * Turo states trip boundaries in two shapes: a numeric one in the booking
 * footer ("Trip start 8/3/26 10:00 AM") and a prose one in notification
 * bodies ("starts Aug 3 at 10:00 AM"). Both are parsed; neither is assumed.
 */
const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const CLOCK = String.raw`\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?`;
const NUMERIC_DATE = String.raw`\d{1,2}\/\d{1,2}\/\d{2,4}`;

function anchoredPatterns(anchor: string): RegExp[] {
  return [
    new RegExp(`${anchor}[^\\n]{0,30}?(${NUMERIC_DATE})(?:[^\\n]{0,12}?(${CLOCK}))?`, "i"),
    new RegExp(
      `${anchor}[^\\n]{0,40}?((?:${MONTHS})[a-z]*\\s+\\d{1,2}(?:,\\s*\\d{4})?)(?:[^\\n]{0,20}?(${CLOCK}))?`,
      "i"
    ),
  ];
}

const START_ANCHOR = String.raw`(?:trip\s+start|starts|begins|pick[-\s]?up|check[-\s]?in)`;
const END_ANCHOR = String.raw`(?:trip\s+end|ends|returns?|drop[-\s]?off|check[-\s]?out)`;

/** Builds a Date from the captured parts, resolving 2-digit years explicitly. */
function buildDate(datePart: string, timePart: string | undefined, receivedAt: string): Date | null {
  let iso: string;

  const numeric = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (numeric) {
    const [, m, d, y] = numeric;
    // Turo writes US month/day order; a 2-digit year is this century.
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    iso = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  } else {
    const withYear = /\d{4}/.test(datePart)
      ? datePart
      : `${datePart} ${new Date(receivedAt).getFullYear()}`;
    const parsed = new Date(withYear);
    if (Number.isNaN(parsed.getTime())) return null;
    iso = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
      parsed.getDate()
    ).padStart(2, "0")}`;
  }

  const combined = timePart ? `${iso} ${timePart.trim()}` : iso;
  const result = new Date(combined);
  return Number.isNaN(result.getTime()) ? null : result;
}

function extractBoundary(body: string, anchor: string, receivedAt: string): string | null {
  for (const pattern of anchoredPatterns(anchor)) {
    const match = body.match(pattern);
    if (!match?.[1]) continue;
    const date = buildDate(match[1].trim(), match[2], receivedAt);
    if (date) return date.toISOString();
  }
  return null;
}

export function parseEmail(email: SyncedEmail): TuroEvent {
  const subject = email.subject ?? "";
  const body = (email.body || email.snippet || "").slice(0, 4000);
  const vehicle = extractVehicle(subject, email.vehicle);

  return {
    id: email.id,
    kind: classify(subject, body),
    // Prefer the subject-derived name over the stored one, which is the
    // Gmail From name and is usually the platform rather than the guest.
    guestName: extractGuest(subject, email.guestName ?? email.fromName, Boolean(vehicle)),
    vehicle,
    subject: email.subject,
    snippet: email.snippet,
    occurredAt: email.receivedAt,
    tripStartsAt: extractBoundary(body, START_ANCHOR, email.receivedAt),
    tripEndsAt: extractBoundary(body, END_ANCHOR, email.receivedAt),
    isUnread: email.isUnread,
  };
}

export function parseEmails(emails: SyncedEmail[]): TuroEvent[] {
  return emails.map(parseEmail);
}

const RESERVATION_KINDS = new Set<TuroEventKind>([
  "booking",
  "pickup",
  "return",
  "cancellation",
]);

/**
 * Groups trip-related events into reservations. Guest + vehicle is the
 * grouping key because Turo threads don't reliably span a whole trip.
 */
export function buildReservations(events: TuroEvent[]): TuroReservation[] {
  const groups = new Map<string, TuroEvent[]>();

  for (const event of events) {
    // Guest messages carry the booking footer ("Trip start …"), so an event
    // with parsed trip dates counts even when it isn't a trip email itself.
    const isTripRelated = RESERVATION_KINDS.has(event.kind) || Boolean(event.tripStartsAt);
    if (!isTripRelated) continue;
    if (!event.guestName && !event.vehicle) continue;
    const key = `${event.guestName ?? "unknown"}::${event.vehicle ?? "unknown"}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }

  const reservations: TuroReservation[] = [];

  for (const bucket of groups.values()) {
    const sorted = [...bucket].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );

    const find = (kind: TuroEventKind) => sorted.find((e) => e.kind === kind) ?? null;
    const booking = find("booking");
    const cancelled = find("cancellation");
    const returned = find("return");

    // Trip boundaries come from whichever email stated them most recently.
    const startsAt = sorted.find((e) => e.tripStartsAt)?.tripStartsAt ?? null;
    const endsAt = sorted.find((e) => e.tripEndsAt)?.tripEndsAt ?? null;

    const now = Date.now();
    let status: TuroReservation["status"];
    if (cancelled) status = "cancelled";
    else if (returned || (endsAt && new Date(endsAt).getTime() < now)) status = "completed";
    else if (startsAt && new Date(startsAt).getTime() <= now) status = "active";
    else status = "upcoming";

    reservations.push({
      id: sorted[0].id,
      guestName: sorted[0].guestName,
      vehicle: sorted[0].vehicle,
      status,
      bookedAt: booking?.occurredAt ?? null,
      startsAt,
      endsAt,
      events: sorted,
    });
  }

  return reservations.sort((a, b) => {
    const at = new Date(a.startsAt ?? a.bookedAt ?? 0).getTime();
    const bt = new Date(b.startsAt ?? b.bookedAt ?? 0).getTime();
    return bt - at;
  });
}

/**
 * Turo subjects for a managed fleet lead with an ownership marker —
 * "(MATTHEW's vehicle) - Daniel has sent you a message" — identifying whose
 * car the email concerns. An inbox that's been used across multiple host
 * relationships (e.g. a VA who previously managed a different client's
 * fleet) can still have that earlier client's emails sitting in it; this
 * keeps only events plainly marked as the current host's.
 *
 * Emails with no ownership marker at all (payments, reviews, generic
 * notifications) are kept rather than risk dropping legitimate data just
 * because it wasn't tagged.
 */
export function filterToHost(events: TuroEvent[], hostName: string | null | undefined): TuroEvent[] {
  const needle = hostName?.trim().toLowerCase();
  if (!needle) return events;

  return events.filter((event) => {
    const match = (event.subject ?? "").match(/^\(([^)]*)\)/);
    if (!match) return true;
    return match[1].toLowerCase().includes(needle);
  });
}
