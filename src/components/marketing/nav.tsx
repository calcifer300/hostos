"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useMotionValueEvent, useSpring } from "framer-motion";
import { ArrowRight, LayoutGrid, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "@/components/marketing/data";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Whether a session exists, read after mount from Auth.js's session
 * endpoint so the landing pages stay static. Null until known — the nav
 * renders the signed-out buttons meanwhile, which is also the SSR output,
 * so hydration matches.
 */
function useSignedIn(): { name: string | null; image: string | null } | null {
  const [user, setUser] = React.useState<{ name: string | null; image: string | null } | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!cancelled && s?.user) setUser({ name: s.user.name ?? null, image: s.user.image ?? null });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return user;
}

export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const user = useSignedIn();
  const { scrollY, scrollYProgress } = useScroll();
  // A hairline at the very top fills as the page is read.
  const progress = useSpring(scrollYProgress, { stiffness: 160, damping: 28, mass: 0.4 });

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4"
    >
      <motion.div
        aria-hidden
        style={{ scaleX: progress }}
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] origin-left bg-[linear-gradient(90deg,var(--accent),var(--accent-2))]"
      />
      <div
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-4 py-2.5 transition-all duration-300",
          scrolled ? "border-border bg-background/92 shadow-[var(--shadow-card)] backdrop-blur-xl" : "border-transparent bg-transparent"
        )}
      >
        <Link href={routes.home} aria-label="HostOS Collective home" className="flex items-center">
          <Logo size="sm" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <Button asChild variant="gradient" size="sm" pill>
              <Link href={routes.app}>
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt="" className="h-5 w-5 rounded-full" />
                ) : (
                  <LayoutGrid />
                )}
                Open HostOS
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" pill>
                <Link href={routes.login}>Sign in</Link>
              </Button>
              <Button asChild variant="gradient" size="sm" pill>
                <Link href="/#contact">
                  Book a consultation
                  <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted lg:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-2 max-w-6xl rounded-2xl border border-border bg-background/95 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl lg:hidden"
          >
            <div className="flex flex-col">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2.5 text-[14px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              <Button asChild variant="secondary" className="flex-1" pill>
                <Link href={user ? routes.app : routes.login}>{user ? "Open HostOS" : "Sign in"}</Link>
              </Button>
              <Button asChild variant="gradient" className="flex-1" pill>
                <Link href="/#contact" onClick={() => setOpen(false)}>
                  Book a consultation
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
