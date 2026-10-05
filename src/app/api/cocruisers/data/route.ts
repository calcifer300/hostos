import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, verifyToken } from "@/lib/pulse/access";
import { getCocruisersData, pulseEtag } from "@/lib/pulse/data";

/**
 * The live page polls this every few seconds. It needs the key's cookie; with it, an unchanged fleet costs an empty 304.
 * Nothing here is writable.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  if (!verifyToken(jar.get(ACCESS_COOKIE)?.value)) return NextResponse.json({ error: "Key required." }, { status: 401 });
  const data = await getCocruisersData();
  const etag = pulseEtag(data);
  const headers = { ETag: etag, "Cache-Control": "private, no-store" };
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ...headers, "X-Server-Now": String(data.serverNow) } });
  }
  return NextResponse.json(data, { headers });
}
