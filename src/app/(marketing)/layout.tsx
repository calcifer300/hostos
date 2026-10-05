import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";

/**
 * Public chrome. Deliberately separate from the product shell: no sidebar,
 * no session reads, no Supabase — this tree must render fast and static for
 * a visitor who has never signed in.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="light flex min-h-screen flex-col bg-background text-foreground">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
