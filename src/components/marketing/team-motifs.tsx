"use client";

import { Crown } from "lucide-react";
import type { Department } from "@/lib/team/profiles";
import { cn } from "@/lib/utils";

/**
 * A signature per craft: a small animated drawing that says what the person
 * does — gears for operations, rising bars for finance, ripples for
 * marketing — in their colour. Faint in the corner of a tile, large and
 * fainter behind the spotlight. Pure SVG + CSS keyframes (globals.css,
 * "motif-*"), so it costs nothing and stops under reduced motion.
 */
export function RoleMotif({ department, className }: { department: Department; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const body = (() => {
    switch (department) {
      case "leadership":
        return (
          <>
            <circle cx="60" cy="60" r="46" {...common} strokeDasharray="3 9" opacity="0.55" className="motif-spin" />
            <circle cx="60" cy="60" r="30" {...common} strokeDasharray="44 28" className="motif-spin-reverse" />
            <path d="M60 44l4.6 9.4 10.4 1.5-7.5 7.3 1.8 10.3L60 67.6l-9.3 4.9 1.8-10.3-7.5-7.3 10.4-1.5z" fill="currentColor" className="motif-pulse" />
          </>
        );
      case "technology":
        return (
          <>
            <rect x="46" y="46" width="28" height="28" rx="5" {...common} />
            <rect x="54" y="54" width="12" height="12" rx="2" fill="currentColor" opacity="0.5" className="motif-blink" />
            <path d="M16 40h30M74 40h30M16 80h30M74 80h30M60 16v30M60 74v30" {...common} className="motif-flow" opacity="0.8" />
            <circle cx="16" cy="40" r="3" fill="currentColor" /><circle cx="104" cy="40" r="3" fill="currentColor" /><circle cx="16" cy="80" r="3" fill="currentColor" /><circle cx="104" cy="80" r="3" fill="currentColor" />
            <circle cx="60" cy="16" r="3" fill="currentColor" /><circle cx="60" cy="104" r="3" fill="currentColor" />
          </>
        );
      case "operations":
        return (
          <>
            <circle cx="46" cy="54" r="19" {...common} strokeWidth="9" strokeDasharray="6.5 6.5" className="motif-spin" />
            <circle cx="46" cy="54" r="7" {...common} />
            <circle cx="82" cy="78" r="12" {...common} strokeWidth="7" strokeDasharray="5 5" className="motif-spin-reverse" />
            <circle cx="82" cy="78" r="4" {...common} />
          </>
        );
      case "finance":
        return (
          <>
            {[24, 44, 64, 84].map((x, i) => (
              <rect key={x} x={x} y="34" width="12" height="62" rx="3" fill="currentColor" opacity={0.35 + i * 0.15} className="motif-rise" style={{ animationDelay: `${i * 0.35}s` }} />
            ))}
            <path d="M22 70l20-16 20 8 24-30" {...common} strokeWidth="2.5" className="motif-draw" />
            <path d="M78 32h8v8" {...common} strokeWidth="2.5" />
          </>
        );
      case "marketing":
        return (
          <>
            {[0, 1.2, 2.4].map((d) => (
              <circle key={d} cx="60" cy="60" r="34" {...common} className="motif-ripple" style={{ animationDelay: `${d}s` }} />
            ))}
            <path d="M40 52v16h10l18 12V40L50 52z" fill="currentColor" opacity="0.85" />
            <path d="M76 52a12 12 0 0 1 0 16M82 44a20 20 0 0 1 0 32" {...common} />
          </>
        );
      case "sales":
        return (
          <>
            <circle cx="48" cy="60" r="22" {...common} />
            <circle cx="72" cy="60" r="22" {...common} />
            <g className="motif-orbit">
              <circle cx="60" cy="60" r="34" fill="none" stroke="none" />
              <circle cx="60" cy="26" r="4.5" fill="currentColor" />
            </g>
            <circle cx="60" cy="60" r="3" fill="currentColor" className="motif-pulse" />
          </>
        );
      case "content":
        return (
          <>
            <path d="M22 40h76" {...common} strokeWidth="2.5" className="motif-draw" />
            <path d="M22 58h58" {...common} strokeWidth="2.5" className="motif-draw" style={{ animationDelay: "0.6s" }} />
            <path d="M22 76h68" {...common} strokeWidth="2.5" className="motif-draw" style={{ animationDelay: "1.2s" }} />
            <rect x="94" y="69" width="2.5" height="14" rx="1" fill="currentColor" className="motif-blink" />
          </>
        );
      case "support":
        return (
          <>
            <circle cx="60" cy="60" r="34" {...common} opacity="0.5" className="motif-pulse" />
            <path d="M32 66v-8a28 28 0 0 1 56 0v8" {...common} strokeWidth="2.5" />
            <rect x="28" y="62" width="10" height="16" rx="4" fill="currentColor" /><rect x="82" y="62" width="10" height="16" rx="4" fill="currentColor" />
            {[46, 54, 62, 70].map((x, i) => (
              <rect key={x} x={x} y="50" width="4" height="22" rx="2" fill="currentColor" opacity="0.8" className="motif-eq" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
          </>
        );
      case "strategy":
        return (
          <>
            <g className="motif-flicker">
              <circle cx="60" cy="50" r="20" fill="currentColor" opacity="0.28" />
              <path d="M60 16v8M26 50h8M86 50h8M36 26l6 6M84 26l-6 6" {...common} />
            </g>
            <circle cx="60" cy="50" r="18" {...common} />
            <path d="M52 76h16M54 84h12M56 70a10 10 0 0 0 8 0" {...common} />
          </>
        );
      case "projects":
        return (
          <>
            {[22, 50, 78].map((x, i) => (
              <g key={x}>
                <rect x={x} y="22" width="20" height="76" rx="4" {...common} opacity="0.7" />
                <rect x={x + 4} y="28" width="12" height="9" rx="2" fill="currentColor" opacity="0.9" className="motif-slide" style={{ animationDelay: `${i * 0.7}s` }} />
                <rect x={x + 4} y="42" width="12" height="9" rx="2" fill="currentColor" opacity="0.45" className="motif-slide" style={{ animationDelay: `${i * 0.7 + 0.35}s` }} />
              </g>
            ))}
          </>
        );
      case "data":
        return (
          <>
            {[24, 40, 56, 72, 88].map((x, i) => (
              <rect key={x} x={x} y={92 - (i + 1) * 9} width="8" height={(i + 1) * 9} rx="2" fill="currentColor" opacity="0.22" />
            ))}
            <path d="M20 84l18-20 16 10 18-28 14 12 14-20" {...common} strokeWidth="2.5" className="motif-draw" />
            <circle cx="100" cy="38" r="4" fill="currentColor" className="motif-pulse" />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 120 120" className={cn("motif", className)} aria-hidden>
      {body}
    </svg>
  );
}

/** The one seal on the roster: a small crown pill with a light passing over it, so the Founder reads as the Founder at a glance. */
export function FounderSeal({ className, size = "sm" }: { className?: string; size?: "sm" | "md" }) {
  return (
    <span className={cn("seal-shine relative inline-flex items-center gap-1 overflow-hidden rounded-full border border-white/25 bg-[linear-gradient(135deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06))] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_6px_20px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md", size === "sm" ? "px-2 py-0.5 text-[9.5px]" : "px-3 py-1 text-[11px]", className)}>
      <Crown className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.2} /> Founder
    </span>
  );
}
