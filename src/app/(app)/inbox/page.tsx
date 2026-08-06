import { Inbox as InboxIcon } from "lucide-react";
import { auth } from "@/auth";
import { getSyncedEmails } from "@/lib/gmail/queries";
import { SyncGmailButton } from "@/components/inbox/sync-gmail-button";
import { InboxList } from "@/components/inbox/inbox-list";
import { ConnectGoogleNotice } from "@/components/shell/connect-google-notice";

export default async function InboxPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Every message iHost has synced from your connected Gmail account.
          </p>
        </div>
        <ConnectGoogleNotice
          icon={InboxIcon}
          title="Connect Google to see your inbox"
          description="The Inbox is built from your synced Gmail messages. Connect a Google account to start syncing."
        />
      </div>
    );
  }

  const messages = await getSyncedEmails(email);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Every message iHost has synced from your connected Gmail account.
          </p>
        </div>
        <SyncGmailButton />
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-start rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
          <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <InboxIcon className="h-[17px] w-[17px] text-muted-foreground" strokeWidth={1.75} />
          </div>
          <h2 className="mb-2 text-[16px] font-semibold tracking-tight">No messages synced yet</h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Click &ldquo;Sync Gmail&rdquo; above to pull in your most recent guest messages.
          </p>
        </div>
      ) : (
        <InboxList messages={messages} />
      )}
    </div>
  );
}
