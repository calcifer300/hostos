import { NextRequest, NextResponse } from "next/server";
import { requireCompanionHost } from "@/lib/api/companion-auth";
import { saveCommandSnapshot, saveHeartbeat } from "@/lib/command/queries";
import { MAX_SNAPSHOT_BYTES, normalizeSnapshot } from "@/lib/command/snapshot";

/**
 * Receives the Command Center snapshot from the HostOS extension. Machine-to-machine: authenticated by the
 * workspace's bearer pairing key (Settings), exactly like /api/turo/sync, and it only ever writes to the
 * workspace that key belongs to. The body is validated and rebuilt field by field before it is stored, so
 * nothing the sender includes beyond the known shape is kept.
 */
export async function POST(req: NextRequest) {
  const auth = await requireCompanionHost(req);
  if (!auth.ok) return auth.response;
  const { host } = auth.ctx;

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "Snapshot is too large.", retryable: false }, { status: 413 });
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return NextResponse.json({ error: "Could not read the body.", retryable: false }, { status: 400 });
  }
  if (text.length > MAX_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "Snapshot is too large.", retryable: false }, { status: 413 });
  }

  let body: { snapshot?: unknown; heartbeat?: { at?: unknown; lastScan?: unknown } };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", retryable: false }, { status: 400 });
  }
  // A heartbeat: "the scanner is running". Cheap, and never touches the snapshot.
  if (body && body.heartbeat) {
    const lastScan = typeof body.heartbeat.lastScan === "string" ? body.heartbeat.lastScan : null;
    await saveHeartbeat(host.id, lastScan);
    return NextResponse.json({ ok: true, heartbeat: true });
  }
  const snapshot = normalizeSnapshot(body?.snapshot);
  if (!snapshot) {
    return NextResponse.json({ error: "That is not a Command Center snapshot.", retryable: false }, { status: 400 });
  }

  const saved = await saveCommandSnapshot(host.id, snapshot, text.length);
  if (!saved.ok) {
    return NextResponse.json(
      { error: saved.error, retryable: saved.kind !== "missing_table" },
      { status: saved.kind === "missing_table" ? 502 : 503, headers: saved.kind === "missing_table" ? {} : { "Retry-After": "30" } }
    );
  }
  return NextResponse.json({ ok: true, version: snapshot.version, receivedAt: new Date().toISOString() });
}
