import { notFound } from "next/navigation";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LogoIntro } from "@/components/pulse/logo-intro";
import { PulseApp, type PulsePayload } from "@/components/pulse/pulse-app";
import { normalizeSnapshot } from "@/lib/command/snapshot";

/** Development only: the live page drawn from a made-up sample, so its layout and motion can be looked at without the scanner. */
export const dynamic = "force-dynamic";

function loadSample(): PulsePayload {
  const raw = JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "pulse-sample.json"), "utf8"));
  // the same step the server takes before it stores a snapshot
  return { ...raw, snapshot: normalizeSnapshot(raw.snapshot), serverNow: Date.now() } as PulsePayload;
}

export default function PulsePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const data = loadSample();
  return (
    <>
      <LogoIntro />
      <PulseApp initial={data} />
    </>
  );
}
