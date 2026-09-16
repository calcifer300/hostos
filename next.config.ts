import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Pin the workspace root to this directory.
   *
   * Turbopack infers the root by walking up for lockfiles, and there is a
   * stray package-lock.json in the user profile directory (C:\Users\AMD) that
   * outranks this project's. Dev builds then resolved node_modules from there
   * and every page 500'd with "Cannot find module 'lucide-react'" — a
   * dependency that is installed, one directory down, in this project.
   *
   * Only dev is affected in practice (a deployment has no such neighbour),
   * but an inferred root is not something to leave to chance either way.
   */
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      // Team portraits uploaded from the editor (public bucket "team").
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // The team-photo upload is a server action carrying one prepared JPEG (~150 KB); the default 1 MB cap leaves no room for a PNG export.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
