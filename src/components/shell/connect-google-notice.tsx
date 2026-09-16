import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Shown on Gmail-derived pages when no Google account is connected. The app
 * itself requires no sign-in (Project Aurora Phase 1) — this is a per-page
 * prompt for the specific data source, not an auth gate.
 */
export function ConnectGoogleNotice({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-muted">
        <Icon className="h-[17px] w-[17px] text-muted-foreground" strokeWidth={1.75} />
      </div>
      <h2 className="mb-2 text-[16px] font-semibold tracking-tight">{title}</h2>
      <p className="text-[14px] leading-relaxed text-muted-foreground">{description}</p>
      <Link
        href="/login"
        className="mt-4 inline-flex items-center rounded-full bg-accent px-4 py-2 text-[13px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Connect Google
      </Link>
    </div>
  );
}
