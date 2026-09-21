import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo-mark";
import { routes } from "@/lib/routes";

/** The one 404, for public and product paths alike. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div aria-hidden className="absolute left-1/2 top-1/3 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--accent-glow),transparent)] blur-3xl" />
      <Logo size="md" />
      <span className="mt-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card text-accent shadow-[var(--shadow-card)]">
        <Compass className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="mt-6 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">404</p>
      <h1 className="headline mt-2 text-balance text-[30px] md:text-[38px]">There is <em>nothing</em> at this address.</h1>
      <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-muted-foreground">
        The page may have moved when the product moved under /app, or the link was never quite right.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild variant="gradient" size="lg">
          <Link href={routes.app}>
            Open HostOS <ArrowRight />
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href={routes.home}>Back to the site</Link>
        </Button>
      </div>
    </main>
  );
}
