import Link from "next/link";
import { AlertTriangle, ExternalLink, ShieldAlert, Star } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";
import type { QueueTrip } from "@/lib/risk/queries";

/**
 * One trip in an operator queue.
 *
 * A labelled grid, not stacked prose — the CC build learned this the hard way:
 * six prose lines read as a paragraph and you had to read the whole card to
 * find one figure.
 *
 * Money is picked out in colour at the SAME font size as its surroundings:
 * green in the earnings list (what the fleet is making), red on a risk card
 * (what needs a decision). The two never mix — a red figure means "act", and
 * using it for a healthy number would erode that instantly.
 */

const LICENSE_REMINDER =
  "Hi! Just a quick reminder to upload your driver's licence in the Turo app before pickup — " +
  "we can't release the keys until it's verified. It only takes a minute in the Trip Details " +
  "section. Thanks!";

function Money({ value, tone }: { value: number; tone: "green" | "red" }) {
  return (
    <b className={tone === "green" ? "font-semibold text-success" : "font-semibold text-danger"}>
      ${value.toFixed(2)}
    </b>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </>
  );
}

function when(iso: string | null, timezone: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/**
 * How much runway is left. The Premier play is contact the guest, cancel, swap
 * the plan, have them rebook — so "how long do I have" decides whether it is
 * attemptable at all, and a failed rebook close to pickup means an empty car.
 * That makes this the first thing the card should say, not a detail.
 */
function runway(hours: number | null): { label: string; urgent: boolean } | null {
  if (hours === null) return null;
  if (hours < 0) return { label: "Already started", urgent: false };
  if (hours < 1) return { label: "Under an hour to pickup", urgent: true };
  if (hours < 24) return { label: `${Math.round(hours)}h to pickup`, urgent: true };
  const days = Math.round(hours / 24);
  return { label: `${days} day${days === 1 ? "" : "s"} to pickup`, urgent: days <= 2 };
}

/**
 * The sequence the host actually runs, in his words. The card used to say
 * "cancel before pickup", which is step 3 of 5 — on its own that is just lost
 * revenue. The value is in the swap and rebook.
 */
const PREMIER_PLAY = [
  "Message the guest and check they're at their phone or computer",
  "Cancel the trip",
  "Switch your protection plan to the $250 tier",
  "Have them rebook — both plans now match",
];

export function QueueCard({
  trip,
  variant,
  timezone,
}: {
  trip: QueueTrip;
  variant: "license" | "risk" | "earnings";
  timezone: string;
}) {
  const tone = variant === "earnings" ? "green" : "red";
  const left = runway(trip.hoursUntilPickup);
  const e = trip.earnings;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold tracking-tight">
            {trip.guestName} &middot; {trip.vehicle}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {variant === "earnings"
              ? `Returns ${when(trip.endsAt, timezone)}`
              : `Picks up ${when(trip.startsAt, timezone)}`}
            {trip.plate ? ` · ${trip.plate}` : ""}
          </p>
          {left && variant !== "earnings" && (
            <p className={cn("mt-1 text-[12px] font-medium", left.urgent ? "text-danger" : "text-muted-foreground")}>
              {left.label}
            </p>
          )}
        </div>

        {variant === "license" && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning">
            <ShieldAlert className="h-3 w-3" aria-hidden />
            {trip.licenseStatusText || "Awaiting licence"}
          </span>
        )}
      </div>

      {trip.risk.riskReasons.length > 0 && variant !== "earnings" && (
        <ul className="mt-3 space-y-1.5">
          {trip.risk.riskReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-danger">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {(e || trip.guestTripCount !== null) && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[12.5px]">
          {e && (
            <>
              <Row label={trip.risk.earningsRisk || variant === "earnings" ? "You earn" : "Estimated"}>
                <Money value={e.earnings} tone={tone} />
              </Row>
              {e.perMile !== null && (
                <Row label="Per included mile">
                  <Money value={e.perMile} tone={tone} />
                </Row>
              )}
              {trip.includedMiles !== null && (
                <Row label="Miles included">{trip.includedMiles.toLocaleString()}</Row>
              )}
            </>
          )}

          {/* Turo's OVERAGE rate — what a guest pays beyond the allowance.
              Shown because it is useful context, never because it triggers
              anything: an earlier build flagged on it and reported a healthy
              $0.35/mile trip as a risk because its overage was $0.19. */}
          {trip.pricePerMile !== null && (
            <Row label="Overage rate">
              <span className="text-muted-foreground">${trip.pricePerMile.toFixed(2)}/mi</span>
            </Row>
          )}

          {/* The mismatch the swap-and-rebook exists to close. Rendered only
              when the host's own figure was actually read — it needs the
              rendered detail page, so it is absent on most trips, and a guess
              here would be worse than a missing row. */}
          {trip.hostDamageResponsibility !== null && (
            <Row label="Your deductible">
              <span className="text-muted-foreground">
                ${trip.hostDamageResponsibility.toFixed(2)}
                {trip.risk.premierProtection ? " vs guest’s $0" : ""}
              </span>
            </Row>
          )}

          {trip.guestTripCount !== null && (
            <Row label="Guest">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 text-muted-foreground" aria-hidden />
                {trip.guestRating === null
                  ? "no ratings yet"
                  : `${trip.guestRating.toFixed(1)} · ${trip.guestRatingCount ?? 0}`}
                {` · ${trip.guestTripCount} ${trip.guestTripCount === 1 ? "trip" : "trips"}`}
              </span>
            </Row>
          )}
        </dl>
      )}

      {!e && variant === "earnings" && (
        // Explicitly "not priced", never an implied $0 — the Companion has not
        // read a nightly rate or take rate for this trip yet.
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          Not priced yet — no nightly rate or take rate read from Turo for this trip.
        </p>
      )}

      {trip.risk.premierProtection && variant !== "earnings" && (
        <ol className="mt-3 space-y-1 rounded-xl border border-border bg-muted/40 px-4 py-3 text-[12.5px] leading-relaxed">
          {PREMIER_PLAY.map((step, i) => (
            <li key={step} className="flex gap-2">
              <span className="shrink-0 tabular-nums text-muted-foreground">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}

      {e && !e.inputsKnown && (
        // Every figure above is a FLOOR when an input was never read. Saying so
        // is the difference between a number the host can act on and one that
        // burns their trust in the whole queue.
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          A floor, not a total — {e.unknownInputs.join(" and ")} not read from Turo, so the real trip
          can only be worth more.
        </p>
      )}

      {trip.earningsProjected && (
        <p className="mt-1 text-[11.5px] text-muted-foreground">
          Nightly rate projected past the end of the calendar window.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={`https://turo.com/us/en/reservation/${encodeURIComponent(trip.id)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-muted"
        >
          Open trip
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>

        <Link
          href={`/messages/${encodeURIComponent(trip.id)}`}
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-muted"
        >
          Messages
        </Link>

        {trip.guestDriverId && (
          // A low rating is a prompt to go read the reviews — "if low can go
          // in and see if they have a history of smoking in cars". Without
          // this the rating had nowhere to go.
          <Link
            href={`https://turo.com/us/en/drivers/${encodeURIComponent(trip.guestDriverId)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-muted"
          >
            Guest reviews
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        )}

        {variant === "license" && (
          <CopyButton
            value={LICENSE_REMINDER}
            label="Copy reminder"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-[12.5px] font-medium transition-colors hover:bg-muted"
          />
        )}
      </div>
    </div>
  );
}
