import { Bell, CalendarCheck, DollarSign, MessageSquare, ShieldCheck, Star, XCircle, LogIn, LogOut, Mail } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { cleanSubject, getDashboardData } from "@/lib/dashboard/queries";
import { formatRelativeTime } from "@/lib/utils";
import { ConnectGoogleNotice } from "@/components/shell/connect-google-notice";
import type { TuroEventKind } from "@/types/turo";

const kindMeta: Record<TuroEventKind, { icon: LucideIcon; label: string }> = {
  booking: { icon: CalendarCheck, label: "Booking" },
  pickup: { icon: LogOut, label: "Pickup" },
  return: { icon: LogIn, label: "Return" },
  message: { icon: MessageSquare, label: "Message" },
  cancellation: { icon: XCircle, label: "Cancellation" },
  review: { icon: Star, label: "Review" },
  payment: { icon: DollarSign, label: "Payment" },
  verification: { icon: ShieldCheck, label: "Verification" },
  other: { icon: Mail, label: "Notification" },
};

export default async function NotificationsPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            Everything iHost has seen in your synced Gmail, newest first.
          </p>
        </div>
        <ConnectGoogleNotice
          icon={Bell}
          title="Connect Google to see notifications"
          description="Notifications are built from your synced Gmail activity. Connect a Google account to start syncing."
        />
      </div>
    );
  }

  const { events } = await getDashboardData(email);
  const sorted = [...events].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Everything iHost has seen in your synced Gmail, newest first.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-start rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Bell className="h-[17px] w-[17px] text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h2 className="mb-2 text-[16px] font-semibold tracking-tight">Nothing to show yet</h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Sync your Gmail from the Inbox and activity will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          {sorted.map((event, i) => {
            const meta = kindMeta[event.kind];
            const Icon = meta.icon;
            return (
              <div
                key={event.id}
                className={
                  "flex items-start gap-3 px-5 py-4" +
                  (i > 0 ? " border-t border-border" : "")
                }
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {event.isUnread && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    )}
                    <p className="truncate text-[13.5px] font-medium">
                      {cleanSubject(event.subject) || "(no subject)"}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                    {[meta.label, event.guestName, event.vehicle].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
                  {formatRelativeTime(event.occurredAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
