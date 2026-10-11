import type { CityCatalogue, CatalogueEntry } from "./seo";
import { categoryLabel, ratingSummary } from "./seo";

/**
 * Structured data for the city pages.
 *
 * `ItemList` is the schema that actually matches the query. A reader searching
 * "best places to visit in Jaipur" is asking for a ranked list, and marking the
 * page up as one — with each entry numbered and named — lets a search engine
 * present it as a list rather than as a wall of prose. Each item carries a
 * `TouristAttraction` with its real rating, which is the field that earns a
 * rich result.
 */
export interface JsonLd {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

export const cityItemListSchema = (catalogue: CityCatalogue): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: `Best places to visit in ${catalogue.city}`,
  description: `The highest rated places to visit in ${catalogue.city}, ranked by traveller reviews.`,
  numberOfItems: catalogue.entries.length,
  itemListOrder: "https://schema.org/ItemListOrderDescending",
  itemListElement: catalogue.entries.map((entry, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: entry.name,
    item: attractionSchema(entry, catalogue),
  })),
});

export const attractionSchema = (
  entry: CatalogueEntry,
  catalogue: CityCatalogue,
): JsonLd => {
  const base: JsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: entry.name,
    address: entry.address || `${catalogue.city}, India`,
  };
  // Only claims Google actually backs. An invented `aggregateRating` is worse
  // than none: it is a fabricated review count, which is the exact thing
  // structured data policies exist to prevent.
  if (entry.rating != null && entry.reviewCount != null) {
    base.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: entry.rating,
      reviewCount: entry.reviewCount,
      bestRating: 5,
    };
  }
  return base;
};

export const breadcrumbSchema = (city: string): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "/" },
    { "@type": "ListItem", position: 2, name: "Cities", item: "/cities" },
    {
      "@type": "ListItem",
      position: 3,
      name: `Best places to visit in ${city}`,
      item: `/best-places-to-visit-in-${city.toLowerCase().replace(/\s+/g, "-")}`,
    },
  ],
});

/**
 * The questions a reader actually has about a city, answered on the page.
 * Written as real questions, because that is how the query arrives.
 */
export interface Faq {
  question: string;
  answer: string;
}

export const cityFaqs = (catalogue: CityCatalogue): Faq[] => {
  const city = catalogue.city;
  const top = catalogue.entries[0];
  const rated = catalogue.entries.filter((e) => e.rating != null);
  const best = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];

  const faqs: Faq[] = [
    {
      question: `What are the best places to visit in ${city}?`,
      answer: `${top ? `The highest rated of the ${catalogue.entries.length} places listed here is ${top.name}, a ${categoryLabel(top.category)}${top.rating != null ? ` rated ${top.rating.toFixed(1)} out of 5` : ""}. ` : ""}Every place on this page is ranked by traveller reviews rather than by what a guidebook says, and each one lists the category it belongs to so you can pick by the kind of day you want.`,
    },
    {
      question: `How many places should I visit in ${city}?`,
      answer: `There are ${catalogue.entries.length} places listed for ${city}. Most travellers see three or four in a day, because ${city} is spread out enough that moving between them takes real time. TripTribe sequences the stops so each one leads to the next instead of sending you back across the city.`,
    },
    {
      question: `Which place in ${city} has the highest rating?`,
      answer: best
        ? `${best.name} is the highest rated at ${best.rating?.toFixed(1)} out of 5${best.reviewCount != null ? ` from ${best.reviewCount.toLocaleString("en-IN")} reviews` : ""}. Ratings come from Google and reflect the volume of traveller opinion behind them, not just the score.`
        : `Google has not published enough reviews for the places in ${city} to rank them yet.`,
    },
  ];

  if (catalogue.region) {
    faqs.push({
      question: `Where in ${city} are these places?`,
      answer: `All of them sit within roughly 12 km of ${catalogue.region}, which is what makes them reachable in one trip. The exact address of each is listed on its card.`,
    });
  }

  return faqs;
};

export const faqSchema = (faqs: Faq[]): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
});

export { ratingSummary, categoryLabel };