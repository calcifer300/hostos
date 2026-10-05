import { cookies } from "next/headers";
import { LogoIntro } from "@/components/pulse/logo-intro";
import { PinGate } from "@/components/pulse/pin-gate";
import { PulseApp } from "@/components/pulse/pulse-app";
import { ACCESS_COOKIE, verifyToken } from "@/lib/pulse/access";
import { getCocruisersData } from "@/lib/pulse/data";

export const dynamic = "force-dynamic";

/**
 * Matthew's live page, at hostoscollective.com/cocruisers. Read-only. Behind a 4-digit key instead of a Google sign-in:
 * with the key's cookie it draws the fleet (after the logo reveal), without it only the key screen is rendered and nothing is queried.
 */
export default async function CocruisersPage() {
  const jar = await cookies();
  if (!verifyToken(jar.get(ACCESS_COOKIE)?.value)) {
    // The key screen comes first and plain; the logo reveal plays only once the key has been accepted.
    return <PinGate />;
  }
  const data = await getCocruisersData();
  return (
    <>
      <LogoIntro />
      <PulseApp initial={data} />
    </>
  );
}
