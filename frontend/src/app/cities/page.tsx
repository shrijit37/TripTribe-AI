import type { Metadata } from "next";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import { INDEXED_CITIES, toSlug } from "@/lib/seo";

/**
 * `/cities` — the hub the city pages are linked from.
 *
 * Internal links are the other half of ranking: a page no crawler can reach
 * is a page that does not exist. This exists so every city page has an inbound
 * link from a crawlable index, and so a reader has somewhere to browse from
 * when they arrive without a search.
 */
export const metadata: Metadata = {
  title: "Best places to visit — every city we cover",
  description:
    "Every city TripTribe covers, with the highest rated places in each, ranked by traveller reviews.",
  alternates: { canonical: "/cities" },
};

export default function CitiesPage() {
  // Deduped: the curated list names some cities twice when it grew organically,
  // and a page listing Jaipur twice is worse than one listing it once.
  const cities = [...new Set(INDEXED_CITIES)];

  return (
    <SiteChrome>
      <article className="tt-article">
        <header className="tt-article__head">
          <h1>Best places to visit</h1>
          <p className="tt-article__lede">
            {cities.length} cities, each with its highest rated places listed in
            order. Every list is built from traveller reviews rather than a
            guidebook, and every page links through to the planner that turns it
            into a day-by-day route.
          </p>
        </header>

        <ul className="tt-city-grid">
          {cities.map((city) => (
            <li key={city}>
              <Link href={`/best-places-to-visit-in-${toSlug(city)}`}>
                Best places to visit in {city}
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </SiteChrome>
  );
}