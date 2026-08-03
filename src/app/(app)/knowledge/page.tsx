import { BookOpen } from "lucide-react";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";

export default function KnowledgePage() {
  return (
    <SectionPlaceholder
      icon={BookOpen}
      title="Knowledge"
      description="Your check-in process, house rules, and policies — the facts iHost grounds every reply in. Currently hardcoded in v0.1; this is where you'll edit it directly."
    />
  );
}
