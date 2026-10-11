/**
 * The place catalogue behind the public city pages.
 *
 * `services/places.js` is built for one traveller's trip: a narrow search,
 * a shortlist, ~20 Enterprise calls. The SEO pages need something different —
 * the same city's best places, readable by a crawler, many times over, without
 * spending that quota again.
 *
 * So this reads from `placeCache`, and only reaches for Places when a place is
 * genuinely missing. Two consequences worth stating plainly:
 *
 *   - a cold city costs one enrichment pass, then serves from disk forever;
 *   - a page whose places are all cached still renders with real ratings and
 *     real opening hours, which is the only thing that makes it worth ranking.
 *
 * Nothing here invents a place. A city Google cannot resolve yields a null
 * catalogue and the page says so rather than describing a city that may not
 * exist.
 */
import { resolveCity, searchNearby, enrichPlaces, isPlacesConfigured } from "./places.js";
import PlaceCacheModel from "../models/placeCacheModel.js";

/**
 * Types a "best places to visit" page should list, and the order they are
 * shown in. Ordered by what a traveller actually ranks: the landmark first,
 * the museum second, the park last.
 */
export const CATALOGUE_TYPES = Object.freeze([
    "tourist_attraction",
    "historical_landmark",
    "museum",
    "monument",
    "castle",
    "art_gallery",
    "park",
    "shopping_mall",
]);

/**
 * Read the cache for a set of place ids, returning a map of id to payload.
 * A database that is not connected is not an error here: the caller falls back
 * to the places it already has rather than failing the page.
 */
const readCache = async (placeIds) => {
    try {
        const rows = await PlaceCacheModel.find({ placeId: { $in: placeIds } }).lean();
        return new Map(rows.map((row) => [row.placeId, row.payload]));
    } catch {
        return new Map();
    }
};

const writeCache = async (entries) => {
    if (entries.length === 0) return;
    try {
        await PlaceCacheModel.bulkWrite(
            entries.map((place) => ({
                updateOne: {
                    filter: { placeId: place.placeId },
                    update: { $set: { placeId: place.placeId, name: place.name, payload: place, enriched: true } },
                    upsert: true,
                },
            })),
            { ordered: false },
        );
    } catch {
        // A cache write is an optimisation. Losing it costs quota, not
        // correctness, so it must never fail a request that already has data.
    }
};

/**
 * One place as a city page needs it: enough to write a sentence a reader can
 * act on, and enough to be honest — a place with no rating is not ranked by
 * one.
 */
export const toCatalogueEntry = (place) => ({
    placeId: place.placeId,
    name: place.name,
    category: place.primaryTypeName ?? place.primaryType ?? "place",
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    priceLevel: place.priceLevel ?? null,
    address: place.address ?? "",
    lat: place.location?.lat ?? null,
    lng: place.location?.lng ?? null,
    opensToday: Array.isArray(place.regularOpeningHours?.weekdayDescriptions)
        ? place.regularOpeningHours.weekdayDescriptions[place.regularOpeningHours.weekdayDescriptions.length - 1] ?? null
        : null,
});

/**
 * Build (or reuse) the catalogue for one city.
 *
 * @param {string} city   city name, as typed
 * @param {number} limit  how many places the page will list
 * @returns {Promise<object|null>} the catalogue, or null when the city cannot
 *   be resolved — the caller renders an honest "no data" page for that.
 */
export const buildCityCatalogue = async (city, { limit = 18 } = {}) => {
    if (!city || !isPlacesConfigured()) return null;

    const [centre] = await resolveCity(city);
    if (!centre?.location) return null;

    // Discovery is Pro and free-tier: no ratings, no hours, but enough to name
    // the places. Re-running it is cheap; the expensive part below is guarded.
    const discovered = await searchNearby({
        latitude: centre.location.lat,
        longitude: centre.location.lng,
        includedTypes: [...CATALOGUE_TYPES],
        radius: 12_000,
        maxResultCount: Math.min(Math.max(limit, 1), 20),
    });

    const ids = discovered.map((place) => place.placeId);
    const cached = await readCache(ids);
    const missing = ids.filter((id) => !cached.has(id));

    if (missing.length > 0) {
        // One GET per missing place, Enterprise. This is the only call that
        // costs anything, and it happens once per place, not once per crawl.
        const { places } = await enrichPlaces(missing);
        await writeCache(places);
        for (const place of places) cached.set(place.placeId, place);
    }

    const entries = discovered
        .map((place) => cached.get(place.placeId) ?? place)
        .map(toCatalogueEntry)
        .filter((entry) => entry.name && entry.lat != null);

    // Rank by a bayesian-ish blend so a 5.0 from nine reviews cannot top the
    // list — the same reasoning the solver applies, and for the same reason: a
    // reader is better served by a place many people liked.
    entries.sort((a, b) => (rankScore(b) ?? -1) - (rankScore(a) ?? -1) ?? 0);

    return {
        city: centre.name || city,
        resolvedName: centre.name,
        centre: centre.location,
        region: centre.address ?? "",
        entries: entries.slice(0, limit),
        // Whether real metadata backs the page. The template must not imply
        // ratings it does not have.
        enriched: entries.some((entry) => entry.rating != null),
        generatedAt: new Date().toISOString(),
    };
};

/** Weighted score: rating matters, review volume buys confidence. */
const rankScore = (entry) => {
    if (entry.rating == null) return null;
    const reviews = entry.reviewCount ?? 0;
    return (reviews / (reviews + 25)) * entry.rating + (25 / (reviews + 25)) * 4.0;
};