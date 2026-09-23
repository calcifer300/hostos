import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/site";
import { isFounderProfile, shortName } from "@/lib/team/profiles";
import { getPublicTeam } from "@/lib/team/queries";

/**
 * The public roster as JSON — what hostoscollective.com/team shows a
 * visitor (name, nickname, title, colour, photo), nothing more. Read by
 * the marketing site at build time and by anything else that wants to
 * introduce the team. Public data, so it is cacheable and CORS-open.
 */
export const revalidate = 300;

export async function GET() {
  const base = getPublicAppUrl();
  const members = (await getPublicTeam()).map((m) => ({
    slug: m.slug,
    name: m.name,
    nickname: shortName(m),
    title: m.title,
    department: m.department,
    hue: m.hue,
    photoUrl: m.photoUrl ? (m.photoUrl.startsWith("/") ? `${base}${m.photoUrl}` : m.photoUrl) : null,
    photoFocus: m.photoFocus,
    founder: isFounderProfile(m),
  }));
  return NextResponse.json(members, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
