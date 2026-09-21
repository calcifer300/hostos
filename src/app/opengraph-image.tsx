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
export const alt = `${SITE.company} — Run the business. We’ll run the operations.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const VERTICALS = ["Turo & car rental", "DoorDash & delivery", "Hospitality", "Field services", "Shops", "Property", "Startups"];

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
          background: "linear-gradient(135deg, #e3eaee 0%, #d5dde2 55%, #cfd8e6 100%)",
          color: "#171b27",
          fontFamily: fonts.length ? "Inter" : "sans-serif",
          fontWeight: 500,
        }}
      >
        <Orb x={760} y={-260} size={720} rgb="106,92,245" />
        <Orb x={-200} y={330} size={620} rgb="44,62,243" />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* the mark (src/components/brand/logo-mark.tsx), in flat colours since Satori has no gradients */}
          <svg width="60" height="60" viewBox="0 0 64 64" fill="none">
            <rect x="6" y="6" width="52" height="52" rx="15" stroke="#3B5BFF" strokeWidth="3.25" />
            <path d="M14 44V30a18 18 0 0 1 36 0v8" stroke="#4a5cf5" strokeWidth="3" strokeLinecap="round" />
            <path d="M20.5 50V30a11.5 11.5 0 0 1 23 0v12" stroke="#4a5cf5" strokeWidth="3" strokeLinecap="round" />
            <path d="M26.5 46V30.5a5.5 5.5 0 0 1 11 0v13" stroke="#4a5cf5" strokeWidth="3" strokeLinecap="round" />
            <path d="M32 36v17" stroke="#4a5cf5" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>{SITE.company}</div>
            <div style={{ fontSize: 18, color: "#53628d" }}>hostoscollective.com · Philippines · US hours</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 66, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.5 }}><span>Run the business.</span><span style={{ color: "#2c3ef3" }}>We’ll run the operations.</span></div>
          <div style={{ fontSize: 27, color: "#3a4460", lineHeight: 1.4, maxWidth: 980 }}>
            A trained team, written procedures and one live board — answering your guests, watching your tablets, filing your claims, chasing your estimates.
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {VERTICALS.map((v) => (
            <div key={v} style={{ padding: "10px 18px", borderRadius: 9999, border: "1px solid rgba(23,27,39,0.16)", background: "rgba(255,255,255,0.45)", fontSize: 20, color: "#171b27" }}>
              {v}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
