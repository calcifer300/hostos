import { LogoIntro } from "@/components/pulse/logo-intro";
import { PulseApp } from "@/components/pulse/pulse-app";
import { getPulseData } from "@/lib/pulse/data";

export const dynamic = "force-dynamic";

/**
 * The owner's live page. Read-only: it draws the snapshot the scanner sends and polls for the next one. The logo reveal
 * plays on every load. Gated by the same middleware as the product, and every query is scoped to the signed-in member's
 * workspace, so a signed-out or unrelated visitor gets nothing.
 */
export default async function PulsePage() {
  const data = await getPulseData();
  return (
    <>
      <LogoIntro />
      <PulseApp initial={data} />
    </>
  );
}
