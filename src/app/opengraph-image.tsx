import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

/**
 * The preview card for links shared on WhatsApp, Facebook, LinkedIn and
 * Slack. Rendered on demand from the same copy as the site, so it can never
 * drift from it. Also reused as the Twitter/X card (twitter-image.tsx).
 */
export const alt = `${SITE.company} — Smarter operations. Higher earnings. Less risk.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          background: "linear-gradient(135deg, #09090B 0%, #101018 60%, #141126 100%)",
          color: "#FAFAFA",
          fontFamily: "Inter, Segoe UI, Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ position: "absolute", top: -160, right: -120, width: 560, height: 560, borderRadius: 9999, background: "radial-gradient(closest-side, rgba(99,102,241,0.45), transparent)" }} />
        <div style={{ position: "absolute", bottom: -220, left: -80, width: 520, height: 520, borderRadius: 9999, background: "radial-gradient(closest-side, rgba(56,189,248,0.28), transparent)" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #6366F1, #38BDF8)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 30, fontWeight: 700 }}>H</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>{SITE.company}</div>
            <div style={{ fontSize: 18, color: "#A1A1AA" }}>hostoscollective.com</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>
            Smarter operations. Higher earnings. Less risk.
          </div>
          <div style={{ fontSize: 28, color: "#C4C4CC", lineHeight: 1.4, maxWidth: 980 }}>
            Virtual assistants, automation, custom systems and websites — all run on HostOS, a dashboard for every line of business.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {["Turo", "DoorDash", "Shopify", "GoDaddy", "Coffee Shops", "Barbershops", "Custom"].map((v) => (
            <div key={v} style={{ padding: "10px 18px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", fontSize: 20, color: "#E4E4E7" }}>
              {v}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
