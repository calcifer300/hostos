import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Every stat here links somewhere with more detail — no purely decorative
 * numbers. See home-dashboard.tsx for what each one maps to.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  breakdown,
  href,
  tone = "accent",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  breakdown?: string;
  href: string;
  tone?: "accent" | "success" | "warning" | "danger";
}) {
  const toneClasses: Record<typeof tone, string> = {
    accent: "bg-accent/10 text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
  };

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Link
        href={href}
        className="block rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:border-accent/40 hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
          <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", toneClasses[tone])}>
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
        </div>
        <p className="mt-2 text-[26px] font-bold leading-none tracking-tight">{value}</p>
        {breakdown && <p className="mt-1.5 text-[11.5px] text-muted-foreground">{breakdown}</p>}
      </Link>
    </motion.div>
  );
}
