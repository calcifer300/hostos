"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Car,
  ChefHat,
  Clock3,
  Coffee,
  Copy,
  DollarSign,
  ExternalLink,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/marketing/sections";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------- monitors */

type Tone = "danger" | "warning" | "success" | "accent";

const TONE = {
  danger: { ring: "border-danger/40", bar: "bg-danger", text: "text-danger", soft: "bg-danger-bg/40", chip: "bg-danger/12 text-danger" },
  warning: { ring: "border-warning/40", bar: "bg-warning", text: "text-warning", soft: "bg-warning-bg/40", chip: "bg-warning/12 text-warning" },
  success: { ring: "border-success/40", bar: "bg-success", text: "text-success", soft: "bg-success-bg/40", chip: "bg-success/12 text-success" },
  accent: { ring: "border-accent/40", bar: "bg-accent", text: "text-accent", soft: "bg-accent/10", chip: "bg-accent/12 text-accent" },
} as const;

interface Monitor {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  guest: string;
  chip: string;
  vehicle: string;
  when: string;
  rows: { label: string; value: string; tone?: Tone }[];
  actions: { label: string; icon?: LucideIcon; primary?: boolean }[];
}

/**
 * The four monitors that pay for HostOS on a Turo fleet, each shown as the
 * card an operator actually sees. Figures are illustrative, in the shape of
 * real trips.
 */
const MONITORS: Monitor[] = [
  {
    tone: "danger",
    icon: ShieldAlert,
    title: "Protection plan alert",
    subtitle: "Know when a reservation increases your financial exposure.",
    guest: "Stephen",
    chip: "Premier · $0 excess",
    vehicle: "Volkswagen Tiguan 2024",
    when: "Sun, Sep 20 · 12:00 PM → Sun, Sep 27 · 11:00 AM",
    rows: [
      { label: "Plan", value: "Premier — $0 excess", tone: "danger" },
      { label: "Guest", value: "No ratings yet · 0 trips", tone: "danger" },
      { label: "Why", value: "Guest bought the Premier plan — $0 out-of-pocket, so damage cannot be billed to them. Cancel before pickup if you do not want that exposure.", tone: "danger" },
    ],
    actions: [{ label: "Open trip", icon: ExternalLink, primary: true }],
  },
  {
    tone: "warning",
    icon: TrendingUp,
    title: "Profit risk",
    subtitle: "Identify low-profit trips before they happen.",
    guest: "Anna",
    chip: "Below $0.20/mi",
    vehicle: "Volkswagen Atlas 2023",
    when: "Mon, Sep 14 · 11:00 AM → Sun, Sep 20 · 5:00 PM",
    rows: [
      { label: "Earnings", value: "$291 · 7 days · ~$42/day after discounts and Turo's cut", tone: "warning" },
      { label: "Per mile", value: "$0.15/mi earned across 2,000 mi included", tone: "warning" },
      { label: "Delivery", value: "$120 fee" },
      { label: "Plan", value: "Minimum — $3,000 excess" },
    ],
    actions: [{ label: "Open trip", icon: ExternalLink, primary: true }],
  },
  {
    tone: "danger",
    icon: ShieldCheck,
    title: "Unverified licenses",
    subtitle: "Get alerts for unverified driver's licenses before pickup.",
    guest: "Adam",
    chip: "License unverified",
    vehicle: "Tesla Model Y 2023",
    when: "Thu, Sep 10 · 6:00 PM → Sat, Oct 10 · 10:00 AM",
    rows: [
      { label: "Action", value: "Confirm the driver's license before pickup", tone: "warning" },
      { label: "Plan", value: "Standard — $500 excess" },
      { label: "Guest", value: "5.0★ from 4 ratings · 4 trips · joined Apr 2023" },
    ],
    actions: [
      { label: "Copy reminder", icon: Copy },
      { label: "Open trip", icon: ExternalLink, primary: true },
    ],
  },
  {
    tone: "success",
    icon: DollarSign,
    title: "Earnings estimator",
    subtitle: "See estimated earnings immediately after a trip ends.",
    guest: "Trip complete",
    chip: "≈ $455",
    vehicle: "Volkswagen Taos 2022",
    when: "Ended 12:00 PM today",
    rows: [
      { label: "Earnings", value: "≈ $455 · 11 days · ~$41/day", tone: "success" },
      { label: "Estimator", value: "≈ $2,550 across 6 trips this month", tone: "success" },
      { label: "Next", value: "Reviewed and filed — nothing to do" },
    ],
    actions: [{ label: "Open trip", icon: ExternalLink, primary: true }],
  },
];

function MonitorCard({ m, index }: { m: Monitor; index: number }) {
  const t = TONE[m.tone];
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn("relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-card)]", t.ring)}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", t.bar)} />
      <div className="flex items-start gap-3 px-5 pt-5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", t.chip)}>
          <m.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h3 className={cn("text-[12px] font-semibold uppercase tracking-[0.12em]", t.text)}>{m.title}</h3>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{m.subtitle}</p>
        </div>
      </div>

      <div className="mx-5 mt-4 flex flex-1 flex-col rounded-xl border border-border bg-background/40">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="truncate text-[14px] font-semibold tracking-tight">{m.guest}</p>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide", t.chip)}>{m.chip}</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-[13px] font-medium">{m.vehicle}</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">{m.when}</p>
          <dl className="mt-3 grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5">
            {m.rows.map((r, i) => (
              <motion.div
                key={r.label}
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + index * 0.05 + i * 0.07, duration: 0.45, ease: EASE }}
                className="contents"
              >
                <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{r.label}</dt>
                <dd className={cn("text-[12px] leading-snug", r.tone ? TONE[r.tone].text : "text-foreground/90")}>{r.value}</dd>
              </motion.div>
            ))}
          </dl>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-5 py-4">
        {m.actions.map((a) => (
          <span
            key={a.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium",
              a.primary ? "bg-accent text-accent-foreground" : "border border-border bg-card text-foreground"
            )}
          >
            {a.icon && <a.icon className="h-3.5 w-3.5" />}
            {a.label}
          </span>
        ))}
      </div>
    </motion.article>
  );
}

/* ------------------------------------------------------------- benefits */

const BENEFITS: { icon: LucideIcon; label: string }[] = [
  { icon: ShieldCheck, label: "Prevent costly mistakes" },
  { icon: DollarSign, label: "Maximize earnings" },
  { icon: Clock3, label: "Save time" },
  { icon: Workflow, label: "Automate operations" },
  { icon: BarChart3, label: "Make smarter decisions" },
];

/* ----------------------------------------------------- every business */

interface BusinessOutcome {
  icon: LucideIcon;
  name: string;
  platform: string;
  watch: string[];
  result: string;
}

const BUSINESSES: BusinessOutcome[] = [
  {
    icon: Car,
    name: "Turo fleets",
    platform: "Live in HostOS",
    watch: ["Unverified licenses inside the 24-hour window", "Premier-plan bookings that leave you exposed", "Trips earning under $0.20 a mile"],
    result: "Every trip vetted before pickup, every earning estimated the moment it ends.",
  },
  {
    icon: ChefHat,
    name: "DoorDash stores",
    platform: "Beta in HostOS",
    watch: ["A storefront paused in the middle of dinner service", "Menu prices and 86'd items drifting from your POS", "Order volume dropping day over day"],
    result: "The store stays open, the menu stays right, and no order goes unnoticed.",
  },
  {
    icon: ShoppingBag,
    name: "Shopify stores",
    platform: "Beta in HostOS",
    watch: ["Best-sellers about to sell out", "Orders sitting unfulfilled past a day", "Products that stopped moving"],
    result: "Reorders happen before the stock-out, and revenue keeps compounding.",
  },
  {
    icon: Coffee,
    name: "Coffee shops",
    platform: "With the Collective",
    watch: ["Milk, beans and cups running low before the morning rush", "Today's sales against last week, hour by hour", "Reviews and messages waiting on a reply"],
    result: "Shelves full, staff scheduled, every regular answered — by us, in your workspace.",
  },
  {
    icon: Scissors,
    name: "Barber & salon shops",
    platform: "With the Collective",
    watch: ["No-shows and empty chairs tomorrow", "Clients due for a rebooking reminder", "Revenue per chair, week over week"],
    result: "Reminders sent, gaps filled, regulars rebooked — the chair never sits empty.",
  },
  {
    icon: Sparkles,
    name: "Your business",
    platform: "Custom build",
    watch: ["Whatever silently costs you money each week", "The task that only one person knows how to do", "The number you wish you saw every morning"],
    result: "We build the monitor, staff the follow-up, and keep it running.",
  },
];

/* -------------------------------------------------------------- section */

export function Outcomes() {
  return (
    <section id="benefits" className="scroll-mt-24 border-y border-border bg-surface/60 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Why HostOS"
          title={
            <>
              Smarter operations. <span className="text-gradient">Higher earnings.</span> Less risk.
            </>
          }
          description="24/7 monitoring for your business. Stay informed, take action, maximize your profits. We don't just fix bottlenecks — we keep your business in excellent condition, every day, so revenue keeps climbing."
          align="center"
          className="max-w-3xl"
        />

        <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" gap={0.08}>
          {MONITORS.map((m, i) => (
            <StaggerItem key={m.title}>
              <MonitorCard m={m} index={i} />
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="mt-8 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-3 lg:grid-cols-5">
          {BENEFITS.map((b) => (
            <div key={b.label} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <b.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-foreground/90">{b.label}</span>
            </div>
          ))}
        </Reveal>

        <SectionHeading
          eyebrow="Every business"
          title="The same watchfulness, whatever you run."
          description="Turo showed us what 24/7 monitoring is worth. The same discipline — watch the numbers, catch the problem early, do the follow-up — earns its keep in a kitchen, a store, a café or a barber shop."
          align="center"
          className="mt-20 max-w-3xl"
        />

        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" gap={0.06}>
          {BUSINESSES.map((b) => (
            <StaggerItem key={b.name}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent">
                    <b.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">{b.platform}</span>
                </div>
                <h3 className="mt-4 text-[15.5px] font-semibold tracking-tight">{b.name}</h3>
                <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">We watch for</p>
                <ul className="mt-1.5 space-y-1.5">
                  {b.watch.map((w) => (
                    <li key={w} className="flex items-start gap-2 text-[13px] text-foreground/90">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {w}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 flex-1 rounded-xl bg-success-bg/40 px-3 py-2.5 text-[12.5px] leading-relaxed text-foreground/90">
                  <span className="font-semibold text-success">Result · </span>
                  {b.result}
                </p>
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="mt-12 flex flex-col items-center justify-between gap-5 rounded-[1.5rem] border border-border bg-card px-6 py-6 text-center shadow-[var(--shadow-card)] md:flex-row md:text-left">
          <div>
            <p className="text-[22px] font-semibold tracking-tight md:text-[26px]">
              More profit. Fewer problems. <span className="text-gradient">A smoother business.</span>
            </p>
            <p className="mt-1 text-[14px] text-muted-foreground">Built to help you go further — whatever you run.</p>
          </div>
          <Button asChild variant="gradient" size="lg" className="shrink-0">
            <Link href="/#contact">
              Book a free consultation <ArrowRight />
            </Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
