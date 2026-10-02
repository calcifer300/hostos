import { PULSE_NAME } from "@/lib/pulse/brand";

/** What makes the page installable on an iPhone ("Add to Home Screen") or Android ("Install app"), opening straight to the live view. */
export function GET() {
  return Response.json(
    {
      name: PULSE_NAME,
      short_name: "Cruisers Live",
      description: "A live, read-only view of the Colorado Cruisers fleet.",
      id: "/cocruisers",
      start_url: "/cocruisers",
      scope: "/cocruisers",
      display: "standalone",
      orientation: "portrait",
      background_color: "#000000",
      theme_color: "#000000",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
