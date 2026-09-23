import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { runQueryOr } from "@/lib/supabase/server";
import { runButlerRules } from "@/lib/butler/tasks";

/**
 * Runs the Butler's rules for every workspace. Scheduled by Vercel Cron (see
 * vercel.json); refuses to run without CRON_SECRET so the URL can't be used
 * to make every workspace re-evaluate on demand.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set; refusing to run." }, { status: 503 });
  }
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!getServerEnv().supabaseUrl) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { data: hosts } = await runQueryOr<{ id: string }[]>("hosts.all", [], (client) =>
    client.from("hosts").select("id").limit(500).returns<{ id: string }[]>()
  );

  const results: { hostId: string; tasksCreated: number; notificationsCreated: number }[] = [];
  for (const host of hosts) {
    try {
      const r = await runButlerRules(host.id);
      results.push({ hostId: host.id, tasksCreated: r.tasksCreated, notificationsCreated: r.notificationsCreated });
    } catch (err) {
      console.error(`[cron/butler] ${host.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, workspaces: results.length, results });
}
