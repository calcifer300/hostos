import { TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import type { OccupancyPoint } from "@/lib/dashboard/queries";

const CHART_WIDTH = 240;
const CHART_HEIGHT = 64;

/**
 * % of the fleet with a synced trip window covering each day, over the
 * last 7 days — see computeOccupancyTrend in lib/dashboard/queries.ts.
 * Real, computed from actual reservation windows; under-reports rather
 * than guessing wherever Companion hasn't resolved a real start/end time.
 */
export function OccupancyRateCard({ trend }: { trend: OccupancyPoint[] }) {
  const today = trend.at(-1);
  const yesterday = trend.at(-2);
  const delta = today && yesterday ? today.rate - yesterday.rate : null;

  const points = trend.map((p, i) => {
    const x = trend.length > 1 ? (i / (trend.length - 1)) * CHART_WIDTH : 0;
    const y = CHART_HEIGHT - (p.rate / 100) * CHART_HEIGHT;
    return `${x},${y}`;
  });

  const areaPath =
    points.length > 0
      ? `M0,${CHART_HEIGHT} L${points.join(" L")} L${CHART_WIDTH},${CHART_HEIGHT} Z`
      : "";
  const linePath = points.length > 0 ? `M${points.join(" L")}` : "";

  return (
    <DashboardCard icon={TrendingUp} title="Occupancy rate" className="h-full">
      {trend.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Not enough synced trip data yet.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold leading-none tracking-tight">{today?.rate ?? 0}%</span>
            {delta !== null && delta !== 0 && (
              <span className={delta > 0 ? "text-[12.5px] font-medium text-success" : "text-[12.5px] font-medium text-danger"}>
                {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-muted-foreground">of fleet booked, vs yesterday</p>

          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="mt-4 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="occupancy-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#occupancy-fill)" />
            <path d={linePath} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="mt-1.5 flex justify-between text-[10.5px] text-muted-foreground/70">
            {trend.map((p) => (
              <span key={p.label}>{p.label}</span>
            ))}
          </div>
        </>
      )}
    </DashboardCard>
  );
}
