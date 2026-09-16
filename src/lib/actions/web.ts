"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { canEditCurrentFleet, getCurrentHostId, hasNoFleetAccess } from "@/lib/host/context";
import { checkProperty } from "@/lib/web/check";
import { daysUntil, deleteProperty, getProperties, getProperty, insertProperty, recordCheck, updateProperty, type PropertyWrite } from "@/lib/web/queries";
import { logActivity } from "@/lib/activity/queries";
import { notify } from "@/lib/notifications/queries";
import { createTask } from "@/lib/tasks/queries";
import { routes } from "@/lib/routes";

/** Every write in the web & domains vertical. { ok, error? }, never throws, permission-checked. */

export interface WebActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function gate(): Promise<{ hostId: string; email: string | null } | { error: string }> {
  if (await hasNoFleetAccess()) return { error: "Your workspace isn't ready yet. Reload and try again." };
  if (!(await canEditCurrentFleet())) return { error: "You have read-only access to this workspace." };
  const session = await auth();
  return { hostId: await getCurrentHostId(), email: session?.user?.email ?? null };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface PropertyInput {
  name: string;
  domain: string;
  siteUrl?: string;
  registrar?: string;
  hosting?: string;
  clientName?: string;
  domainExpiresAt?: string;
  autoRenew?: boolean;
  notes?: string;
}

function normalizeDomain(raw: string): string | null {
  const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null;
}

function toWrite(input: PropertyInput): PropertyWrite | { error: string } {
  const domain = normalizeDomain(str(input.domain, 253));
  if (!domain) return { error: "Enter a domain like example.com." };
  const name = str(input.name, 120) || domain;
  const siteUrl = str(input.siteUrl, 500);
  if (siteUrl && !/^https?:\/\//i.test(siteUrl)) return { error: "The site URL must start with http:// or https://." };
  const expires = str(input.domainExpiresAt, 10);
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) return { error: "Expiry must be a date (YYYY-MM-DD)." };
  return {
    name,
    domain,
    siteUrl: siteUrl || null,
    registrar: str(input.registrar, 60) || "cloudflare",
    hosting: str(input.hosting, 120) || null,
    clientName: str(input.clientName, 120) || null,
    domainExpiresAt: expires || null,
    autoRenew: input.autoRenew !== false,
    notes: str(input.notes, 4000) || null,
  };
}

export async function createProperty(input: PropertyInput): Promise<WebActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const write = toWrite(input);
  if ("error" in write) return { ok: false, error: write.error };

  const outcome = await insertProperty(g.hostId, write);
  if (!outcome.ok) return { ok: false, error: /duplicate|unique/i.test(outcome.error) ? "That domain is already on the list." : /relation|created/i.test(outcome.error) ? "Run migration 0025 to enable Web & domains." : outcome.error };

  await logActivity({ hostId: g.hostId, module: "web", event: "web.added", description: `Added ${write.domain}`, actorEmail: g.email, href: routes.web });
  // First check right away, so the card is never blank.
  const result = await checkProperty(write.domain, write.siteUrl);
  await recordCheck(g.hostId, outcome.id, result);
  revalidatePath(routes.web);
  return { ok: true, id: outcome.id };
}

export async function editProperty(id: string, input: PropertyInput): Promise<WebActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const write = toWrite(input);
  if ("error" in write) return { ok: false, error: write.error };
  const outcome = await updateProperty(g.hostId, id, write);
  if (!outcome.ok) return { ok: false, error: outcome.error };
  revalidatePath(routes.web);
  return { ok: true, id };
}

export async function removeProperty(id: string): Promise<WebActionResult> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const existing = await getProperty(g.hostId, id);
  if (!existing) return { ok: false, error: "That property is gone already." };
  if (!(await deleteProperty(g.hostId, id))) return { ok: false, error: "Couldn't remove the property." };
  await logActivity({ hostId: g.hostId, module: "web", event: "web.removed", description: `Removed ${existing.domain}`, actorEmail: g.email });
  revalidatePath(routes.web);
  return { ok: true };
}

/** Checks one property now (or every property when no id is given) and raises what it finds. */
export async function runPropertyChecks(id?: string): Promise<WebActionResult & { checked?: number; down?: number }> {
  const g = await gate();
  if ("error" in g) return { ok: false, error: g.error };
  const all = await getProperties(g.hostId);
  const targets = id ? all.filter((p) => p.id === id) : all;
  if (targets.length === 0) return { ok: false, error: "Nothing to check yet." };

  let down = 0;
  for (const p of targets) {
    const result = await checkProperty(p.domain, p.siteUrl);
    await recordCheck(g.hostId, p.id, result);
    if (result.status === "down") {
      down += 1;
      await notify({ hostId: g.hostId, kind: "web", severity: "critical", title: `${p.domain} is down`, body: result.error ?? `HTTP ${result.httpStatus ?? "—"}`, href: routes.web, dedupeKey: `web-down:${p.id}:${new Date().toISOString().slice(0, 10)}` });
      await createTask({ hostId: g.hostId, title: `${p.domain} is not responding`, description: result.error ?? `Last response: HTTP ${result.httpStatus ?? "none"}.`, priority: "critical", source: "automation", relatedKind: "web_property", relatedId: p.id, href: routes.web, dedupeKey: `web-down:${p.id}:${new Date().toISOString().slice(0, 10)}` });
    }
    const sslDays = daysUntil(result.sslExpiresAt);
    if (sslDays !== null && sslDays <= 21) {
      await notify({ hostId: g.hostId, kind: "web", severity: sslDays <= 7 ? "critical" : "warning", title: `${p.domain}: SSL certificate expires in ${sslDays} day${sslDays === 1 ? "" : "s"}`, body: result.sslIssuer, href: routes.web, dedupeKey: `web-ssl:${p.id}:${result.sslExpiresAt?.slice(0, 10)}` });
    }
  }
  await logActivity({ hostId: g.hostId, module: "web", event: "web.checked", description: `Checked ${targets.length} propert${targets.length === 1 ? "y" : "ies"}${down > 0 ? ` · ${down} down` : ""}`, actorEmail: g.email, href: routes.web });
  revalidatePath(routes.web);
  return { ok: true, checked: targets.length, down };
}
