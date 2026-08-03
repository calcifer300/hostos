import { Bell } from "lucide-react";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";

export default function NotificationsPage() {
  return (
    <SectionPlaceholder
      icon={Bell}
      title="Notifications"
      description="A history of what iHost has flagged and when. Not built yet — today, everything iHost surfaces lives only in the Home briefing."
    />
  );
}
