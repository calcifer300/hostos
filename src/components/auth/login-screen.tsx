"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { googleSignIn } from "@/lib/actions/auth";
import { Logo, LogoMark } from "@/components/brand/logo-mark";
import { IntroSequence, useIntroSeen } from "@/components/auth/intro-sequence";
import { routes } from "@/lib/routes";
import { SITE } from "@/lib/site";

const EASE = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

const POINTS = [
  { icon: Zap, text: "Your fleet and restaurants sync on their own, every minute." },
  { icon: Sparkles, text: "The AI Butler drafts, briefs and files the work before you sit down." },
  { icon: ShieldCheck, text: "Pairing keys, not passwords. Every workspace stays private to its members." },
];

export function LoginScreen({ callbackUrl, error }: { callbackUrl?: string | null; error?: string | null }) {
  const [introSeen, markSeen] = useIntroSeen();
  const [pending, setPending] = React.useState(false);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-12">
      <AnimatePresence>{!introSeen && <IntroSequence onDone={markSeen} />}</AnimatePresence>

      <div aria-hidden className="bg-grid absolute inset-0 -z-10" />
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-accent/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-accent-2/10 blur-3xl" />

      <Link
        href={routes.home}
        className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to HostOS
      </Link>

      <motion.div
        variants={container}
        initial="hidden"
        animate={introSeen ? "show" : "hidden"}
        className="grid w-full max-w-4xl grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_420px]"
      >
        <div className="hidden lg:block">
          <motion.div variants={item}>
            <LogoMark size={56} glow />
          </motion.div>
          <motion.h1 variants={item} className="mt-6 text-[40px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Welcome back to <span className="text-gradient">your command center.</span>
          </motion.h1>
          <motion.p variants={item} className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            {SITE.tagline} Sign in to open your workspaces.
          </motion.p>
          <motion.ul variants={item} className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-start gap-3 text-[13.5px] text-foreground/85">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <p.icon className="h-3.5 w-3.5" />
                </span>
                {p.text}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          variants={item}
          className="spot gradient-border relative rounded-[1.75rem] border border-border bg-card p-8 shadow-[var(--shadow-elevated)]"
        >
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <Logo size="md" />
            <p className="mt-3 text-[13px] text-muted-foreground">Sign in to continue to HostOS.</p>
          </div>

          <form
            action={googleSignIn}
            onSubmit={() => setPending(true)}
            className="space-y-3"
          >
            {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-6 py-3.5 text-[15px] font-medium text-foreground shadow-[var(--shadow-card)] transition-[transform,border-color] duration-200 ease-[var(--ease-out-expo)] hover:border-accent/50 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            >
              <GoogleIcon />
              {pending ? "Redirecting to Google…" : "Continue with Google"}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-[12.5px] text-danger">
              Sign-in didn&rsquo;t complete ({error}). Try again, or contact {SITE.contactEmail}.
            </p>
          )}

          <p className="mt-6 text-center text-[12px] leading-relaxed text-muted-foreground/85 lg:text-left">
            By continuing you agree to let HostOS act on your behalf within the permissions you grant. New accounts get
            their own workspace automatically.
          </p>
          <p className="mt-6 text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80 lg:text-left">
            Built by {SITE.company}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
