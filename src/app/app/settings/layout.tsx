import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          How this workspace runs, who is on it, and how HostOS reaches you.
        </p>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
