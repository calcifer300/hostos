import { BadgeDollarSign, CircleCheck, HelpCircle, ShieldAlert, Wallet } from "lucide-react";
import { getCurrentFleet, getCurrentHostId } from "@/lib/host/context";
import { getRiskQueues, type QueueTrip } from "@/lib/risk/queries";
import { QueueCard } from "@/components/risk/queue-card";

/**
 * The three operator queues, ported from the CC extension's popup into HostOS
 * so they live beside the data they are computed from.
 *
 * Names match what the host already uses: Unverified Licenses, Profit Risk and
 * Earnings Estimator.
 */

export const metadata = { title: "Risk & earnings" };

function Section({
  icon: Icon,
  title,
  description,
  count,
  empty,
  children,
}: {
  icon: typeof ShieldAlert;
  title: string;
  description: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {count > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </div>
      </div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>

      {count === 0 ? (
        <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-5 py-4 text-[13px] text-muted-foreground shadow-[var(--shadow-card)]">
          <CircleCheck className="h-4 w-4 shrink-0 text-success" strokeWidth={1.75} aria-hidden />
          {empty}
        </div>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

export default async function RiskPage() {
  const hostId = await getCurrentHostId();
  const fleet = await getCurrentFleet();
  const timezone = fleet?.timezone ?? "America/Denver";

  const queues = await getRiskQueues(hostId, timezone);

  const dayTotal = queues.returningToday.reduce((sum, t) => sum + (t.earnings?.earnings ?? 0), 0);
  const anyFloor = queues.returningToday.some((t) => t.earnings && !t.earnings.inputsKnown);
  const pricedToday = queues.returningToday.filter((t) => t.earnings !== null).length;

  const card = (trip: QueueTrip, variant: "license" | "risk" | "earnings") => (
    <QueueCard key={`${variant}-${trip.id}`} trip={trip} variant={variant} timezone={timezone} />
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Risk &amp; earnings</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          The two rules this fleet runs on — verify a license before pickup, and catch a trip worth
          cancelling before it starts.
        </p>
      </div>

      {queues.pricingUnavailable && (
        // Three confident empty queues would read as "nothing needs attention",
        // which is a very different claim from "we couldn't compute this".
        <div className="mb-8 rounded-xl border border-warning/25 bg-warning-bg px-4 py-3">
          <p className="text-[13px] font-semibold">Risk data isn&rsquo;t available yet</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Run <code className="font-mono">supabase/migrations/0010_earnings_and_risk.sql</code>, then
            let the Companion&rsquo;s enrichment loop run. These queues stay empty until it has priced
            some trips — that&rsquo;s not the same as nothing needing attention.
          </p>
        </div>
      )}

      <Section
        icon={ShieldAlert}
        title="Unverified licenses"
        description="Guests can't upload a license until 24 hours before pickup, so only trips inside that window are listed — flagging earlier is a false alarm."
        count={queues.licenses.length}
        empty="Every guest picking up in the next 24 hours has a verified license."
      >
        {queues.licenses.map((t) => card(t, "license"))}
      </Section>

      <Section
        icon={BadgeDollarSign}
        title="Profit risk"
        description="Trips earning under $0.20 per included mile, or where the guest holds a $0-liability plan so damage can't be billed to them. Only trips that haven't started — once a trip is under way, cancelling isn't an option."
        count={queues.profitRisk.length}
        empty="No upcoming trip is below the line or on a zero-liability plan."
      >
        {queues.profitRisk.map((t) => card(t, "risk"))}
      </Section>

      {queues.undecided.length > 0 && (
        <Section
          icon={HelpCircle}
          title="Below the line, but undecided"
          description="These compute under $0.20/mile, but an input Turo hasn't given us yet could still lift them over. Listed rather than asserted — and rather than dropped, so an empty Profit Risk queue is never mistaken for a clean one."
          count={queues.undecided.length}
          empty=""
        >
          {queues.undecided.map((t) => card(t, "risk"))}
        </Section>
      )}

      <Section
        icon={Wallet}
        title="Earnings estimator"
        description="What each trip coming back today is worth. An estimate, and gross of nothing — this is the host's share after Turo's cut, rebuilt from the calendar's nightly rates because Turo shows a co-host no payout figure at all."
        count={queues.returningToday.length}
        empty="Nothing is due back today."
      >
        {queues.returningToday.length > 0 && (
          <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted-foreground">Coming back today</span>
              {pricedToday === 0 ? (
                // NOT "$0.00". Nothing here has been priced yet, and a total of
                // zero asserts these trips are worth nothing — the same
                // unknown-spent-as-a-zero mistake that makes a healthy trip
                // read as thin. Say what is actually true instead.
                <span className="text-[13px] text-muted-foreground">not priced yet</span>
              ) : (
                <span className="text-[18px] font-semibold tabular-nums text-success">
                  ${dayTotal.toFixed(2)}
                </span>
              )}
            </div>

            {pricedToday === 0 ? (
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {queues.returningToday.length}{" "}
                {queues.returningToday.length === 1 ? "trip is" : "trips are"} due back, but the
                Companion hasn&rsquo;t read a nightly rate or take rate for{" "}
                {queues.returningToday.length === 1 ? "it" : "them"} yet.
              </p>
            ) : (
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                {pricedToday} of {queues.returningToday.length} priced
                {anyFloor
                  ? " · a floor — at least one trip has an input we couldn't read, so the real total is higher"
                  : ""}
              </p>
            )}
          </div>
        )}
        {queues.returningToday.map((t) => card(t, "earnings"))}
      </Section>
    </div>
  );
}
