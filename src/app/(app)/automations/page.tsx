import { Zap } from "lucide-react";
import { SectionPlaceholder } from "@/components/shell/section-placeholder";

export default function AutomationsPage() {
  return (
    <SectionPlaceholder
      icon={Zap}
      title="Automations"
      description="Rules for what iHost is allowed to do on its own — scoped narrowly, per the iHost Charter's Article on autonomous action. Not built yet."
    />
  );
}
