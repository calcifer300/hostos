import type { Metadata, Viewport } from "next";
import { PULSE_NAME } from "@/lib/pulse/brand";
import "@/components/pulse/pulse.css";

export const metadata: Metadata = {
  title: { absolute: PULSE_NAME + " · Colorado Cruisers" },
  description: "A live, read-only view of the Colorado Cruisers fleet.",
  manifest: "/pulse/manifest.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: PULSE_NAME, statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

/** Phones: fill the whole screen under the notch (safe areas are handled in the page), no pinch-zoom surprises on inputs. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function PulseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
