import Link from "next/link";
import { Car, Star } from "lucide-react";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard/queries";
import { ConnectGoogleNotice } from "@/components/shell/connect-google-notice";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { VehicleStatus } from "@/lib/dashboard/queries";

const statusMeta: Record<VehicleStatus, { label: string; dot: string; text: string }> = {
  on_trip: { label: "On trip", dot: "bg-accent", text: "text-accent" },
  available: { label: "Available", dot: "bg-success", text: "text-success" },
  cleaning: { label: "Turnaround", dot: "bg-warning", text: "text-warning" },
  maintenance: { label: "Maintenance", dot: "bg-danger", text: "text-danger" },
};

export default async function FleetPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  const { vehicles } = await getDashboardData(email);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Fleet</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Every vehicle, as its own workspace. Click one for trips and activity.
        </p>
      </div>

      {vehicles.length === 0 ? (
        <ConnectGoogleNotice
          icon={Car}
          title="No vehicles identified yet"
          description="Pair the HostOS Companion extension from Connectors for full vehicle records, or connect Google — vehicles appear here as soon as either source names one."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const status = statusMeta[v.status];
            return (
              <Link
                key={v.id}
                href={`/fleet/${encodeURIComponent(v.name)}`}
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold tracking-tight">{v.name}</p>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
                    <span className={cn("text-[11px] font-medium", status.text)}>{status.label}</span>
                  </div>
                </div>
                {v.nextEventLabel ? (
                  <p className="mt-3 text-[12.5px] font-medium text-accent">{v.nextEventLabel}</p>
                ) : (
                  <p className="mt-3 flex items-center gap-1 text-[12.5px] text-muted-foreground">
                    <Star className="h-3 w-3" />
                    {v.tripCount} {v.tripCount === 1 ? "reservation" : "reservations"}
                  </p>
                )}
                {v.lastActivity && (
                  <p className="mt-1 text-[11.5px] text-muted-foreground/70">
                    Last activity {formatRelativeTime(v.lastActivity)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
