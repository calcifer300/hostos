"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Activity, CalendarClock, Globe, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProperty, editProperty, removeProperty, runPropertyChecks, type PropertyInput } from "@/lib/actions/web";
import type { WebProperty } from "@/lib/web/queries";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks/use-client-value";

const REGISTRARS = ["godaddy", "namecheap", "cloudflare", "google", "porkbun", "squarespace", "vercel", "other"];
const REGISTRAR_LABEL: Record<string, string> = { godaddy: "GoDaddy", namecheap: "Namecheap", cloudflare: "Cloudflare", google: "Google Domains", porkbun: "Porkbun", squarespace: "Squarespace", vercel: "Vercel", other: "Other" };

function daysUntil(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor((t - now) / 86_400_000) : null;
}

function dueTone(days: number | null): "danger" | "warning" | "success" | "neutral" {
  if (days === null) return "neutral";
  if (days <= 7) return "danger";
  if (days <= 30) return "warning";
  return "success";
}

/* ------------------------------------------------------------- dialog */

export function PropertyDialog({ open, onOpenChange, property }: { open: boolean; onOpenChange: (open: boolean) => void; property?: WebProperty | null }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const editing = Boolean(property);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: PropertyInput = {
      name: String(fd.get("name") ?? ""),
      domain: String(fd.get("domain") ?? ""),
      siteUrl: String(fd.get("siteUrl") ?? ""),
      registrar: String(fd.get("registrar") ?? "godaddy"),
      hosting: String(fd.get("hosting") ?? ""),
      clientName: String(fd.get("clientName") ?? ""),
      domainExpiresAt: String(fd.get("domainExpiresAt") ?? ""),
      autoRenew: fd.get("autoRenew") === "on",
      notes: String(fd.get("notes") ?? ""),
    };
    startTransition(async () => {
      const result = property ? await editProperty(property.id, input) : await createProperty(input);
      if (!result.ok) return void toast.error(result.error ?? "Something went wrong.");
      toast.success(property ? "Property updated" : "Property added and checked");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit property" : "Add a site or domain"}</DialogTitle>
            <DialogDescription>HostOS checks the site and its certificate itself, so nothing needs connecting — the registrar and hosting are for your records and renewals.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="w-domain">Domain</Label>
                <Input id="w-domain" name="domain" defaultValue={property?.domain ?? ""} placeholder="clientsite.com" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-name">Name</Label>
                <Input id="w-name" name="name" defaultValue={property?.name ?? ""} placeholder="Client Site" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="w-url">Site URL (if not https://domain)</Label>
                <Input id="w-url" name="siteUrl" defaultValue={property?.siteUrl ?? ""} placeholder="https://www.clientsite.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-registrar">Registrar</Label>
                <NativeSelect id="w-registrar" name="registrar" defaultValue={property?.registrar ?? "godaddy"}>
                  {REGISTRARS.map((r) => (
                    <option key={r} value={r}>
                      {REGISTRAR_LABEL[r]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-hosting">Hosting</Label>
                <Input id="w-hosting" name="hosting" defaultValue={property?.hosting ?? ""} placeholder="GoDaddy Managed WordPress, Vercel…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-client">Client</Label>
                <Input id="w-client" name="clientName" defaultValue={property?.clientName ?? ""} placeholder="Whose site this is" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-expires">Domain expires</Label>
                <Input id="w-expires" name="domainExpiresAt" type="date" defaultValue={property?.domainExpiresAt ?? ""} />
              </div>
              <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
                <input type="checkbox" name="autoRenew" defaultChecked={property?.autoRenew ?? true} className="h-4 w-4 rounded border-border accent-[var(--accent)]" />
                Auto-renew is on at the registrar
              </label>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="w-notes">Notes</Label>
                <Textarea id="w-notes" name="notes" rows={3} defaultValue={property?.notes ?? ""} placeholder="Login location, who to call, plan details…" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {editing ? "Save changes" : "Add and check"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------- properties */

export function PropertiesWidget({ properties, canEdit }: { properties: WebProperty[]; canEdit: boolean }) {
  const router = useRouter();
  const now = useNow();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<WebProperty | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [checkingId, setCheckingId] = React.useState<string | null>(null);

  function check(id?: string) {
    setCheckingId(id ?? "all");
    startTransition(async () => {
      const result = await runPropertyChecks(id);
      setCheckingId(null);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't run the check.");
      toast.success(`Checked ${result.checked} propert${result.checked === 1 ? "y" : "ies"}${result.down ? ` · ${result.down} down` : " · all up"}`);
      router.refresh();
    });
  }

  function remove(p: WebProperty) {
    if (!window.confirm(`Remove ${p.domain} from the list?`)) return;
    startTransition(async () => {
      const result = await removeProperty(p.id);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't remove it.");
      toast.success("Removed");
      router.refresh();
    });
  }

  return (
    <DashboardCard
      icon={Globe}
      title="Sites & domains"
      action={
        <div className="flex items-center gap-2">
          {properties.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => check()} loading={pending && checkingId === "all"}>
              <RefreshCw /> Check all
            </Button>
          )}
          {canEdit && (
            <Button variant="primary" size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus /> Add
            </Button>
          )}
        </div>
      }
    >
      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-[14px] font-medium">No sites yet</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted-foreground">Add a domain and HostOS checks it immediately — uptime, response time and SSL expiry — then every day after that.</p>
          {canEdit && (
            <Button variant="primary" className="mt-4" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus /> Add your first site
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-3 font-semibold">Site</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 pr-3 font-semibold">SSL</th>
                <th className="pb-2 pr-3 font-semibold">Domain renews</th>
                <th className="pb-2 pr-3 font-semibold">Registrar · hosting</th>
                <th className="pb-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {properties.map((p, i) => {
                const ssl = daysUntil(p.sslExpiresAt, now);
                const dom = daysUntil(p.domainExpiresAt, now);
                return (
                  <motion.tr key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03, duration: 0.35 }} className="align-middle">
                    <td className="py-2.5 pr-3">
                      <a href={p.siteUrl ?? `https://${p.domain}`} target="_blank" rel="noreferrer" className="font-medium hover:text-accent">
                        {p.name}
                      </a>
                      <p className="text-[11.5px] text-muted-foreground">
                        {p.domain}
                        {p.clientName ? ` · ${p.clientName}` : ""}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", p.status === "up" ? "bg-success" : p.status === "down" ? "bg-danger" : "bg-muted-foreground/40")} />
                        <span className={cn("font-medium", p.status === "down" && "text-danger")}>{p.status === "up" ? "Up" : p.status === "down" ? "Down" : "Not checked"}</span>
                        {p.responseMs !== null && <span className="text-[11.5px] text-muted-foreground">· {p.responseMs} ms</span>}
                      </span>
                      <p className="text-[11px] text-muted-foreground">{p.lastCheckedAt ? `Checked ${formatRelativeTime(p.lastCheckedAt)}` : "—"}</p>
                    </td>
                    <td className="py-2.5 pr-3">{ssl === null ? <Badge variant="neutral">Unknown</Badge> : <Badge variant={dueTone(ssl)}>{ssl < 0 ? "Expired" : `${ssl}d`}</Badge>}</td>
                    <td className="py-2.5 pr-3">
                      {dom === null ? (
                        <Badge variant="neutral">Not set</Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <Badge variant={p.autoRenew && dom > 7 ? "success" : dueTone(dom)}>{dom < 0 ? "Expired" : `${dom}d`}</Badge>
                          {p.autoRenew && <span className="text-[11px] text-muted-foreground">auto</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-muted-foreground">
                      {REGISTRAR_LABEL[p.registrar] ?? p.registrar}
                      {p.hosting ? ` · ${p.hosting}` : ""}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex items-center gap-0.5">
                        <button type="button" onClick={() => check(p.id)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Check now" disabled={pending}>
                          <RefreshCw className={cn("h-3.5 w-3.5", checkingId === p.id && "animate-spin")} />
                        </button>
                        {canEdit && (
                          <>
                            <button type="button" onClick={() => { setEditing(p); setOpen(true); }} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => remove(p)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-danger" aria-label="Remove">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PropertyDialog key={editing?.id ?? "new"} open={open} onOpenChange={setOpen} property={editing} />
    </DashboardCard>
  );
}

/* ------------------------------------------------------------ expiring */

export function ExpiringWidget({ properties }: { properties: WebProperty[] }) {
  const now = useNow();
  const rows = properties
    .flatMap((p) => [
      { key: `${p.id}-dom`, name: p.domain, what: "Domain", days: daysUntil(p.domainExpiresAt, now), auto: p.autoRenew },
      { key: `${p.id}-ssl`, name: p.domain, what: "SSL certificate", days: daysUntil(p.sslExpiresAt, now), auto: false },
    ])
    .filter((r): r is typeof r & { days: number } => r.days !== null && r.days <= 45)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);
  return (
    <DashboardCard icon={CalendarClock} title="Renewals & SSL due" className="h-full">
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing expires in the next 45 days.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate">
                {r.name} <span className="text-muted-foreground">· {r.what}</span>
                {r.auto && <span className="ml-1 text-[11px] text-muted-foreground">(auto-renew)</span>}
              </span>
              <Badge variant={r.days <= 7 ? "danger" : r.days <= 30 ? "warning" : "success"}>{r.days < 0 ? "expired" : `${r.days}d`}</Badge>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}

/* -------------------------------------------------------------- uptime */

export function UptimeWidget({ properties }: { properties: WebProperty[] }) {
  const up = properties.filter((p) => p.status === "up").length;
  const down = properties.filter((p) => p.status === "down");
  const avg = properties.filter((p) => p.responseMs !== null);
  const avgMs = avg.length ? Math.round(avg.reduce((s, p) => s + (p.responseMs ?? 0), 0) / avg.length) : null;
  return (
    <DashboardCard icon={Activity} title="Uptime" action={<span className="text-[12px] text-muted-foreground">{properties.length ? `${up}/${properties.length} up${avgMs !== null ? ` · ${avgMs} ms avg` : ""}` : ""}</span>} className="h-full">
      {properties.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Add a site to start checking it.</p>
      ) : down.length === 0 ? (
        <p className="flex items-center gap-2 text-[13px] text-success">
          <ShieldCheck className="h-4 w-4" /> Every site answered on its last check.
        </p>
      ) : (
        <ul className="space-y-2">
          {down.map((p) => (
            <li key={p.id} className="rounded-lg border border-danger/30 bg-danger-bg/30 px-3 py-2 text-[13px]">
              <p className="font-medium text-danger">{p.domain} is down</p>
              <p className="text-[11.5px] text-muted-foreground">{p.lastError ?? `HTTP ${p.httpStatus ?? "—"}`}</p>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
