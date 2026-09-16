"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Car, ChefHat, PackageSearch, ShieldAlert, ShoppingBag, Store } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Bullets, SectionHeading } from "@/components/marketing/sections";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------- fleet mock */

const BOARD_ROWS = [
  { when: "Starts in 1h 12m", guest: "Rebecca", car: "2023 VW ID.4 · DJIF69", zone: "MT", tone: "text-warning", flag: "Pending DL" },
  { when: "Return overdue 42m", guest: "Lance", car: "2023 VW Atlas · EWPI04", zone: "MT", tone: "text-danger", flag: "Guest waiting" },
  { when: "Starts in 3h 05m", guest: "Mason", car: "2022 Toyota 4Runner · LMF052", zone: "HST", tone: "text-accent", flag: "Verified" },
  { when: "Ends in 5h 40m", guest: "Aubrey", car: "2025 Honda Accord · XJB1390", zone: "CT", tone: "text-foreground", flag: "Checked-in" },
];

function FleetMock() {
  return (
    <div className="gradient-border overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-elevated)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <Car className="h-4 w-4 text-accent" /> Board · 4 fleets
        </div>
        <div className="flex gap-2 font-mono text-[11px] text-muted-foreground">
          <span>HST 06:12</span>
          <span>PT 09:12</span>
          <span>MT 10:12</span>
          <span>CT 11:12</span>
        </div>
      </div>
      <div className="divide-y divide-border">
        {BOARD_ROWS.map((r, i) => (
          <motion.div
            key={r.guest}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: EASE }}
            className="grid grid-cols-[1fr_44px_108px] items-center gap-3 px-5 py-3.5"
          >
            <div className="min-w-0">
              <p className={cn("font-mono text-[12px] font-semibold", r.tone)}>{r.when}</p>
              <p className="mt-0.5 truncate text-[13px]">
                <span className="font-medium">{r.guest}</span>
                <span className="text-muted-foreground"> · {r.car}</span>
              </p>
            </div>
            <span className="rounded-full border border-border px-2 py-0.5 text-center text-[10.5px] text-muted-foreground">{r.zone}</span>
            <>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-center text-[10.5px] font-medium",
                  r.flag === "Pending DL" && "bg-warning-bg text-warning",
                  r.flag === "Guest waiting" && "bg-danger-bg text-danger",
                  r.flag === "Verified" && "bg-success-bg text-success",
                  r.flag === "Checked-in" && "bg-muted text-muted-foreground"
                )}
              >
                {r.flag}
              </span>
            </>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-warning-bg/40 px-5 py-3 text-[12px]">
        <ShieldAlert className="h-3.5 w-3.5 text-warning" />
        <span className="text-foreground">Rebecca&rsquo;s license is unverified 1h before pickup</span>
        <span className="ml-auto text-muted-foreground">Emailed · Task created</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------- restaurant mock */

const MENU_ROWS = [
  { name: "Chicken shawarma bowl", pos: "$13.50", dd: "$12.00", status: "Price", tone: "bg-warning-bg text-warning" },
  { name: "Iced matcha latte", pos: "In stock", dd: "86'd", status: "Availability", tone: "bg-danger-bg text-danger" },
  { name: "Halloumi fries", pos: "$8.00", dd: "—", status: "Missing on DoorDash", tone: "bg-info-bg text-info" },
  { name: "Falafel wrap", pos: "$10.50", dd: "$10.50", status: "In sync", tone: "bg-success-bg text-success" },
];

function RestaurantMock() {
  return (
    <div className="gradient-border overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-elevated)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <ChefHat className="h-4 w-4 text-accent" /> Downtown Kitchen · Menu comparison
        </div>
        <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10.5px] font-medium text-success">Open</span>
      </div>
      <div className="grid grid-cols-3 gap-2 border-b border-border px-5 py-3 text-center">
        {[
          ["Needs update", "3", "text-warning"],
          ["In sync", "128", "text-success"],
          ["Missing", "1", "text-info"],
        ].map(([l, v, t]) => (
          <div key={l}>
            <p className={cn("text-[20px] font-semibold tracking-tight", t)}>{v}</p>
            <p className="text-[10.5px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="divide-y divide-border">
        {MENU_ROWS.map((r, i) => (
          <motion.div
            key={r.name}
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: EASE }}
            className="grid grid-cols-[1.4fr_88px_88px_136px] items-center gap-2 px-5 py-3 text-[12.5px]"
          >
            <span className="truncate font-medium">{r.name}</span>
            <span className="tabular-nums text-muted-foreground">POS {r.pos}</span>
            <span className="tabular-nums text-muted-foreground">DD {r.dd}</span>
            <span className={cn("truncate rounded-full px-2 py-0.5 text-center text-[10.5px] font-medium", r.tone)}>{r.status}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-5 py-3 text-[12px]">
        <Store className="h-3.5 w-3.5 text-accent" />
        <span>Airport Deli paused 12 minutes ago during dinner service</span>
        <span className="ml-auto text-muted-foreground">Alert sent</span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- commerce mock */

const PRODUCT_ROWS = [
  { name: "Linen overshirt · Sand / M", sku: "LN-OS-SND-M", stock: 2, sold: 41, tone: "bg-danger-bg text-danger", label: "Low stock" },
  { name: "Canvas tote · Natural", sku: "CV-TT-NAT", stock: 118, sold: 27, tone: "bg-success-bg text-success", label: "Healthy" },
  { name: "Ceramic mug · Set of 2", sku: "CR-MG-2", stock: 0, sold: 63, tone: "bg-warning-bg text-warning", label: "Sold out" },
  { name: "Wool beanie · Charcoal", sku: "WL-BN-CHR", stock: 34, sold: 12, tone: "bg-success-bg text-success", label: "Healthy" },
];

function CommerceMock() {
  return (
    <div className="gradient-border overflow-hidden rounded-[1.5rem] border border-border bg-card shadow-[var(--shadow-elevated)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <ShoppingBag className="h-4 w-4 text-accent" /> Northside Goods · Inventory
        </div>
        <span className="rounded-full bg-info-bg px-2 py-0.5 text-[10.5px] font-medium text-info">Synced 4m ago</span>
      </div>
      <div className="grid grid-cols-3 gap-2 border-b border-border px-5 py-3 text-center">
        {[
          ["Orders · 7d", "212", "text-foreground"],
          ["Revenue · 7d", "$9,840", "text-success"],
          ["Low stock", "2", "text-danger"],
        ].map(([l, v, t]) => (
          <div key={l}>
            <p className={cn("text-[20px] font-semibold tracking-tight", t)}>{v}</p>
            <p className="text-[10.5px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="divide-y divide-border">
        {PRODUCT_ROWS.map((r, i) => (
          <motion.div
            key={r.sku}
            initial={{ opacity: 0, x: 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: EASE }}
            className="grid grid-cols-[1.5fr_92px_64px_84px] items-center gap-2 px-5 py-3 text-[12.5px]"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{r.name}</span>
              <span className="block font-mono text-[10.5px] text-muted-foreground">{r.sku}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{r.stock} in stock</span>
            <span className="tabular-nums text-muted-foreground">{r.sold} sold</span>
            <span className={cn("rounded-full px-2 py-0.5 text-center text-[10.5px] font-medium", r.tone)}>{r.label}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border bg-danger-bg/30 px-5 py-3 text-[12px]">
        <PackageSearch className="h-3.5 w-3.5 text-danger" />
        <span>Linen overshirt (Sand / M) will sell out in about 2 days</span>
        <span className="ml-auto text-muted-foreground">Task created</span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- sections */

export function FleetOps() {
  return (
    <section id="fleet" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Fleet operations"
            title="Every reservation, watched before it becomes a problem."
            description="Reservations, trips, vehicles, messaging, maintenance, license verification and trip timelines — synced from Turo by the Companion and sorted by what needs you first."
            className="mb-0"
          />
          <Bullets
            items={[
              "Cross-fleet board with per-trip timezone countdowns",
              "License sweep inside the 24-hour upload window",
              "Zero-deductible and thin-margin bookings flagged before pickup",
              "Guest conversations threaded per reservation, with Butler drafts",
              "Fleet dashboard: occupancy, earnings estimates, vehicle timelines",
            ]}
          />
          <Reveal delay={0.1} className="mt-8">
            <Button asChild variant="secondary" size="lg">
              <Link href={routes.app}>
                Open the fleet workspace
                <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>
        <Reveal y={24}>
          <FleetMock />
        </Reveal>
      </div>
    </section>
  );
}

export function RestaurantOps() {
  return (
    <section id="restaurants" className="scroll-mt-24 border-y border-border bg-surface/60 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal y={24} className="order-2 lg:order-1">
          <RestaurantMock />
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionHeading
            eyebrow="Restaurant operations"
            title="Your POS and your DoorDash menu, finally agreeing."
            description="Upload the exports you already have. HostOS matches items by SKU, name and similarity, flags price drift, 86'd items still live on delivery, low stock and missing dishes — then hands you the exact list of changes."
            className="mb-0"
          />
          <Bullets
            items={[
              "Store monitoring: open, paused, closed — with a timeline",
              "Order import and delivery analytics per store",
              "Customer messaging with grounded replies",
              "Inventory support with low-stock alerts and a UPC-A generator",
              "Reporting that the Butler summarises every morning",
            ]}
          />
          <Reveal delay={0.1} className="mt-8">
            <Button asChild variant="secondary" size="lg">
              <Link href={routes.app}>
                Open the restaurant workspace
                <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function CommerceOps() {
  return (
    <section id="commerce" className="scroll-mt-24 px-6 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Commerce operations"
            title="Your store's stock, orders and sales — watched, not checked."
            description="Connect Shopify with a custom-app token (or import its exports) and HostOS keeps products, inventory levels and orders current every hour. Low stock raises a task before the sell-out; sales roll into the same analytics and morning briefing as everything else you run."
            className="mb-0"
          />
          <Bullets
            items={[
              "Shopify Admin API sync, hourly and on demand from the Companion",
              "Low-stock and sold-out alerts with a suggested reorder task",
              "Order volume, revenue and best-sellers per store",
              "CSV import for stores that aren't connected yet",
              "The same roles, notifications and Butler as every other module",
            ]}
          />
          <Reveal delay={0.1} className="mt-8">
            <Button asChild variant="secondary" size="lg">
              <Link href={routes.app}>
                Open the commerce workspace
                <ArrowRight />
              </Link>
            </Button>
          </Reveal>
        </div>
        <Reveal y={24}>
          <CommerceMock />
        </Reveal>
      </div>
    </section>
  );
}
