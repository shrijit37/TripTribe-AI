/**
 * Server-side access to the city catalogue.
 *
 * Called only from Server Components. The catalogue is built in-process now:
 * this used to be an HTTP call to a second service named by
 * `CATALOGUE_API_URL`, defaulting to `localhost:8080` — so inside a container
 * it pointed at nothing, and every city page quietly fell back to its no-data
 * state while the deploy looked healthy. Calling `buildCityCatalogue` directly
 * means the SEO pages and the planner share one code path and one place cache,
 * and there is no origin left to misconfigure.
 */
import { cache } from "react";
import { buildCityCatalogue } from "@/server/domain/catalogue";
import type { CityCatalogue } from "./seo";

/**
 * Deduplicated per render pass.
 *
 * React's `cache` makes this one upstream request even if a page, its metadata
 * and its JSON-LD all ask for the same city. Without it a single page render
 * would spend three times the quota for one page — the reason the place cache
 * exists at all, and the reason this wrapper has to be kept.
 */
export const getCityCatalogue = cache(
  async (city: string): Promise<CityCatalogue | null> => {
    try {
      return await buildCityCatalogue(city, { limit: 18 });
    } catch {
      // A failed catalogue must not take the route down: the page falls back to
      // its no-data state, which is honest and still crawlable.
      return null;
    }
  },
);
