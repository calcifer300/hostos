"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Small, dependency-free animated charts drawn with SVG and Framer Motion.
 * Colours come from the chart tokens in globals.css so every chart in the
 * app reads as one system in both themes.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

export interface BarDatum {
  label: string;
  value: number;
  /** Optional second value rendered as a lighter bar behind the first. */
  secondary?: number;
}

export function BarChart({
  data,
  height = 140,
  format = (v) => String(v),
  className,
  highlightLast = true,
}: {
  data: BarDatum[];
  height?: number;
  format?: (v: number) => string;
  className?: string;
  highlightLast?: boolean;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary ?? 0)));

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * 100;
          const hs = ((d.secondary ?? 0) / max) * 100;
          const last = highlightLast && i === data.length - 1;
          return (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex h-full flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {d.secondary !== undefined && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${hs}%` }}
                  transition={{ delay: i * 0.03, duration: 0.7, ease: EASE }}
                  className="absolute inset-x-0 bottom-0 rounded-md bg-chart-1/15"
                />
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(h, d.value > 0 ? 3 : 0)}%` }}
                transition={{ delay: i * 0.04, duration: 0.75, ease: EASE }}
                className={cn(
                  "relative w-full rounded-md transition-[filter] duration-200",
                  last ? "bg-[linear-gradient(180deg,var(--chart-1),var(--chart-2))]" : "bg-chart-1/45 group-hover:bg-chart-1/70"
                )}
              />
              {hover === i && (
                <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-1 text-[11px] shadow-[var(--shadow-card)]">
                  <span className="text-muted-foreground">{d.label} · </span>
                  <span className="font-medium">{format(d.value)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <div key={`${d.label}-l-${i}`} className="flex-1 truncate text-center text-[10px] text-muted-foreground">
            {data.length > 10 && i % 2 === 1 ? "" : d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  width = 160,
  height = 44,
  className,
  tone = "accent",
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  tone?: "accent" | "success" | "danger" | "warning";
}) {
  const id = React.useId();
  if (values.length < 2) return <div style={{ width, height }} className={className} />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - 4 - ((v - min) / span) * (height - 8)] as const);
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${width},${height} L0,${height} Z`;
  const color = { accent: "var(--chart-1)", success: "var(--success)", danger: "var(--danger)", warning: "var(--warning)" }[tone];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      <motion.circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={3}
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, duration: 0.3 }}
      />
    </svg>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color?: string;
}

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function Donut({
  segments,
  size = 128,
  thickness = 14,
  centerLabel,
  centerValue,
  className,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={thickness} />
          {total > 0 &&
            segments.map((s, i) => {
              const len = (s.value / total) * c;
              const dash = `${len} ${c - len}`;
              const el = (
                <motion.circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color ?? PALETTE[i % PALETTE.length]}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  strokeDasharray={dash}
                  initial={{ strokeDashoffset: c }}
                  animate={{ strokeDashoffset: -offset }}
                  transition={{ duration: 1, ease: EASE, delay: i * 0.08 }}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        {(centerLabel || centerValue !== undefined) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && <span className="text-[22px] font-semibold leading-none tracking-tight">{centerValue}</span>}
            {centerLabel && <span className="mt-1 text-[10.5px] text-muted-foreground">{centerLabel}</span>}
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-3 text-[12.5px]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color ?? PALETTE[i % PALETTE.length] }} />
              <span className="truncate text-muted-foreground">{s.label}</span>
            </span>
            <span className="font-medium tabular-nums">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A labelled horizontal bar, for ranked lists (top items, event breakdowns). */
export function RankBar({ label, value, max, format = (v) => String(v), index = 0 }: { label: string; value: number; max: number; format?: (v: number) => string; index?: number }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-[12.5px]">
        <span className="truncate text-foreground/90">{label}</span>
        <span className="shrink-0 font-medium tabular-nums">{format(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: EASE, delay: index * 0.05 }}
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--chart-1),var(--chart-2))]"
        />
      </div>
    </div>
  );
}

/** Animated progress ring for scores (fleet health, sync completeness). */
export function Ring({ value, size = 64, stroke = 6, tone = "accent", label }: { value: number; size?: number; stroke?: number; tone?: "accent" | "success" | "warning" | "danger"; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const color = { accent: "var(--accent)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)" }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-semibold leading-none tabular-nums">{Math.round(clamped)}</span>
        {label && <span className="text-[9px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
