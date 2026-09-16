"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Bot, Car, ChefHat, MessageCircle, ShieldAlert, Sparkles } from "lucide-react";
import { Tilt } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";

/**
 * A stylised, animated HostOS dashboard for the hero. Built from the same
 * tokens as the real product so it reads as a preview rather than a
 * screenshot — and animates in ways a screenshot cannot: a chart that draws,
 * a countdown that ticks, a message that arrives.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

function useTicker(start: number) {
  const [seconds, setSeconds] = React.useState(start);
  React.useEffect(() => {
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : start)), 1000);
    return () => clearInterval(id);
  }, [start]);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

const BARS = [42, 58, 51, 74, 66, 88, 79];

function StatTile({ label, value, sub, tone, delay }: { label: string; value: string; sub: string; tone: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: EASE }}
      className="rounded-xl border border-border bg-card/80 p-3"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-[20px] font-semibold leading-none tracking-tight", tone)}>{value}</p>
      <p className="mt-1 text-[10.5px] text-muted-foreground">{sub}</p>
    </motion.div>
  );
}

export function ProductMock({ className }: { className?: string }) {
  const countdown = useTicker(2 * 3600 + 14 * 60 + 9);

  return (
    <Tilt className={cn("relative", className)}>
      {/* Glow behind the card */}
      <div aria-hidden className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_30%,var(--accent-glow),transparent_70%)] blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
        className="gradient-border overflow-hidden rounded-[1.5rem] border border-border bg-surface/90 shadow-[var(--shadow-elevated)] backdrop-blur-xl"
      >
        {/* Window chrome */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
          <div className="rounded-full border border-border bg-muted/60 px-3 py-0.5 text-[10.5px] text-muted-foreground">
            app.hostos — Overview
          </div>
          <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
            </span>
            Live
          </span>
        </div>

        <div className="grid grid-cols-[132px_1fr] max-sm:grid-cols-1">
          {/* Sidebar */}
          <div className="hidden border-r border-border p-3 sm:block">
            {[
              ["Overview", true],
              ["Board", false],
              ["Fleet", false],
              ["Restaurants", false],
              ["Messages", false],
              ["Butler", false],
              ["Insights", false],
            ].map(([label, active], i) => (
              <motion.div
                key={label as string}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.05, duration: 0.4, ease: EASE }}
                className={cn(
                  "mb-0.5 rounded-md px-2 py-1.5 text-[11px]",
                  active ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {label as string}
              </motion.div>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-3 p-3.5">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatTile label="Today's trips" value="14" sub="8 pickups · 6 returns" tone="text-accent" delay={0.55} />
              <StatTile label="Active vehicles" value="31/45" sub="14 available now" tone="text-success" delay={0.62} />
              <StatTile label="Orders today" value="126" sub="$3,210 · 2 stores" tone="text-foreground" delay={0.69} />
              <StatTile label="Needs attention" value="3" sub="1 license · 2 stores" tone="text-warning" delay={0.76} />
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              {/* Chart */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85, duration: 0.6, ease: EASE }}
                className="rounded-xl border border-border bg-card/80 p-3 md:col-span-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-medium">Occupancy · 7 days</p>
                  <span className="text-[10.5px] text-success">↑ 9%</span>
                </div>
                <div className="flex h-[74px] items-end gap-1.5">
                  {BARS.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: 1 + i * 0.07, duration: 0.7, ease: EASE }}
                      className={cn(
                        "flex-1 rounded-md",
                        i === BARS.length - 1
                          ? "bg-[linear-gradient(180deg,var(--accent),var(--accent-2))]"
                          : "bg-accent/25"
                      )}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Board countdown */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95, duration: 0.6, ease: EASE }}
                className="rounded-xl border border-border bg-card/80 p-3 md:col-span-2"
              >
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Starts in</p>
                <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums tracking-tight text-accent">{countdown}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px]">
                  <Car className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">Tesla Model 3 · Kahului, HI</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-success">
                  <ShieldAlert className="h-3 w-3" /> License verified
                </div>
              </motion.div>
            </div>

            {/* Message + Butler */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.15, duration: 0.6, ease: EASE }}
                className="rounded-xl border border-border bg-card/80 p-3"
              >
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium">
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" /> Guest message
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  &ldquo;Hey! Landing at 9:40 — where do I find the lockbox?&rdquo;
                </p>
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.9, duration: 0.5, ease: EASE }}
                  className="mt-2 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-2 text-[10.5px] text-foreground"
                >
                  <span className="mr-1 inline-flex items-center gap-1 text-accent">
                    <Sparkles className="h-3 w-3" /> Butler draft
                  </span>
                  Welcome! The lockbox is on the driver-side window — code arrives 1h before pickup.
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.25, duration: 0.6, ease: EASE }}
                className="rounded-xl border border-border bg-card/80 p-3"
              >
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium">
                  <ChefHat className="h-3.5 w-3.5 text-muted-foreground" /> Store monitor
                </div>
                {[
                  ["Downtown Kitchen", "Open", "text-success"],
                  ["Airport Deli", "Paused · 12m", "text-warning"],
                  ["Eastside Bodega", "Open", "text-success"],
                ].map(([name, status, tone], i) => (
                  <motion.div
                    key={name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.45 + i * 0.1 }}
                    className="flex items-center justify-between py-1 text-[11px]"
                  >
                    <span className="text-foreground">{name}</span>
                    <span className={cn("font-medium", tone)}>{status}</span>
                  </motion.div>
                ))}
                <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <Bot className="h-3 w-3" /> Task created: re-open Airport Deli
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </Tilt>
  );
}
