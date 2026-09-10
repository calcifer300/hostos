import Link from "next/link";
import { ArrowLeft, PlugZap } from "lucide-react";

/**
 * Shown on a detail page when the record couldn't be *read*, as opposed to
 * not existing.
 *
 * Both dynamic routes used to call `notFound()` for either case, because the
 * query layer returned `null` for both. A host opening a live reservation
 * during a database outage was told the trip did not exist — the most alarming
 * possible reading of a transient failure, and one that invites them to go
 * looking for data loss that never happened.
 */
export function DetailUnavailable({
  backHref,
  backLabel,
  title,
  description,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Link
        href={backHref}
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </Link>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-warning-bg">
          <PlugZap className="h-[17px] w-[17px] text-warning" strokeWidth={1.75} />
        </div>
        <h1 className="mb-2 text-[18px] font-semibold tracking-tight">{title}</h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
