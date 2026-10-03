import { NextResponse } from "next/server";
import { getLandingFilm } from "@/lib/site/queries";

/**
 * What the marketing site (hostoscollective.com, SvelteKit) plays: the
 * landing footage as the Founder saved it. Public, cacheable, CORS-open.
 */
export const revalidate = 60;

export async function GET() {
  const { film } = await getLandingFilm();
  return NextResponse.json({ film }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600", "Access-Control-Allow-Origin": "*" } });
}
