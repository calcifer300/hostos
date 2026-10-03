"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * The proposal's shared furniture: the section frame, the reveal, the cards
 * and the media placeholders. Every proposal section is built from these, so
 * the whole document reads as one piece and a new section costs a few lines.
 *
 * Motion rule, the same one the landing page follows: things arrive once and
 * then hold still. Nothing loops, nothing drifts while the client is reading.
 */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

export function Section({
  id,
  eyebrow,
  title,
  aside,
  lede,
  children,
  tone = "page",
  align = "left",
  className,
}: {
  id: string;
  eyebrow?: string;
  title?: string;
  /** The last words of the headline, set in the serif italic. */
  aside?: string;
  lede?: string;
  children: React.ReactNode;
  tone?: "page" | "surface" | "ink";
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "proposal-section scroll-mt-24 px-6 py-20 md:py-28",
        tone === "surface" && "border-y border-border bg-surface",
        tone === "ink" && "border-y border-white/10 bg-[#0b0d14] text-[#e6ebf5]",
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl">
        {(eyebrow || title) && (
          <Reveal className={cn("mb-12 md:mb-16", align === "center" && "mx-auto max-w-3xl text-center")}>
            {eyebrow && (
              <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--proposal-accent)]">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="headline text-balance text-[32px] leading-[1.06] md:text-[46px]">
                {title}
                {aside && <em> {aside}</em>}
              </h2>
            )}
            {lede && (
              <p className={cn("mt-5 text-pretty text-[16.5px] leading-relaxed text-muted-foreground", align === "center" ? "mx-auto max-w-2xl" : "max-w-3xl")}>
                {lede}
              </p>
            )}
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}

/** The card every list of things is built from. */
export function Panel({
  children,
  className,
  interactive = false,
  glass = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  glass?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]",
        glass && "glass-surface",
        interactive && "transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-[var(--proposal-accent)]/45 hover:shadow-[var(--shadow-card-hover)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/** A small uppercase label above a value — the document's quiet voice. */
export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground", className)}>
      {children}
    </span>
  );
}

export function Figure({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className={cn("text-center", className)}>
      <p className="text-[26px] font-bold leading-none tracking-tight text-[var(--proposal-accent)] md:text-[32px]">{value}</p>
      <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * A video or screenshot slot. Until a capture is uploaded it draws a framed
 * placeholder that still looks deliberate in front of a client — never a
 * broken image or an empty box.
 */
export function Media({
  image,
  video,
  label,
  duration,
  aspect = "video",
  className,
}: {
  image?: string;
  video?: string;
  label: string;
  duration?: string;
  aspect?: "video" | "wide";
  className?: string;
}) {
  const ratio = aspect === "wide" ? "aspect-[21/9]" : "aspect-video";

  if (video) {
    return (
      <div className={cn("overflow-hidden rounded-2xl border border-border bg-black", ratio, className)}>
        <video className="h-full w-full object-cover" src={video} controls playsInline preload="metadata" poster={image || undefined} />
      </div>
    );
  }

  if (image) {
    // eslint-disable-next-line @next/next/no-img-element -- uploads are arbitrary remote URLs; the optimizer would need each host allow-listed
    return <img src={image} alt={label} className={cn("w-full rounded-2xl border border-border object-cover", ratio, className)} />;
  }

  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-gradient-to-br from-surface to-card",
        ratio,
        className
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "radial-gradient(60% 60% at 30% 20%, color-mix(in oklab, var(--proposal-accent) 12%, transparent), transparent 70%), radial-gradient(50% 50% at 80% 80%, color-mix(in oklab, var(--proposal-accent) 8%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex flex-col items-center gap-3 px-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-[var(--proposal-accent)]/30 bg-[var(--proposal-accent)]/10 text-[var(--proposal-accent)]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 translate-x-0.5" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13l11-6.5-11-6.5Z" />
          </svg>
        </span>
        <span className="text-[13px] font-semibold tracking-tight">{label}</span>
        <Label>{duration ? `${duration} · capture pending` : "Capture pending"}</Label>
      </div>
    </div>
  );
}

/** Before → after, the shape used in the tour and the case studies. */
export function BeforeAfter({ before, after }: { before: string; after: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <Label className="text-danger">Before HostOS</Label>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{before}</p>
      </div>
      <div className="rounded-2xl border border-[var(--proposal-accent)]/30 bg-[var(--proposal-accent)]/[0.06] p-4">
        <Label className="text-[var(--proposal-accent)]">After HostOS</Label>
        <p className="mt-2 text-[13.5px] leading-relaxed text-foreground/85">{after}</p>
      </div>
    </div>
  );
}
