import { Logo } from "@/components/brand/logo-mark";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo size="lg" />
      <h1 className="text-[22px] font-semibold tracking-tight">You&rsquo;re offline</h1>
      <p className="max-w-sm text-[14px] leading-relaxed text-muted-foreground">
        HostOS needs a connection to show live data. Your workspace picks up exactly where it was as soon as you&rsquo;re back online.
      </p>
    </div>
  );
}
