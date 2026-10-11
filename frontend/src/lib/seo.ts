/**
 * The city-page content layer.
 *
 * Everything here exists for one query: "best places to visit in <city>". The
 * page has to answer it with real, specific, crawlable content — not a landing
 * page that says "plan your trip to X" and makes the reader click to find out.
 * That means the page states the places, their categories, their ratings, and
 * what makes each one worth the trip, all in the HTML the crawler receives.
 */

export interface CatalogueEntry {
  placeId: string;
  name: string;
  category: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  address: string;
  lat: number | null;
  lng: number | null;
  opensToday: string | null;
}

export interface CityCatalogue {
  city: string;
  resolvedName: string;
  centre: { lat: number; lng: number };
  region: string;
  entries: CatalogueEntry[];
  enriched: boolean;
  generatedAt: string;
}

/**
 * The cities the site publishes pages for.
 *
 * A curated list is deliberate: these are the pages linked from the sitemap,
 * submitted for indexing, and linked internally. An unbounded generator would
 * produce thousands of thin pages that Google is entitled to treat as doorway
 * pages — the exact opposite of ranking for anything.
 *
 * Deduped at module scope rather than in each consumer: a duplicate here would
 * emit a duplicate `generateStaticParams` entry, and Next would prerender the
 * same route twice.
 */
const CURATED_CITIES: readonly string[] = [
  "Agra", "Ahmedabad", "Aizawl", "Amritsar", "Anantapur", "Aurangabad", "Ayodhya",
  "Bastar", "Belagavi", "Bengaluru", "Bhopal", "Bhubaneswar",
  "Chandigarh", "Chennai", "Coimbatore", "Cuttack", "Dalhousie", "Darjeeling",
  "Dehradun", "Delhi", "Dharamsala", "Durgapur", "Etawah", "Faridabad",
  "Gangtok", "Gaya", "Goa", "Gokarna", "Gorakhpur", "Gwalior",
  "Hampi", "Haridwar", "Hyderabad", "Indore", "Itanagar",
  "Jabalpur", "Jaipur", "Jaisalmer", "Jodhpur", "Kanyakumari", "Kanpur",
  "Kasauli", "Kochi", "Kodaikanal", "Kohima", "Kollam", "Kota", "Kozhikode",
  "Kumbakonam", "Ladakh", "Leh", "Lucknow", "Ludhiana", "Madurai",
  "Munnar", "Mysuru", "Nagpur", "Nainital", "Nashik", "Panaji",
  "Ootacamund",
  "Rishikesh", "Rohtak", "Shillong", "Shimla", "Siliguri", "Solapur",
  "Srinagar", "Surat", "Thanjavur", "Thekkady", "Thiruvananthapuram",
  "Thrissur", "Tirupati", "Udaipur", "Vadodara", "Varanasi", "Vellore",
  "Vijayawada", "Visakhapatnam", "Warangal",
];

export const INDEXED_CITIES: readonly string[] = [...new Set(CURATED_CITIES)];

/** A city name as a URL slug: lowercase, hyphenated, ASCII. */
export const toSlug = (city: string): string =>
  city
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Recover the display name from a slug.
 *
 * One place that turns a route segment back into a city name, so the two
 * routes that need it cannot drift apart on a compound name like
 * `thiruvananthapuram` or a slug that lost a character.
 */
export const fromSlug = (slug: string): string =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/**
 * "Hawa Mahal" reads as nothing without a category attached. The Google type
 * string is not a sentence, so the reader-facing form is written out — and
 * every claim here is a fact about the place's own data, not an adjective.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  tourist_attraction: "landmark",
  historical_landmark: "historic site",
  museum: "museum",
  monument: "monument",
  castle: "fort",
  art_gallery: "art gallery",
  park: "park and gardens",
  shopping_mall: "market",
  place_of_worship: "temple",
  natural_feature: "natural landmark",
  city_hall: "civic building",
  point_of_interest: "local landmark",
  establishment: "local landmark",
  lodging: "stay",
};

export const categoryLabel = (category: string): string =>
  CATEGORY_LABELS[category] ?? category.replace(/_/g, " ").toLowerCase();

/** `4.5` and `2,913 reviews`, or null when Google has no rating to report. */
export const ratingSummary = (entry: CatalogueEntry): string | null => {
  if (entry.rating == null) return null;
  const stars = entry.rating.toFixed(1);
  const count = entry.reviewCount;
  if (count == null) return `${stars} stars`;
  return `${stars} stars from ${count.toLocaleString("en-IN")} reviews`;
};

/**
 * The page title. The single highest-leverage string on the page for the
 * target query — it must contain the phrase a person would actually type.
 */
export const cityPageTitle = (city: string): string =>
  `Best Places to Visit in ${city} — Ranked by Travellers`;