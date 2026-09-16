import type { Metadata } from "next";
import { InstallGuide } from "@/components/pwa/install-guide";

export const metadata: Metadata = {
  title: "Install HostOS on iPhone, Android and desktop",
  description: "Add HostOS to your home screen — no App Store or Play Store needed.",
  alternates: { canonical: "/install" },
};

export default function InstallPage() {
  return (
    <div className="px-6 pt-32 pb-24 md:pt-40">
      <InstallGuide />
    </div>
  );
}
