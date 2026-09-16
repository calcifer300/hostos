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
      // Team portraits and landing photographs uploaded from the editors (public buckets "team", "site").
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // The landing intro starts with Unsplash photographs until the Founder uploads his own.
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Photo uploads are server actions: a prepared team portrait is ~150 KB, a 4K landing photograph can be 10 MB+.
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
