import { Inbox } from "lucide-react";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";

export default function InboxPage() {
  return (
    <SectionPlaceholder
      icon={Inbox}
      title="Inbox"
      description="Every guest conversation in one place, across Turo and Gmail. Not built yet — the Home briefing is where iHost surfaces what needs you until this lands."
    />
  );
}
