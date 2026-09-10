"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LogIn, LogOut } from "lucide-react";
import { userSignOut } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

function Avatar({ user, size }: { user: SessionUser; size: number }) {
  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  if (user.image) {
    return (
      <Image
        src={user.image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="h-full w-full rounded-full object-cover"
      />
    );
  }

  return (
    <span className="flex h-full w-full items-center justify-center rounded-full bg-accent/10 text-[13px] font-medium text-accent">
      {initial}
    </span>
  );
}

/** Shown beside the name, colored — the rest of `roles` (e.g. "Co-host/VA") stays a plain line underneath, same as before this existed. */
const FOUNDER_TIER_ROLES = new Set(["Founder", "Lead Developer"]);

export function UserMenu({
  user,
  roles = [],
  showDetails = false,
}: {
  user: SessionUser | null;
  /** Real assignments from the user_roles table (lib/roles/queries.ts) — manually granted per-email in Settings, empty for anyone not assigned one. */
  roles?: string[];
  showDetails?: boolean;
}) {
  const primaryTitle = roles.filter((r) => FOUNDER_TIER_ROLES.has(r)).join(" & ");
  const secondaryRoles = roles.filter((r) => !FOUNDER_TIER_ROLES.has(r)).join(" & ");
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) {
    return (
      <Link
        href="/login"
        aria-label="Connect Google"
        className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground"
      >
        <LogIn className="h-3.5 w-3.5" />
        Connect Google
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open account menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2.5 rounded-full transition-opacity hover:opacity-80",
          showDetails && "border border-border py-1 pl-1 pr-3"
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border">
          <Avatar user={user} size={36} />
        </span>
        {showDetails && (
          <span className="flex flex-col whitespace-nowrap text-left leading-tight">
            <span className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-medium">{user.name || "Host"}</span>
              {primaryTitle && <span className="text-[10.5px] font-semibold text-accent">{primaryTitle}</span>}
            </span>
            {secondaryRoles && <span className="text-[11px] text-muted-foreground">{secondaryRoles}</span>}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-border bg-card p-1.5 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center gap-3 px-2.5 py-2.5">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border">
                <Avatar user={user} size={36} />
              </div>
              <div className="min-w-0">
                <p className="flex items-baseline gap-1.5 truncate">
                  <span className="text-[13.5px] font-medium">{user.name || "Host"}</span>
                  {primaryTitle && (
                    <span className="shrink-0 text-[10.5px] font-semibold text-accent">{primaryTitle}</span>
                  )}
                </p>
                {secondaryRoles && <p className="truncate text-[11.5px] text-muted-foreground">{secondaryRoles}</p>}
                <p className="truncate text-[12px] text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="my-1 h-px bg-border" />
            <form action={userSignOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
