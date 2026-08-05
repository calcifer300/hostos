import { auth } from "@/auth";
import { HomeDashboard } from "@/components/dashboard/home-dashboard";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getLatestUnreadEmail } from "@/lib/gmail/queries";
import { DEFAULT_HOST_ID } from "@/lib/host/queries";
import { getRecentGuestMessages } from "@/lib/messages/queries";
import type { InboundTuroEmail } from "@/types/ihost";

export default async function Home() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const firstName = session?.user?.name?.split(" ")[0] ?? null;

  const [data, latestUnread, guestMessages] = await Promise.all([
    getDashboardData(email),
    email ? getLatestUnreadEmail(email) : Promise.resolve(null),
    getRecentGuestMessages(DEFAULT_HOST_ID),
  ]);

  const initialEmail: InboundTuroEmail | null = latestUnread
    ? {
        guestName: latestUnread.guestName || latestUnread.fromName || "This guest",
        vehicle: latestUnread.vehicle || "their vehicle",
        subject: latestUnread.subject || "",
        body: latestUnread.body || latestUnread.snippet || "",
        receivedAt: latestUnread.receivedAt,
      }
    : null;

  return (
    <HomeDashboard
      userFirstName={firstName}
      initialEmail={initialEmail}
      initialGuestMessages={guestMessages}
      data={data}
    />
  );
}
