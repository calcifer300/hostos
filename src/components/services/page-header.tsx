import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { routes } from "@/lib/routes";

/** The heading every Service Businesses page shares, in the vertical's colour. */
export function ServicesPageHeader({ title, description, action, back = routes.services, backLabel = "Service dashboard" }: { title: string; description?: string; action?: React.ReactNode; back?: string | null; backLabel?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-2 inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {backLabel}
          </Link>
        )}
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
