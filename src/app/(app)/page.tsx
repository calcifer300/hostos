import { auth } from "@/auth";
import { HomeDashboard } from "@/components/dashboard/home-dashboard";
import { getLatestUnreadEmail } from "@/lib/gmail/queries";
import type { InboundTuroEmail } from "@/types/ihost";

export default async function Home() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const firstName = session?.user?.name?.split(" ")[0] ?? null;

  const latestUnread = email ? await getLatestUnreadEmail(email) : null;

  const initialEmail: InboundTuroEmail | null = latestUnread
    ? {
        guestName: latestUnread.guestName || latestUnread.fromName || "This guest",
        vehicle: latestUnread.vehicle || "their vehicle",
        subject: latestUnread.subject || "",
        body: latestUnread.body || latestUnread.snippet || "",
        receivedAt: latestUnread.receivedAt,
      }
    : null;

  return <HomeDashboard userFirstName={firstName} initialEmail={initialEmail} />;
}
