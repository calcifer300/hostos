import { Info, ListChecks, LogIn, LogOut } from "lucide-react";
import { auth } from "@/auth";
import { getDashboardData } from "@/lib/dashboard/queries";
import { ScheduleCard } from "@/components/dashboard/schedule-card";
import { MessagesCard } from "@/components/dashboard/messages-card";
import { ConnectGoogleNotice } from "@/components/shell/connect-google-notice";

export default async function OperationsPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  const data = await getDashboardData(email);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Operations</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Today&rsquo;s work, grouped by what actually needs doing.
        </p>
      </div>

      {!data.hasSyncedData ? (
        <ConnectGoogleNotice
          icon={ListChecks}
          title="Nothing synced yet"
          description="Pickups and returns come from the HostOS Companion extension; guest messages come from Gmail. Connect either — or both — from Connectors to fill this in."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ScheduleCard
              icon={LogOut}
              title="Today's pickups"
              entries={data.pickups}
              notReadyLabel="Needs prep"
              emptyMessage="No pickups dated today in your synced data."
            />
            <ScheduleCard
              icon={LogIn}
              title="Today's returns"
              entries={data.returns}
              notReadyLabel="Inspect first"
              emptyMessage="No returns dated today in your synced data."
            />
            <MessagesCard messages={data.messages} />
          </div>

          <div className="mt-6 flex gap-3 rounded-2xl border border-dashed border-border p-5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <div>
              <p className="text-[12.5px] font-medium text-muted-foreground">
                Cleaning, fuel, and driver-license checks
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground/80">
                Companion syncs trip times, guests, and vehicles — it doesn&rsquo;t send fuel levels,
                license status, or cleaning checklists yet. That needs a future extension update, not
                just a connection.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
