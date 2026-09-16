import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

/**
 * The preview card for links shared on WhatsApp, Facebook, LinkedIn and
 * Slack. Rendered from the same copy as the site, so it can never drift from
 * it. Also reused as the Twitter/X card (twitter-image.tsx).
 *
 * Satori notes: its radial gradients come out inverted (dark core, bright
 * rim), so the glows are stacked flat circles instead; and it ships no bold
 * face, so Inter is fetched from Google Fonts at build time — falling back
 * to the default face if that fetch ever fails rather than failing the build.
 */
export const alt = `${SITE.company} — Smarter operations. Higher earnings. Less risk.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VERTICALS = ["Turo", "DoorDash", "Shopify", "Service Businesses", "Websites & Domains", "Coffee Shops", "Barbershops", "Custom"];

/** A soft glow from four concentric low-alpha discs — what a blurred orb looks like once Satori has had its say. */
function Orb({ x, y, size, rgb }: { x: number; y: number; size: number; rgb: string }) {
  const rings = [1, 0.78, 0.56, 0.34];
  return (
    <div style={{ position: "absolute", left: x, top: y, width: size, height: size, display: "flex" }}>
      {rings.map((r, i) => (
        <div
          key={r}
          style={{
            position: "absolute",
            left: (size * (1 - r)) / 2,
            top: (size * (1 - r)) / 2,
            width: size * r,
            height: size * r,
            borderRadius: 9999,
            background: `rgba(${rgb}, ${0.05 + i * 0.045})`,
          }}
        />
      ))}
    </div>
  );
}

async function loadInter(weight: 500 | 700): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`, {
      // An old Safari UA makes Google Fonts answer with TTF, which Satori can read (it can't read WOFF2).
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1" },
    }).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url);
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const [medium, bold] = await Promise.all([loadInter(500), loadInter(700)]);
  const fonts = [
    medium && { name: "Inter", data: medium, weight: 500 as const, style: "normal" as const },
    bold && { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #09090B 0%, #0F0F17 55%, #16132A 100%)",
          color: "#FAFAFA",
          fontFamily: fonts.length ? "Inter" : "sans-serif",
          fontWeight: 500,
        }}
      >
        <Orb x={760} y={-260} size={720} rgb="99,102,241" />
        <Orb x={-200} y={330} size={620} rgb="56,189,248" />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #6366F1, #38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 30, fontWeight: 700 }}>H</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>{SITE.company}</div>
            <div style={{ fontSize: 18, color: "#A1A1AA" }}>hostoscollective.com</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>Smarter operations. Higher earnings. Less risk.</div>
          <div style={{ fontSize: 27, color: "#C4C4CC", lineHeight: 1.4, maxWidth: 980 }}>
            Virtual assistants, automation, custom systems and websites — all run on HostOS, a dashboard for every line of business.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {VERTICALS.map((v) => (
            <div key={v} style={{ padding: "10px 18px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", fontSize: 20, color: "#E4E4E7" }}>
              {v}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
