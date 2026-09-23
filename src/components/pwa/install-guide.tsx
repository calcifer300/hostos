"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Apple, CheckCircle2, Download, MonitorSmartphone, Share, Smartphone, MoreVertical, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { useClientValue } from "@/lib/hooks/use-client-value";

type Platform = "ios" | "android" | "desktop";

// Module-level readers so useClientValue can cache by reference.
const readStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const readPlatform = (): Platform => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Captures Chrome's install prompt so the page can offer a one-tap install
 * on Android and desktop. iOS has no such event — Safari only installs
 * through the Share sheet — so the guide covers both.
 */
export function useInstallPrompt() {
  const [event, setEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const standalone = useClientValue(readStandalone, false);
  const [installedNow, setInstalled] = React.useState(false);
  const installed = standalone || installedNow;

  React.useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setEvent(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = React.useCallback(async () => {
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setEvent(null);
    return outcome === "accepted";
  }, [event]);

  return { canPrompt: Boolean(event), installed, install };
}

function Step({ n, icon: Icon, title, text }: { n: number; icon: React.ElementType; title: string; text: React.ReactNode }) {
  return (
    <StaggerItem className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-[13px] font-semibold text-accent">{n}</span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[14px] font-semibold tracking-tight">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
      </div>
    </StaggerItem>
  );
}

export function InstallGuide({ compact = false }: { compact?: boolean }) {
  const { canPrompt, installed, install } = useInstallPrompt();
  const detected = useClientValue<Platform>(readPlatform, "android");
  const [chosen, setPlatform] = React.useState<Platform | null>(null);
  const platform = chosen ?? detected;

  return (
    <div className={cn(!compact && "mx-auto w-full max-w-3xl")}>
      {!compact && (
        <Reveal className="mb-8">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">Install HostOS</p>
          <h1 className="text-[32px] font-semibold tracking-[-0.025em] md:text-[40px]">HostOS on your phone — no app store needed.</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            HostOS is a progressive web app. Install it from the browser and it opens full-screen from your home screen, with its own icon, on iPhone, iPad, Android and desktop.
          </p>
        </Reveal>
      )}

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        {installed ? (
          <Card padding="md" className="flex items-center gap-3 border-success/40 bg-success-bg">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <p className="text-[13.5px] text-success">HostOS is installed on this device.</p>
          </Card>
        ) : canPrompt ? (
          <Card padding="md" className="flex flex-wrap items-center justify-between gap-3 border-accent/40 bg-accent/5">
            <div>
              <p className="text-[13.5px] font-semibold">One tap to install</p>
              <p className="text-[12.5px] text-muted-foreground">Your browser supports direct installation.</p>
            </div>
            <Button variant="gradient" onClick={install}>
              <Download /> Install HostOS
            </Button>
          </Card>
        ) : null}
      </motion.div>

      <Tabs value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
        <TabsList className="mb-4">
          <TabsTrigger value="ios">
            <Apple className="h-3.5 w-3.5" /> iPhone & iPad
          </TabsTrigger>
          <TabsTrigger value="android">
            <Smartphone className="h-3.5 w-3.5" /> Android
          </TabsTrigger>
          <TabsTrigger value="desktop">
            <MonitorSmartphone className="h-3.5 w-3.5" /> Desktop
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ios">
          <Stagger className="space-y-3" inView={false}>
            <Step n={1} icon={Apple} title="Open hostoscollective.com in Safari" text="Installation only works from Safari on iOS — Chrome and other browsers can't add web apps to the home screen." />
            <Step n={2} icon={Share} title="Tap the Share button" text="The square with an arrow, at the bottom of the screen on iPhone or top-right on iPad." />
            <Step n={3} icon={PlusSquare} title="Choose “Add to Home Screen”" text="Scroll the sheet if you don't see it. Keep the name HostOS and tap Add." />
            <Step n={4} icon={CheckCircle2} title="Open HostOS from your home screen" text="It launches full-screen with its own icon. Sign in with Google once; you stay signed in." />
          </Stagger>
        </TabsContent>

        <TabsContent value="android">
          <Stagger className="space-y-3" inView={false}>
            <Step n={1} icon={Smartphone} title="Open hostoscollective.com in Chrome" text="Samsung Internet and Edge work too; the menu wording differs slightly." />
            <Step n={2} icon={MoreVertical} title="Tap the ⋮ menu (top-right)" text="Or look for the “Install app” banner Chrome shows at the bottom of the page." />
            <Step n={3} icon={Download} title="Choose “Install app” or “Add to Home screen”" text="Confirm in the dialog. Chrome creates a real app entry — it appears in your app drawer, not just as a bookmark." />
            <Step n={4} icon={CheckCircle2} title="Open HostOS from the app drawer" text="It runs full-screen. Notifications and the Companion's alerts still arrive by email; desktop pings need the Chrome extension on a computer." />
          </Stagger>
        </TabsContent>

        <TabsContent value="desktop">
          <Stagger className="space-y-3" inView={false}>
            <Step n={1} icon={MonitorSmartphone} title="Open hostoscollective.com in Chrome, Edge or Brave" text="Desktop installation gives HostOS its own window, dock/taskbar icon and keyboard shortcuts (⌘K works there too)." />
            <Step n={2} icon={Download} title="Click the install icon in the address bar" text="It looks like a monitor with an arrow, at the right end of the URL bar — or use the browser menu → “Install HostOS”." />
            <Step n={3} icon={CheckCircle2} title="Pair the Companion" text="On desktop Chrome, also install the HostOS Companion extension from Connectors so Turo, DoorDash and Shopify sync on their own." />
          </Stagger>
        </TabsContent>
      </Tabs>

      {!compact && (
        <Reveal className="mt-8 rounded-2xl border border-dashed border-border p-5 text-[13px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">Why no app store?</p>
          <p className="mt-1">
            A web app updates the moment HostOS Collective ships, works on every device with a browser, and needs no review queue. Everything you install this way is the same HostOS that runs at hostoscollective.com — same account, same data, same Butler.
          </p>
        </Reveal>
      )}
    </div>
  );
}
