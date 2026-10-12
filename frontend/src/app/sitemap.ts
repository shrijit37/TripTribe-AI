import type { MetadataRoute } from "next";
import { INDEXED_CITIES, toSlug } from "@/lib/seo";

/**
 * The sitemap.
 *
 * This is the list a crawler is handed instead of being left to discover
 * links. Two things make it worth having: every indexed city appears, and the
 * static routes are declared in the order of their importance rather than left
 * for a crawler to rank by link depth.
 */
export const revalidate = 86_400;

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://triptribe.shrijit.tech";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${site}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/cities`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site}/plan`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const cityRoutes: MetadataRoute.Sitemap = INDEXED_CITIES.map((city) => ({
    url: `${site}/best-places-to-visit-in-${toSlug(city)}`,
    lastModified: now,
    changeFrequency: "weekly",
    // Slightly below the homepage: the city pages are the traffic play, but
    // the front door is what they all point back to.
    priority: 0.9,
  }));

  return [...staticRoutes, ...cityRoutes];
}