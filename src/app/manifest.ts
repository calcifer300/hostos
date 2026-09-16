import type { MetadataRoute } from "next";

/**
 * Web app manifest — what makes HostOS installable from the browser on
 * Android (Chrome's "Install app") and iOS (Safari's "Add to Home Screen")
 * without an app store. Served at /manifest.webmanifest by Next.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HostOS — AI operations platform",
    short_name: "HostOS",
    description: "Fleet, restaurant and commerce operations in one AI-powered workspace. Built by HostOS Collective.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#09090B",
    theme_color: "#09090B",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Board", url: "/app/board", description: "Every trip, sorted by what needs you" },
      { name: "Tasks", url: "/app/tasks", description: "What the team is working on" },
      { name: "Messages", url: "/app/messages", description: "Guest and customer conversations" },
    ],
  };
}
