import type { Metadata } from "next";
import { auth } from "@/auth";
import { FilmEditor } from "@/components/settings/film-editor";
import { WebsiteEditor } from "@/components/settings/website-editor";
import { isFounderEmail } from "@/lib/roles/constants";
import { getLandingFilm, getLandingIntro } from "@/lib/site/queries";

export const metadata: Metadata = { title: "Website" };

/**
 * Founder only. Two things live here: the footage hostoscollective.com
 * plays (the SvelteKit site reads it through /api/public/landing), and the
 * console intro of the app's own landing page (kept for the day it is
 * wanted back).
 */
export default async function WebsitePage() {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) {
    return <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-[14px] text-muted-foreground">Only the Founder can edit the website.</div>;
  }
  const [{ film, fromDatabase: filmSaved }, { intro, fromDatabase }] = await Promise.all([getLandingFilm(), getLandingIntro()]);
  return (
    <div className="space-y-10">
      <FilmEditor film={film} fromDatabase={filmSaved} />
      <details className="rounded-2xl border border-border bg-card/40 p-4">
        <summary className="cursor-pointer text-[13px] font-semibold">The app’s own landing intro (console) — not shown on hostoscollective.com while the new site fronts the domain</summary>
        <div className="mt-4"><WebsiteEditor intro={intro} fromDatabase={fromDatabase} /></div>
      </details>
    </div>
  );
}
