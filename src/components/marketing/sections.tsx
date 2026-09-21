"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Blocks, Car, Check, ChefHat, Coffee, Globe, Scissors, ShoppingBag, Star, Wrench, type LucideIcon } from "lucide-react";
import { Reveal, Stagger, StaggerItem, AnimatedNumber } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import {
  AUTOMATIONS,
  CHANNELS,
  FEATURES,
  INDUSTRIES,
  INTEGRATIONS,
  PROCESS,
  PROJECTS,
  SERVICES,
  STATS,
  TEAM_POINTS,
  TESTIMONIALS,
  WHY_US,
} from "@/components/marketing/data";
import { routes } from "@/lib/routes";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------- helpers */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <Reveal className={cn("mb-10 max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      <h2 className="text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] md:text-[40px]">{title}</h2>
      {description && <p className="mt-4 text-pretty text-[15.5px] leading-relaxed text-muted-foreground">{description}</p>}
    </Reveal>
  );
}

export function IconBadge({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-rotate-3 group-hover:scale-110",
        className
      )}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  );
}

export function Bullets({ items, className }: { items: readonly string[]; className?: string }) {
  return (
    <ul className={cn("mt-6 space-y-2.5", className)}>
      {items.map((t) => (
        <li key={t} className="flex items-start gap-2.5 text-[14px] text-foreground">
          <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success-bg">
            <Check className="h-3 w-3 text-success" />
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------- who we are */

export function WhoWeAre() {
  return (
    <section id="who" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <SectionHeading
          eyebrow="Who we are"
          title={
            <>
              A business-solutions team that builds the tools <span className="text-gradient">and runs on them.</span>
            </>
          }
          description="HostOS Collective is operators, engineers and support specialists under one roof. We build websites, custom systems and automation, and we staff trained virtual assistants — and every one of us works inside HostOS, the operations platform we built, so the tools we sell are the tools we use to make every task easier."
          className="mb-0"
        />

        <Stagger className="grid grid-cols-2 gap-4">
          {STATS.map((stat) => (
            <StaggerItem key={stat.label} className="spot rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <p className="text-[36px] font-semibold leading-none tracking-tight text-foreground">
                <AnimatedNumber value={stat.value} />
                <span className="text-gradient">{stat.suffix}</span>
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{stat.label}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- services */

export function Services() {
  return (
    <section id="services" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Services"
          title="Save time. Increase efficiency."
          description="Development, automation and people — chosen per business, delivered as one engagement, and run on the same platform."
        />
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" gap={0.05}>
          {SERVICES.map((s) => (
            <StaggerItem key={s.title}>
              <motion.div
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className={cn(
                  "spot group relative h-full overflow-hidden rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40",
                  s.featured ? "gradient-border border-transparent" : "border-border"
                )}
              >
                {s.featured && (
                  <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
                )}
                <div className="flex items-start justify-between gap-3">
                  <IconBadge icon={s.icon} />
                  {s.featured && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-semibold text-accent">Our platform</span>}
                </div>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{s.description}</p>
                {s.featured && (
                  <Link href="#platform" className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
                    See the platform <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- industries */

export function Industries() {
  return (
    <section id="industries" className="scroll-mt-24 border-y border-border bg-surface/60 px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="mb-8 text-center text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            We&rsquo;ve worked with businesses like yours
          </p>
        </Reveal>
        <Reveal delay={0.1} className="marquee-pause relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
          <IndustryRow items={INDUSTRIES} className="animate-marquee" />
          <IndustryRow items={[...INDUSTRIES.slice(5), ...INDUSTRIES.slice(0, 5)]} className="mt-3 animate-marquee-reverse" />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * One marquee row: the chips twice over, so the track can slide by half its
 * width and loop without a seam. The second copy is decoration only.
 */
function IndustryRow({ items, className }: { items: typeof INDUSTRIES; className?: string }) {
  return (
    <div className={cn("flex w-max gap-3", className)}>
      {[...items, ...items].map((i, idx) => (
        <span
          key={`${i.label}-${idx}`}
          aria-hidden={idx >= items.length || undefined}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13px] text-foreground transition-[border-color,scale] duration-200 hover:border-accent/40 hover:scale-105"
        >
          <i.icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- platform */

const LINES = [
  { icon: Car, name: "Turo", platform: "Fleet operations", href: "#fleet", text: "Reservations, vehicles, guest messaging, risk and license checks, the cross-fleet board." },
  { icon: ChefHat, name: "DoorDash", platform: "Restaurant operations", href: "#restaurants", text: "Store monitoring, POS-vs-marketplace menu sync, orders, customer messages, inventory." },
  { icon: ShoppingBag, name: "Shopify", platform: "Commerce operations", href: "#commerce", text: "Products and inventory, orders and fulfilment, low-stock alerts, sales analytics." },
  { icon: Wrench, name: "Service Businesses", platform: "Field operations", href: "#benefits", text: "Auto glass, mobile mechanics, towing, junk removal, HVAC, plumbing, cleaning, lawn care, movers: CRM, dispatch, schedule, work orders and estimates from an industry template." },
  { icon: Globe, name: "Websites & Domains", platform: "Any registrar", href: "#benefits", text: "Every site and domain you look after — Cloudflare, Porkbun, Namecheap or GoDaddy: uptime and SSL checked daily, renewals caught 30 days out." },
  { icon: Coffee, name: "Coffee Shops", platform: "Café operations", href: "#benefits", text: "Sales against last week, stock before the morning rush runs dry, shifts and opening/closing routines." },
  { icon: Scissors, name: "Barbershops", platform: "Barbershop operations", href: "#benefits", text: "Today's chairs, no-shows, clients due for a rebooking reminder, revenue per barber." },
  { icon: Blocks, name: "Build a custom", platform: "Any business", href: "#contact", text: "Your own numbers logged and charted, your checklists, and a build request straight to our engineers." },
];

export function PlatformIntro() {
  return (
    <section id="platform" className="scroll-mt-24 px-6 pt-20 pb-6 md:pt-28 md:pb-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="The HostOS platform"
          title={
            <>
              One workspace. <span className="text-gradient">A dashboard for every line of business.</span>
            </>
          }
          description="HostOS is the operations platform we built for our own clients and our own team. After you sign in you choose the business you're running today — a Turo fleet, DoorDash kitchens, a Shopify store, a service business with technicians in the field, client websites and domains, a coffee shop, a barbershop, or something we build for you — and get a command center with only the tools that work for it. Teams, tasks, notifications, automation and the AI Butler are shared underneath."
          align="center"
          className="max-w-3xl"
        />
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.06}>
          {LINES.map((l) => (
            <StaggerItem key={l.name}>
              <motion.a
                href={l.href}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.99 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="spot group block h-full rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <IconBadge icon={l.icon} />
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">{l.platform}</span>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{l.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{l.text}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
                  Own dashboard <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </motion.a>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- features */

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Features"
          title="Designed around the moments that cost money."
          description="A trip that starts unverified. A store that pauses at 6 pm. A best-seller that sells out overnight. A customer waiting on a reply at 2 am. HostOS is shaped by those moments, not by a feature list."
        />
        <Stagger className="grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 md:grid-cols-3" gap={0.06}>
          {FEATURES.map((f) => (
            <StaggerItem
              key={f.title}
              className={cn(
                "spot group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40",
                f.span === "wide" && "md:col-span-2",
                f.span === "tall" && "md:row-span-2"
              )}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <IconBadge icon={f.icon} />
              <h3 className="mt-4 text-[16px] font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">{f.description}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- automation */

export function Automation() {
  return (
    <section id="automation" className="scroll-mt-24 border-y border-border bg-surface/60 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading
            eyebrow="Automation"
            title="Nothing to click. Nothing to remember."
            description="The Companion runs a schedule of background loops in your browser and HostOS reconciles what arrives. You open the dashboard and it is already current — and when you'd rather automate something that isn't in the box, we build that too."
            className="mb-6"
          />
          <Reveal delay={0.1} className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="lg">
              <Link href={routes.app}>
                Pair the Companion
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a href="#contact">Ask for a custom automation</a>
            </Button>
          </Reveal>
        </div>

        <ol className="relative border-l border-border pl-6">
          {AUTOMATIONS.map((a, i) => (
            <Reveal key={a.title} as="li" delay={i * 0.05} className="relative pb-7 last:pb-0">
              <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">{a.cadence}</p>
              <h3 className="mt-1 text-[15px] font-semibold tracking-tight">{a.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{a.description}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- integrations */

const STATUS_LABEL = { live: "Live", beta: "Beta", soon: "Coming soon" } as const;
const STATUS_TONE = {
  live: "bg-success-bg text-success",
  beta: "bg-info-bg text-info",
  soon: "bg-muted text-muted-foreground",
} as const;

export function Integrations() {
  return (
    <section id="integrations" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Integrations"
          title="Connected to where the work already happens."
          description="Turo and DoorDash through the Companion, Shopify through the Admin API, Gmail and email today; calendar, Slack and SMS next."
        />
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.05}>
          {INTEGRATIONS.map((i) => (
            <StaggerItem
              key={i.name}
              className="spot flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
            >
              <div className="flex items-start justify-between gap-3">
                <IconBadge icon={i.icon} />
                <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-medium", STATUS_TONE[i.status])}>
                  {STATUS_LABEL[i.status]}
                </span>
              </div>
              <h3 className="mt-4 text-[14.5px] font-semibold tracking-tight">{i.name}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{i.description}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- team */

export function Team() {
  return (
    <section id="team" className="scroll-mt-24 border-y border-border bg-surface/60 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <SectionHeading
              eyebrow="Virtual assistance"
              title={
                <>
                  Backed by a trained team — <span className="text-gradient">working inside your workspace.</span>
                </>
              }
              description="Our VAs each bring 5+ years of BPO industry experience. They handle phone, email and chat professionally, trained regularly to stay sharp, consistent and aligned with our standards. And because every one of us uses HostOS to make every task easier, the assistant handling your bookings works from the same board, tasks and messages you see."
              className="mb-6"
            />
            <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-3" gap={0.06}>
              {CHANNELS.map((c) => (
                <StaggerItem key={c.title} className="spot rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                  <c.icon className="h-4 w-4 text-accent" strokeWidth={1.75} />
                  <p className="mt-3 text-[13.5px] font-semibold tracking-tight">{c.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{c.description}</p>
                </StaggerItem>
              ))}
            </Stagger>
            <Reveal delay={0.15} className="mt-6">
              <Button asChild variant="secondary" size="lg">
                <Link href="/team">
                  Meet the team
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>
          </div>

          <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2" gap={0.07}>
            {TEAM_POINTS.map((p) => (
              <StaggerItem key={p.title} className="spot rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40">
                <IconBadge icon={p.icon} />
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{p.description}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- why us */

export function WhyUs() {
  return (
    <section id="why" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <SectionHeading
          eyebrow="Why choose us"
          title={
            <>
              We&rsquo;re more than a service provider. <span className="text-gradient">We&rsquo;re a partner that cares about your success.</span>
            </>
          }
          description="We combine technical expertise with real human support to deliver results that matter — and we measure ourselves on the time and money we save you, not on the size of the invoice."
          className="mb-0"
        />
        <Reveal y={20} className="rounded-[1.5rem] border border-border bg-card p-6 shadow-[var(--shadow-elevated)] md:p-8">
          <Bullets items={WHY_US} className="mt-0 space-y-3" />
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- work */

export function Work() {
  return (
    <section id="work" className="scroll-mt-24 border-y border-border bg-surface/60 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Our work" title="Projects that deliver results." description="A few of the systems we've built and run — each one still in use." />
        <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-3" gap={0.08}>
          {PROJECTS.map((p) => (
            <StaggerItem key={p.title}>
              <motion.article
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="spot group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
              >
                <div className="relative h-36 overflow-hidden border-b border-border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_14%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))]">
                  <div aria-hidden className="bg-grid absolute inset-0 opacity-70" />
                  <p.icon className="absolute bottom-4 left-5 h-8 w-8 text-accent transition-transform duration-500 group-hover:scale-110" strokeWidth={1.5} />
                  <span className="absolute right-4 top-4 rounded-full border border-border bg-card/80 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground backdrop-blur">{p.category}</span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[15.5px] font-semibold tracking-tight">{p.title}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">{p.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- process */

export function Process() {
  return (
    <section id="process" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Our process" title="How we work together." description="Four steps, no surprises — and you're in the loop at every one." />
        <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-4" gap={0.1}>
          {PROCESS.map((s, i) => (
            <StaggerItem key={s.step} className="spot relative rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              {i < PROCESS.length - 1 && <span aria-hidden className="absolute -right-2 top-8 hidden h-px w-4 bg-border md:block" />}
              <p className="text-gradient text-[28px] font-semibold leading-none tracking-tight">{s.step}</p>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{s.description}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- testimonials */

export function Testimonials() {
  return (
    <section id="testimonials" className="scroll-mt-24 border-y border-border bg-surface/60 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Testimonials" title="What our clients say." align="center" />
        <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-3" gap={0.08}>
          {TESTIMONIALS.map((t) => (
            <StaggerItem key={t.name} className="spot flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-[translate,border-color] duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-accent/40">
              <div className="mb-4 flex gap-0.5 text-warning" aria-label="5 stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <p className="flex-1 text-[14px] leading-relaxed text-foreground/90">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-5 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-[12px] font-semibold text-white">
                  {t.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div>
                  <p className="text-[13.5px] font-semibold">{t.name}</p>
                  <p className="text-[12px] text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- CTA */

export function FinalCta() {
  return (
    <section className="px-6 py-20 md:py-28">
      <Reveal className="gradient-border relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-card p-10 text-center shadow-[var(--shadow-elevated)] md:p-16">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,var(--accent-glow),transparent_70%)]" />
        <h2 className="text-balance text-[30px] font-semibold tracking-[-0.025em] md:text-[42px]">
          Let&rsquo;s build <span className="text-gradient">something great</span> together.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-muted-foreground">
          Whether you need a website, automation, virtual support, or just a free strategy call — {SITE.company} is ready to help.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="gradient" size="xl">
            <a href="#contact">
              Book a Free Strategy Call
              <ArrowRight />
            </a>
          </Button>
          <Button asChild variant="secondary" size="xl">
            <Link href={routes.app}>Launch HostOS</Link>
          </Button>
        </div>
        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-muted-foreground">
          {["Free strategy call", "HostOS included", "No password sharing", "Cancel any time"].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-success" /> {t}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
