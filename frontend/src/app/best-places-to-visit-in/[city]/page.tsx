import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteChrome from "@/components/SiteChrome";
import { getCityCatalogue } from "@/lib/catalogue";
import { INDEXED_CITIES, toSlug, fromSlug, cityPageTitle } from "@/lib/seo";
import {
  cityItemListSchema,
  breadcrumbSchema,
  cityFaqs,
  faqSchema,
  ratingSummary,
  categoryLabel,
  type JsonLd,
} from "@/lib/schema";

/**
 * `/best-places-to-visit-in-<city>` — the page built for the query.
 *
 * The whole reason this route exists. A client-rendered SPA sends a crawler an
 * empty div, so this page is rendered on the server, states the answer in the
 * HTML, and marks it up as the ranked list it visually is.
 */

interface PageProps {
  params: Promise<{ city?: string }>;
}

/**
 * Opt in to prerendering this dynamic route.
 *
 * Next 16 does not prerender a dynamic route unless it is told the params are
 * known at build time, and without this every city URL 404s at runtime while
 * the sitemap advertises all of them. Regenerated once a day so a place that
 * closes is eventually dropped from the page rather than served forever.
 */
export const dynamicParams = true;
export const revalidate = 86_400;

/**
 * Prerender every curated city at build time.
 *
 * The catalogue is revalidated daily rather than frozen, so a place that
 * closes is eventually dropped — and a page that takes minutes to generate
 * never blocks a crawler.
 */
export async function generateStaticParams() {
  return INDEXED_CITIES.map((city) => ({ city: toSlug(city) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = (await params).city;
  // A build pass can reach this route with no segment at all. There is no city
  // to describe, so there is no metadata to write.
  if (!slug) return { title: "City not found", robots: { index: false, follow: true } };
  const city = fromSlug(slug);
  const catalogue = await getCityCatalogue(city);
  const title = cityPageTitle(city);

  // A city with no catalogue still gets a real page with a real title: a thin
  // 404 would not be indexed, and a thin honest page might be.
  const description = catalogue
    ? `${catalogue.entries.length} of the best places to visit in ${city}, ranked by traveller reviews. See what each one is, where it is, and what it is rated — then plan the route with TripTribe.`
    : `Places to visit in ${city}, ranked by traveller reviews, with the route between them worked out for you.`;

  return {
    title,
    description,
    alternates: { canonical: `/best-places-to-visit-in-${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/best-places-to-visit-in-${slug}`,
      siteName: "TripTribe",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CityPlacesPage({ params }: PageProps) {
  const slug = (await params).city;
  if (!slug) notFound();
  const city = fromSlug(slug);

  const catalogue = await getCityCatalogue(city);

  // Only a city that is neither curated nor resolvable is a 404. A curated city
  // whose catalogue failed to build renders its no-data state instead — the
  // difference matters to a crawler, which would otherwise drop the URL from
  // the index after one bad fetch.
  if (!catalogue && !INDEXED_CITIES.some((c) => toSlug(c) === slug)) notFound();

  const faqs = catalogue ? cityFaqs(catalogue) : [];
  const schemas: JsonLd[] = [
    breadcrumbSchema(city),
    ...(catalogue ? [cityItemListSchema(catalogue), faqSchema(faqs)] : []),
  ];

  return (
    <SiteChrome>
      <script
        type="application/ld+json"
        // JSON-LD is the page's machine-readable answer. It is data, not
        // markup, so it is serialised here rather than written by hand.
        // `<` is escaped: place names and addresses come from Google, and a
        // single `<` inside a JSON string would close this script tag and
        // turn the rest of the markup into its content. `<` is valid JSON
        // and parses back to the same character.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schemas).replace(/</g, "\\u003c"),
        }}
      />

      <article className="tt-article">
        <nav aria-label="Breadcrumb" className="tt-article__crumbs">
          <Link href="/">Home</Link> <span aria-hidden="true">/</span>{" "}
          <Link href="/cities">Cities</Link> <span aria-hidden="true">/</span>{" "}
          <span aria-current="page">Best places in {city}</span>
        </nav>

        <header className="tt-article__head">
          <h1>Best Places to Visit in {city}</h1>
          <p className="tt-article__lede">
            {catalogue
              ? `${catalogue.entries.length} places in ${city}, ranked by what travellers actually rated. Every entry carries its category, its address and its score — the same places TripTribe sequences into a day-by-day route.`
              : `We are still building the list for ${city}. In the meantime, TripTribe will plan the route for you — give it the city, your budget and your days, and it will sequence the stops. `}
            {!catalogue && (
              <Link className="tt-article__cta" href="/search">
                Plan a trip to {city}
              </Link>
            )}
          </p>
        </header>

        {catalogue && catalogue.entries.length === 0 && (
          <p className="tt-note">
            We have no places on file for {city} yet. Try the planner instead — it
            searches live.
          </p>
        )}

        {catalogue && catalogue.entries.length > 0 && (
          <>
            {/* The answer, as an ordered list. A reader who never sees the
                design still gets the ranked list, in order, with real
                details — which is the content the query is asking for. */}
            <ol className="tt-places">
              {catalogue.entries.map((entry, index) => {
                const rating = ratingSummary(entry);
                return (
                  <li key={entry.placeId} className="tt-place">
                    <p className="tt-place__rank">
                      <span className="tt-place__num">{index + 1}</span>
                      <span className="tt-place__category">
                        {categoryLabel(entry.category)}
                      </span>
                    </p>
                    <h2 className="tt-place__name">{entry.name}</h2>
                    {rating && (
                      <p className="tt-place__rating">
                        <strong>{rating}</strong>
                      </p>
                    )}
                    {entry.address && <p className="tt-place__address">{entry.address}</p>}
                    {entry.opensToday && (
                      <p className="tt-place__hours">{entry.opensToday}</p>
                    )}
                  </li>
                );
              })}
            </ol>

            <section className="tt-article__cta-block">
              <h2>Turn this list into a route</h2>
              <p>
                {city} is spread out. TripTribe takes these places and the ones
                around them, and orders them so each stop leads to the next,
                with meals picked where you will already be and a cost figure
                that fits the budget you set.
              </p>
              <Link className="tt-article__cta" href="/search">
                Plan {city} with TripTribe
              </Link>
            </section>

            <section className="tt-article__faq">
              <h2>Questions about visiting {city}</h2>
              {faqs.map((faq) => (
                <div key={faq.question} className="tt-faq">
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </div>
              ))}
            </section>
          </>
        )}

        <footer className="tt-article__foot">
          <p>
            Places, ratings and opening hours come from Google Places.{" "}
            {catalogue?.enriched
              ? `Checked ${new Date(catalogue.generatedAt).toISOString().slice(0, 10)}.`
              : ""}{" "}
            Verify opening times with the venue before you travel.
          </p>
          <Link href="/cities">Browse all cities</Link>
        </footer>
      </article>
    </SiteChrome>
  );
}