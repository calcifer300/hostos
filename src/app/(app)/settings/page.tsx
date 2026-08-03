import { Settings } from "lucide-react";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      icon={Settings}
      title="Settings"
      description="Account, connectors, and how iHost is configured to run. Not built yet."
    />
  );
}
