import { getCurrentHostId } from "@/lib/host/context";
import { getGuestConversations } from "@/lib/messages/queries";
import { MessagesListClient } from "@/components/messages/messages-list-client";
import { ModuleOff } from "@/components/dashboard/module-off";
import { verticalAccess } from "@/lib/host/context";

/**
 * Every reservation thread the Companion extension has synced, raw —
 * guest messages and host/co-host replies exactly as scraped, not
 * summarized. The Overview dashboard's Guest Messages card only ever shows
 * the latest message per conversation; this is the full list, and each row
 * opens the complete back-and-forth at /messages/[tripId]. Sorted by real
 * last-message time (see getGuestConversations), live-polled client-side
 * so a new guest message moves its thread to the top automatically.
 */
export default async function MessagesPage() {
  // Belongs to the fleet vertical: nothing here renders — or queries — unless this person may open it.
  const access = await verticalAccess("fleet");
  if (access !== "ok") return <ModuleOff module="fleet" reason={access} />;

  const conversations = await getGuestConversations(await getCurrentHostId(), 200);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Every guest conversation synced through the HostOS Companion, raw and unfiltered.
        </p>
      </div>

      <MessagesListClient initialConversations={conversations} />
    </div>
  );
}
