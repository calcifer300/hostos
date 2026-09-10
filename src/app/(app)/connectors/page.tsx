import Link from "next/link";
import { Calendar, Mail, MessageSquare, Phone, type LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { getHost } from "@/lib/host/queries";
import { canEditCurrentFleet, getCurrentHostId } from "@/lib/host/context";
import { CompanionSetup } from "@/components/settings/companion-setup";
import { Badge } from "@/components/ui/badge";

function ConnectorRow({
  icon: Icon,
  name,
  status,
  action,
}: {
  icon: LucideIcon;
  name: string;
  status: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-[16px] w-[16px] text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[13.5px] font-medium">{name}</p>
          <div className="mt-0.5">{status}</div>
        </div>
      </div>
      {action}
    </div>
  );
}

export default async function ConnectorsPage() {
  const session = await auth();
  // Explicitly this request's fleet. getHost() with no argument resolves
  // DEFAULT_HOST_ID, which showed every visitor the seeded fleet's pairing
  // state — see the note on regenerateCompanionApiKey for what that allowed.
  const host = await getHost(await getCurrentHostId());
  const canManage = await canEditCurrentFleet();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Connectors</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Everything HostOS syncs from, modular and optional.
        </p>
      </div>

      {/* The Companion comes first because it is not one connector among
          several — it is the only source that fills the dashboard. Gmail is
          supplementary and everything under it is unbuilt, so leading with
          that list buried the one thing a new fleet has to do. */}
      <h2 className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Your data source
      </h2>
      <CompanionSetup hasKey={Boolean(host?.companionApiKey)} canManage={canManage} />

      <h2 className="mb-2 mt-8 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Optional integrations
      </h2>
      <div className="space-y-3">
        <ConnectorRow
          icon={Mail}
          name="Google Gmail"
          status={
            session?.user?.email ? (
              <p className="truncate text-[12px] text-muted-foreground">{session.user.email}</p>
            ) : (
              <p className="text-[12px] text-muted-foreground">Not connected</p>
            )
          }
          action={
            session?.user ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                Connect
              </Link>
            )
          }
        />

        <ConnectorRow
          icon={Calendar}
          name="Google Calendar"
          status={<p className="text-[12px] text-muted-foreground">Not built yet</p>}
          action={<Badge variant="neutral">Coming soon</Badge>}
        />

        <ConnectorRow
          icon={MessageSquare}
          name="Slack"
          status={<p className="text-[12px] text-muted-foreground">Not built yet</p>}
          action={<Badge variant="neutral">Coming soon</Badge>}
        />

        <ConnectorRow
          icon={Phone}
          name="SMS (Twilio)"
          status={<p className="text-[12px] text-muted-foreground">Not built yet</p>}
          action={<Badge variant="neutral">Coming soon</Badge>}
        />
      </div>

    </div>
  );
}
