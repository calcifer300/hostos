import type { Metadata } from "next";
import { AboutPage } from "@/components/marketing/about-page";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `About — ${SITE.company}` },
  description: "Founder-led, operator-built. Ten years across operations, customer service, full-stack development and leadership, now running on HostOS.",
  alternates: { canonical: "/about" },
};

export default function Page() {
  return <AboutPage />;
}
