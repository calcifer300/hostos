import type { MetadataRoute } from "next";
import { getPublicAppUrl } from "@/lib/site";

/** Every public page, once. Add a line here when a marketing page is added. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getPublicAppUrl();
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/about`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/team`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/install`, lastModified, changeFrequency: "monthly", priority: 0.4 },
  ];
}
