import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, ChefHat, Car, CreditCard, Globe, Hash, Mail, Phone, Puzzle, ShoppingBag, type LucideIcon } from "lucide-react";
import { auth } from "@/auth";
import { getHost, getHostModules } from "@/lib/host/queries";
import { canManageIntegrations, getCurrentHostId } from "@/lib/host/context";
import { getConnections } from "@/lib/integrations/queries";
import { getStores } from "@/lib/commerce/queries";
import { getRestaurants } from "@/lib/restaurants/queries";
import { CompanionSetup } from "@/components/settings/companion-setup";
import { Badge } from "@/components/ui/badge";
import { INTEGRATIONS, type IntegrationProvider } from "@/lib/modules";
import { routes } from "@/lib/routes";
import { formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Connectors" };

const ICONS: Record<IntegrationProvider, LucideIcon> = {
  turo: Car,
  doordash: ChefHat,
  shopify: ShoppingBag,
  gmail: Mail,
  google_calendar: Calendar,
  slack: Hash,
  sms: Phone,
  godaddy: Globe,
  square: CreditCard,
};

function Row({ icon: Icon, name, status, action, description }: { icon: LucideIcon; name: string; status: React.ReactNode; action?: React.ReactNode; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-[16px] w-[16px] text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium">{name}</p>
          <div className="mt-0.5 text-[12px] text-muted-foreground">{status}</div>
          {description && <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/80">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export default async function ConnectorsPage() {
  const session = await auth();
  const hostId = await getCurrentHostId();
  const [host, modules, canManage, connections, stores, restaurants] = await Promise.all([
    getHost(hostId),
    getHostModules(hostId),
    canManageIntegrations(),
    getConnections(hostId),
    getStores(hostId),
    getRestaurants(hostId),
  ]);

  const shopify = connections.filter((c) => c.provider === "shopify");
  const withStoreId = restaurants.filter((r) => r.doordashStoreId).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Connectors</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Every platform HostOS reads from. One Companion for the browser-side ones; direct connections for the rest.
        </p>
      </div>

      <h2 className="mb-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">HostOS Companion</h2>
      <p className="mb-3 px-1 text-[12.5px] text-muted-foreground">
        The Chrome extension that recognises Turo and the DoorDash Merchant Portal, injects HostOS tools and syncs with this workspace using a pairing key.
      </p>
      <CompanionSetup hasKey={Boolean(host?.companionApiKey)} canManage={canManage} />

      <h2 className="mb-2 mt-8 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">Platforms</h2>
      <div className="space-y-3">
        {INTEGRATIONS.map((integration) => {
          const Icon = ICONS[integration.id];
          const relevant = integration.modules.length === 0 || integration.modules.some((m) => modules.includes(m));
          if (!relevant && integration.status !== "soon") return null;

          let status: React.ReactNode;
          let action: React.ReactNode;

          switch (integration.id) {
            case "turo":
              status = host?.companionApiKey ? <span className="text-success">Paired through the Companion</span> : "Pair the Companion above";
              action = host?.companionApiKey ? <Badge variant="success">Connected</Badge> : <Badge variant="neutral">Not paired</Badge>;
              break;
            case "doordash":
              status = restaurants.length === 0 ? "Add a restaurant to start" : `${withStoreId} of ${restaurants.length} restaurant${restaurants.length === 1 ? "" : "s"} have a store ID for monitoring`;
              action = (
                <Link href={routes.restaurants} className="inline-flex items-center rounded-full border border-border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors hover:border-accent/40">
                  Restaurants
                </Link>
              );
              break;
            case "shopify":
              status =
                shopify.length === 0 ? (
                  "No store connected"
                ) : (
                  <span>
                    {shopify.map((c) => (
                      <span key={c.id} className={c.status === "error" ? "text-danger" : "text-success"}>
                        {c.displayName ?? c.externalId}
                        {c.lastSyncedAt ? ` · synced ${formatRelativeTime(c.lastSyncedAt)}` : ""}
                        {c.status === "error" && c.lastError ? ` · ${c.lastError.slice(0, 60)}` : ""}
                      </span>
                    )).reduce<React.ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, " · ", el]), [])}
                  </span>
                );
              action = (
                <Link href={routes.commerce} className="inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90">
                  {stores.length === 0 ? "Connect" : "Manage"}
                </Link>
              );
              break;
            case "gmail":
              status = session?.user?.email ? <span className="truncate">{session.user.email}</span> : "Not connected";
              action = session?.user ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Link href={routes.login} className="inline-flex items-center rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90">
                  Connect
                </Link>
              );
              break;
            default:
              status = "Not built yet";
              action = <Badge variant="neutral">Coming soon</Badge>;
          }

          return <Row key={integration.id} icon={Icon} name={integration.name} status={status} action={action} description={integration.description} />;
        })}
      </div>

      <div className="mt-8 flex gap-3 rounded-2xl border border-dashed border-border p-5">
        <Puzzle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Need another platform? HostOS is built for any operation — WooCommerce, Uber Eats, Getaround and more slot in as modules. Tell HostOS Collective what you run.
        </p>
      </div>
    </div>
  );
}
