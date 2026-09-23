import type { Metadata } from "next";
import { auth } from "@/auth";
import { getCurrentHostId } from "@/lib/host/context";
import { getNotifications } from "@/lib/notifications/queries";
import { NotificationList } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await auth();
  const hostId = await getCurrentHostId();
  const notifications = await getNotifications(hostId, session?.user?.email ?? null, 200);
  return <NotificationList notifications={notifications} />;
}
