import Link from "next/link";
import { Logo } from "@/components/brand/logo-mark";
import { NAV_LINKS } from "@/components/marketing/data";
import { routes } from "@/lib/routes";
import { SITE } from "@/lib/site";

const SERVICES = [
  { href: "/#services", label: "Virtual assistants & support" },
  { href: "/#services", label: "Automation & custom systems" },
  { href: "/#services", label: "Websites & mobile apps" },
  { href: "/#services", label: "SEO & digital marketing" },
  { href: "/#platform", label: "The HostOS platform" },
];

const PLATFORM = [
  { href: "/#fleet", label: "Fleet operations" },
  { href: "/#restaurants", label: "Restaurant operations" },
  { href: "/#commerce", label: "Commerce operations" },
  { href: "/#ai", label: "AI Butler" },
  { href: routes.install, label: "Install on iPhone / Android" },
  { href: routes.app, label: "Launch HostOS" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-surface/60 px-6 pb-10 pt-16">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo size="md" />
          <p className="mt-2 text-[13px] font-semibold tracking-tight">{SITE.company}</p>
          <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">{SITE.description}</p>
        </div>

        <div>
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Services</p>
          <ul className="space-y-2">
            {SERVICES.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="text-[13.5px] text-foreground/80 transition-colors hover:text-foreground">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Platform</p>
          <ul className="space-y-2">
            {PLATFORM.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-[13.5px] text-foreground/80 transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pages</p>
          <ul className="space-y-2">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[13.5px] text-foreground/80 transition-colors hover:text-foreground">
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={routes.login} className="text-[13.5px] text-foreground/80 transition-colors hover:text-foreground">
                Sign in
              </Link>
            </li>
          </ul>
          <p className="mb-3 mt-6 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Contact</p>
          <ul className="space-y-2 text-[13.5px]">
            <li>
              <a href={`mailto:${SITE.contactEmail}`} className="text-foreground/80 transition-colors hover:text-foreground">
                {SITE.contactEmail}
              </a>
            </li>
            <li>
              <a href={SITE.whatsapp} target="_blank" rel="noreferrer" className="text-foreground/80 transition-colors hover:text-foreground">
                {SITE.phone}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-border pt-6 text-[12px] text-muted-foreground md:flex-row">
        <p>
          © {new Date().getFullYear()} {SITE.company}. All rights reserved.
        </p>
        <p>HostOS is not affiliated with Turo, Inc., DoorDash, Inc. or Shopify Inc.</p>
      </div>
    </footer>
  );
}
