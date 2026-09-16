import type { Metadata } from "next";
import { InstallGuide } from "@/components/pwa/install-guide";

export const metadata: Metadata = { title: "Install app" };

export default function InstallSettingsPage() {
  return (
    <div>
      <p className="mb-4 text-[13px] text-muted-foreground">
        Put HostOS on your phone or desktop as an app — no store, no review queue, same account.
      </p>
      <InstallGuide compact />
    </div>
  );
}
