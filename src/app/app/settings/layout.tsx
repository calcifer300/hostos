import { auth } from "@/auth";
import { SettingsNav } from "@/components/settings/settings-nav";
import { isFounderEmail } from "@/lib/roles/constants";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const founder = isFounderEmail(session?.user?.email);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          How this workspace runs, who is on it, and how HostOS reaches you.
        </p>
      </div>
      <SettingsNav founder={founder} />
      {children}
    </div>
  );
}
