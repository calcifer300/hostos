import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Suggestion } from "@/lib/dashboard/queries";

/** Renders a Suggestion's actionLabel as an actual link — internal HostOS route or a real turo.com reservation URL — instead of inert styled text. */
export function SuggestionActionLink({ suggestion, className }: { suggestion: Suggestion; className?: string }) {
  if (!suggestion.href) {
    return <p className={className}>{suggestion.actionLabel}</p>;
  }

  const isExternal = suggestion.href.startsWith("http");

  if (isExternal) {
    return (
      <a href={suggestion.href} target="_blank" rel="noopener noreferrer" className={className}>
        {suggestion.actionLabel}
        <ExternalLink className="ml-1 inline h-3 w-3 align-text-top" />
      </a>
    );
  }

  return (
    <Link href={suggestion.href} className={className}>
      {suggestion.actionLabel} &rarr;
    </Link>
  );
}
