import { NextRequest, NextResponse } from "next/server";
import { getPulseData, pulseEtag } from "@/lib/pulse/data";

/**
 * The live page polls this every few seconds. Authenticated by the session (a signed-in member of the workspace, a
 * viewer included): nothing here is writable. If nothing changed since the caller's ETag the answer is an empty 304, so
 * a quiet fleet costs almost nothing.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const data = await getPulseData();
  if (!data.signedIn) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const etag = pulseEtag(data);
  const headers = { ETag: etag, "Cache-Control": "private, no-store" };
  if (req.headers.get("if-none-match") === etag) {
    // nothing new; the page still needs the server's clock to keep "seconds ago" honest
    return new NextResponse(null, { status: 304, headers: { ...headers, "X-Server-Now": String(data.serverNow) } });
  }
  return NextResponse.json(data, { headers });
}
