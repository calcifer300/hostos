import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { TapFeedback } from "@/components/motion/tap-feedback";
import { SpotlightEffect } from "@/components/motion/spotlight";
import { getPublicAppUrl, SITE } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// the one flourish a headline gets: the serif italic aside, the same as the landing page
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: {
    default: "HostOS by HostOS Collective",
    template: "%s · HostOS",
  },
  description: SITE.description,
  applicationName: "HostOS",
  openGraph: {
    type: "website",
    siteName: "HostOS",
    title: "HostOS Collective — Business solutions and the HostOS platform",
    description: "Virtual assistants, automation, custom systems, websites and marketing — all run on HostOS, a dashboard per line of business.",
  },
  twitter: { card: "summary_large_image", title: "HostOS Collective", description: SITE.tagline },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "HostOS" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#09090B" },
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {children}
          <Toaster />
          <RegisterServiceWorker />
          <TapFeedback />
          <SpotlightEffect />
        </ThemeProvider>
      </body>
    </html>
  );
}
