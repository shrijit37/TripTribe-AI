import type { MetadataRoute } from "next";

/**
 * What crawlers are told.
 *
 * The result page is excluded on purpose: it is a response to a POST carrying
 * the visitor's own budget and days. There is nothing there for an index, and
 * it can only ever render its empty state without that payload — so it is
 * marked noindex rather than left to be crawled and found wanting.
 */
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://triptribe.shrijit.tech";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/result", "/api/", "/health"],
      },
    ],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}