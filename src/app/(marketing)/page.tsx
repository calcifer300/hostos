import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { AiSection } from "@/components/marketing/ai-section";
import { CommerceOps, FleetOps, RestaurantOps } from "@/components/marketing/ops-sections";
import { Pricing, Faq } from "@/components/marketing/pricing-faq";
import { Contact } from "@/components/marketing/contact";
import { Outcomes } from "@/components/marketing/outcomes";
import {
  Automation,
  Features,
  FinalCta,
  Industries,
  Integrations,
  PlatformIntro,
  Process,
  Services,
  Team,
  Testimonials,
  WhoWeAre,
  WhyUs,
  Work,
} from "@/components/marketing/sections";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE.company} — Business solutions, virtual assistance and the HostOS platform` },
  alternates: { canonical: "/" },
};

/**
 * The public landing page for HostOS Collective. Section order follows the
 * classic services-site arc — hero, who we are, what we do, who for, the
 * product, the people, proof, process, price, questions, contact — for one
 * company with one platform behind everything it sells.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <WhoWeAre />
      <Outcomes />
      <Services />
      <Industries />
      <PlatformIntro />
      <FleetOps />
      <RestaurantOps />
      <CommerceOps />
      <Features />
      <Automation />
      <AiSection />
      <Integrations />
      <Team />
      <WhyUs />
      <Work />
      <Process />
      <Testimonials />
      <Pricing />
      <Faq />
      <Contact />
      <FinalCta />
    </>
  );
}
