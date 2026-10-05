import type { Metadata } from "next";
import { PricingPage } from "@/components/marketing/pricing-page";
import { SITE } from "@/lib/site";
import { getLandingFilm } from "@/lib/site/queries";
import { SITE_SERVICES } from "@/lib/site/services-default";

export const metadata: Metadata = {
  title: { absolute: `Services & pricing — ${SITE.company}` },
  description: "Business operations, web and app development, AI automation, CRM, SEO and design — clear prices in USD, custom work by quote, and a Free Strategy Call to start.",
  alternates: { canonical: "https://hostoscollective.com/pricing" },
};

export const revalidate = 300;

/** The Founder's services when he has saved any; the site's built-in eight otherwise. */
export default async function Page() {
  const { film } = await getLandingFilm();
  return <PricingPage services={film.services.length ? film.services : SITE_SERVICES} />;
}
