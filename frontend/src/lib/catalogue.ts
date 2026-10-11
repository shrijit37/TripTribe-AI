/**
 * Server-side access to the city catalogue.
 *
 * Called only from Server Components. The URL is resolved from the server's
 * own environment because the browser never makes this call — the HTML is
 * already rendered by the time a crawler sees it, which is the entire point of
 * the exercise.
 */
import { cache } from "react";
import type { CityCatalogue } from "./seo";

/**
 * Where the catalogue lives. Inside the deployment this is the internal swarm
 * name (a public hairpin from a container is unreliable — the same reason
 * nginx proxies there); locally it is the dev proxy's own origin.
 */
const CATALOGUE_URL =
  process.env.CATALOGUE_API_URL ?? "http://localhost:8080/api/seo/city-catalogue";

/**
 * Deduplicated per render pass.
 *
 * React's `cache` makes this one upstream request even if a page, its metadata
 * and its JSON-LD all ask for the same city. Without it a single page render
 * would spend three times the quota for one page.
 */
export const getCityCatalogue = cache(
  async (city: string): Promise<CityCatalogue | null> => {
    try {
      const res = await fetch(`${CATALOGUE_URL}?city=${encodeURIComponent(city)}`, {
        // The catalogue is cached for 90 days upstream; a shorter revalidate
        // here would spend quota to build a page that has not changed.
        next: { revalidate: 86_400 },
      });
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return (await res.json()) as CityCatalogue;
    } catch {
      // A failed catalogue must not take the route down: the page falls back to
      // its no-data state, which is honest and still crawlable.
      return null;
    }
  },
);