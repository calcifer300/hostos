import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { runQueryOr } from "@/lib/supabase/server";
import { checkProperty } from "@/lib/web/check";
import { daysUntil, getProperties, recordCheck } from "@/lib/web/queries";
import { notify } from "@/lib/notifications/queries";
import { createTask } from "@/lib/tasks/queries";
import { routes } from "@/lib/routes";

/**
 * Checks every property of every workspace that runs the web vertical —
 * uptime, response time, SSL expiry — and raises what it finds. Scheduled by
 * Vercel Cron (vercel.json, daily on the Hobby plan); refuses to run without
 * CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set; refusing to run." }, { status: 503 });
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!getServerEnv().supabaseUrl) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const { data: hosts } = await runQueryOr<{ id: string; modules: string[] | null }[]>("hosts.web", [], (client) =>
    client.from("hosts").select("id, modules").contains("modules", ["web"]).limit(500).returns<{ id: string; modules: string[] | null }[]>()
  );

  const today = new Date().toISOString().slice(0, 10);
  let checked = 0;
  let down = 0;
  for (const host of hosts) {
    const properties = await getProperties(host.id);
    for (const p of properties) {
      const result = await checkProperty(p.domain, p.siteUrl);
      await recordCheck(host.id, p.id, result);
      checked += 1;
      if (result.status === "down") {
        down += 1;
        await notify({ hostId: host.id, kind: "web", severity: "critical", title: `${p.domain} is down`, body: result.error ?? `HTTP ${result.httpStatus ?? "—"}`, href: routes.web, dedupeKey: `web-down:${p.id}:${today}` });
        await createTask({ hostId: host.id, title: `${p.domain} is not responding`, description: result.error ?? `Last response: HTTP ${result.httpStatus ?? "none"}.`, priority: "critical", source: "automation", relatedKind: "web_property", relatedId: p.id, href: routes.web, dedupeKey: `web-down:${p.id}:${today}` });
      }
      const ssl = daysUntil(result.sslExpiresAt);
      if (ssl !== null && ssl <= 21) {
        await notify({ hostId: host.id, kind: "web", severity: ssl <= 7 ? "critical" : "warning", title: `${p.domain}: SSL certificate expires in ${ssl} day${ssl === 1 ? "" : "s"}`, body: result.sslIssuer, href: routes.web, dedupeKey: `web-ssl:${p.id}:${result.sslExpiresAt?.slice(0, 10)}` });
      }
      const dom = daysUntil(p.domainExpiresAt);
      if (dom !== null && dom <= 30) {
        await createTask({ hostId: host.id, title: `Renew ${p.domain} — ${dom <= 0 ? "expired" : `${dom} day${dom === 1 ? "" : "s"} left`}`, description: p.autoRenew ? "Auto-renew is on at the registrar; confirm the card on file still works." : "Auto-renew is off. Renew at the registrar before it lapses.", priority: dom <= 7 ? "critical" : "high", source: "automation", relatedKind: "web_property", relatedId: p.id, href: routes.web, dedupeKey: `web-renew:${p.id}:${p.domainExpiresAt}` });
      }
    }
  }
  return NextResponse.json({ ok: true, hosts: hosts.length, checked, down });
}
