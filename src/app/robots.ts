import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/site";

/** The marketing site is for search engines; the product and its API are not. */
export default function robots(): MetadataRoute.Robots {
  const base = getPublicAppUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/api/", "/login"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
