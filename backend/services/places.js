/**
 * Google Places API (New) client.
 *
 * Every method here declares the exact `X-Goog-FieldMask` it wants, because
 * the mask — not the endpoint — decides which SKU is billed. Adding a field to
 * a mask silently changes the price tier, so the masks are frozen constants
 * with the tier they cost noted beside them, and `assertMaskIsSafe` refuses a
 * mask that would escalate past what the caller budgeted for.
 *
 * Verified tier mapping (Places API New; a field mask is mandatory, omitting it
 * is a hard error):
 *
 *   Nearby Search Pro     id, displayName, location, primaryType, types,
 *                         formattedAddress, photos, businessStatus,
 *                         utcOffsetMinutes, primaryTypeDisplayName
 *   Nearby Search ENT     rating, userRatingCount, priceLevel,
 *                         regularOpeningHours
 *
 *   Place Details ESS     id, location, types, formattedAddress
 *   Place Details PRO     displayName, primaryType, businessStatus,
 *                         utcOffsetMinutes
 *   Place Details ENT     rating, userRatingCount, priceLevel,
 *                         regularOpeningHours
 *
 * Traps this module exists to prevent:
 *   - `location` is Pro on Nearby Search but Essentials on Place Details.
 *   - `rating` / `priceLevel` / `regularOpeningHours` are Enterprise on
 *     *both* endpoints — there is no cheap tier that returns them.
 *   - Atmosphere fields (`servesBreakfast`, `editorialSummary`,
 *     `servesVegetarianFood`) are a *separate* Enterprise+Atmosphere SKU and
 *     are deliberately not requested anywhere below.
 */

const PLACES_BASE = "https://places.googleapis.com/v1";

// Pro tier. Discovery must stay here: these fields are everything the solver
// needs to partition and order days, and nothing else.
const DISCOVERY_MASK = [
    "places.id",
    "places.displayName",
    "places.location",
    "places.primaryType",
    "places.primaryTypeDisplayName",
    "places.types",
    "places.formattedAddress",
    "places.businessStatus",
    "places.utcOffsetMinutes",
    "places.photos",
];

// Enterprise tier. Requested only for places that already survived the solver,
// so the 1,000/month ceiling is spent on the shortlist rather than the pool.
const ENRICHMENT_MASK = [
    "places.id",
    "places.displayName",
    "places.location",
    "places.primaryType",
    "places.types",
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.regularOpeningHours",
    // Pro tier on Place Details, and required here: without it an enriched
    // place reports businessStatus null, so `isOperational` cannot exclude a
    // permanently-closed venue that slipped into the shortlist.
    "places.businessStatus",
];

// Fields that force Enterprise+Atmosphere — a different, more expensive SKU.
const ATMOSPHERE_FIELDS = new Set([
    "editorialSummary",
    "generativeSummary",
    "servesBreakfast",
    "servesLunch",
    "servesDinner",
    "servesVegetarianFood",
    "servesCoffee",
    "reviews",
    "reviewSummary",
    "goodForChildren",
    "reservable",
    "takeout",
    "dineIn",
]);

/**
 * Fail loudly rather than quietly escalating a request's cost.
 *
 * A mask is a price tag: adding `rating` to a discovery call moves it from Pro
 * to Enterprise for every result, not just one. That is the difference between
 * ~50 free trips a month and ~5.
 *
 * `DISCOVERY_MASK` is exempt because Nearby Search bills Enterprise fields per
 * result on the same call, rather than charging a separate Place Details GET
 * per id — the cheaper shape, and the one that kept serving when the project's
 * `GetPlaceRequest per day` quota ran out.
 */
export const assertMaskIsSafe = (mask, { allowEnterprise = false } = {}) => {
    for (const field of mask) {
        const bare = field.replace(/^places\./, "");
        if (ATMOSPHERE_FIELDS.has(bare)) {
            throw new Error(`Field "${field}" is Enterprise+Atmosphere and was not budgeted for`);
        }
        if (!allowEnterprise && ENRICHMENT_MASK.includes(field) && ["rating", "userRatingCount", "priceLevel", "regularOpeningHours"].includes(bare)) {
            throw new Error(`Field "${field}" is Enterprise; this call is budgeted for Pro`);
        }
    }
    return mask;
};

const TIMEOUT_MS = Number(process.env.PLACES_TIMEOUT_MS) || 15_000;

const getApiKey = () => {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
        throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    }
    return key;
};

/** Exposed so the caller can report a degraded state instead of crashing. */
export const isPlacesConfigured = () => Boolean(process.env.GOOGLE_PLACES_API_KEY);

const get = async (path, fieldMask, { allowEnterprise = false } = {}) => {
    // The mask is validated in its canonical `places.`-prefixed form (one
    // source of truth for the SKU guard), then sent bare: Place Details (New)
    // documents its field mask as `id,displayName,rating,…` without the
    // `places.` prefix that the search endpoints require.
    assertMaskIsSafe(fieldMask, { allowEnterprise });
    const wireMask = fieldMask.map((field) => field.replace(/^places\./, "")).join(",");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(`${PLACES_BASE}/${path}`, {
            method: "GET",
            headers: {
                "X-Goog-Api-Key": getApiKey(),
                "X-Goog-FieldMask": wireMask,
            },
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const error = new Error(`Places GET ${path} failed: ${response.status}`);
            error.status = response.status;
            error.detail = text.slice(0, 500);
            throw error;
        }

        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

const post = async (path, body, fieldMask, { allowEnterprise = false } = {}) => {
    assertMaskIsSafe(fieldMask, { allowEnterprise });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(`${PLACES_BASE}/${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": getApiKey(),
                "X-Goog-FieldMask": fieldMask.join(","),
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const error = new Error(`Places ${path} failed: ${response.status}`);
            error.status = response.status;
            error.detail = text.slice(0, 500);
            throw error;
        }

        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

// ── Normalisation ─────────────────────────────────────────────────────────

/**
 * Places returns `places/PLACE_ID` in `id`. The bare id is the key used for
 * caching, deduplication and re-fetching details, so it is stripped once here
 * and never re-derived.
 */
const bareId = (id) => String(id ?? "").replace(/^places\//, "");

/**
 * Convert one raw Place into the shape the solver consumes.
 *
 * `reliability` exists because a 4.6 rating from 9 reviews is not evidence of
 * anything. The solver weights places by `bayesianRating`, not `rating`, so a
 * brand-new 5-star cafe cannot outrank a 4.5 with three thousand reviews.
 */
const normalisePlace = (place) => {
    const rating = typeof place.rating === "number" ? place.rating : null;
    const userRatingCount = typeof place.userRatingCount === "number" ? place.userRatingCount : null;

    return {
        placeId: bareId(place.id),
        name: place.displayName?.text ?? "",
        location: place.location
            ? { lat: place.location.latitude, lng: place.location.longitude }
            : null,
        primaryType: place.primaryType ?? null,
        primaryTypeName: place.primaryTypeDisplayName?.text ?? null,
        types: Array.isArray(place.types) ? place.types : [],
        address: place.formattedAddress ?? "",
        utcOffsetMinutes: typeof place.utcOffsetMinutes === "number" ? place.utcOffsetMinutes : null,
        rating,
        userRatingCount,
        // m = global prior mean, C = prior weight. A venue with no ratings
        // inherits the mean rather than scoring 0, which would let an unknown
        // place look like the worst option available.
        bayesianRating:
            rating === null || userRatingCount === null
                ? null
                : (userRatingCount / (userRatingCount + 25)) * rating + (25 / (userRatingCount + 25)) * 4.0,
        priceLevel: typeof place.priceLevel === "number" ? place.priceLevel : null,
        regularOpeningHours: place.regularOpeningHours ?? null,
        photoName: Array.isArray(place.photos) && place.photos.length > 0 ? place.photos[0].name : null,
        // Permanently-closed and soon-to-close places must never enter the
        // candidate pool; filtering here means no downstream code has to
        // remember to check.
        businessStatus: place.businessStatus ?? null,
        isOperational: place.businessStatus === null || place.businessStatus === "OPERATIONAL",
    };
};

const dedupe = (places) => {
    const byId = new Map();
    for (const place of places) {
        if (!place.placeId) continue;
        if (!place.location) continue; // unusable without coordinates
        const existing = byId.get(place.placeId);
        // Nearby and Text search can return the same place; keep the copy
        // carrying the most metadata so an enrichment is not lost.
        if (!existing || scoreCompleteness(place) > scoreCompleteness(existing)) {
            byId.set(place.placeId, place);
        }
    }
    return [...byId.values()];
};

const scoreCompleteness = (place) =>
    (place.rating !== null ? 1 : 0) +
    (place.priceLevel !== null ? 1 : 0) +
    (place.regularOpeningHours ? 1 : 0) +
    (place.photoName ? 1 : 0);

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Resolve a typed city name to a usable centre point.
 *
 * Pro tier. Returns the best-matching locality; the caller must confirm
 * `city.name` matches what the user typed rather than trusting a single
 * fuzzy result.
 */
export const resolveCity = async (textQuery, { language = "en" } = {}) => {
    // Places API (New) takes `languageCode`; the legacy field `language` is
    // rejected outright with "Unknown name", not ignored.
    const data = await post("places:searchText", { textQuery, languageCode: language, maxResultCount: 5 }, DISCOVERY_MASK);
    const places = dedupe((data.places ?? []).map(normalisePlace));
    return places;
};

/**
 * Discover candidates of a given type around a centre point.
 *
 * Pro tier. `includedTypes` uses the Places type table (`tourist_attraction`,
 * `museum`, `restaurant`, `lodging`, …); omitting it searches all types, which
 * returns noise the solver then has to filter.
 *
 * `radius` must be 0–50000 m; Google rejects anything else.
 */
export const searchNearby = async ({ latitude, longitude, includedTypes, radius = 12_000, maxResultCount = 20, language = "en", rankPreference = "POPULARITY" }) => {
    if (typeof latitude !== "number" || typeof longitude !== "number") {
        throw new Error("searchNearby requires numeric latitude and longitude");
    }
    if (radius <= 0 || radius > 50_000) {
        throw new Error(`radius must be between 0 and 50000 metres, received ${radius}`);
    }

    const body = {
        locationRestriction: {
            circle: { center: { latitude, longitude }, radius },
        },
        languageCode: language,
        maxResultCount: Math.min(Math.max(maxResultCount, 1), 20),
    };
    if (Array.isArray(includedTypes) && includedTypes.length > 0) body.includedTypes = includedTypes;
    if (rankPreference) body.rankPreference = rankPreference;

    const data = await post("places:searchNearby", body, DISCOVERY_MASK);
    return dedupe((data.places ?? []).map(normalisePlace));
};

/**
 * Enrich a shortlist with rating, price tier and opening hours.
 *
 * Enterprise tier — the scarce SKU, 1,000 calls/month globally. Two facts
 * make this expensive:
 *
   1. Place Details (New) is a **GET per place id**. There is no batch
      endpoint, so enriching N places costs N calls.
   2. There is no Essentials or Pro tier that returns `rating`, `priceLevel`
      or `regularOpeningHours` — those fields are Enterprise on every Places
      endpoint.
 *
 * Combined, that fixes the shape of the pipeline: ~20 Enterprise calls per
 * trip is the *whole* budget, so enrichment must run on the solver's
 * shortlist and never on the raw candidate pool. Persist the result and reuse
 * it; see models/placeCacheModel.js.
 *
 * Individual failures are returned as `{ placeId, error }` rather than thrown:
 * one missing place should degrade a plan, not fail it.
 */
export const enrichPlaces = async (placeIds, { concurrency = 4 } = {}) => {
    const ids = [...new Set(placeIds.filter(Boolean))];
    if (ids.length === 0) return [];

    const settled = [];
    // Bounded concurrency: unbounded Promise.all over ~20 calls would burst
    // against Google's per-second limits for no latency benefit at this size.
    for (let i = 0; i < ids.length; i += concurrency) {
        const batch = ids.slice(i, i + concurrency);
        settled.push(
            ...(await Promise.allSettled(
                batch.map((id) => get(`places/${id}`, ENRICHMENT_MASK, { allowEnterprise: true }))
            ))
        );
    }

    const enriched = [];
    const failures = [];
    settled.forEach((outcome, index) => {
        const id = ids[index];
        if (outcome.status === "fulfilled") {
            const place = normalisePlace(outcome.value);
            // The id comes from the response, not the request; guard the two
            // from ever disagreeing so a cached entry cannot be filed wrong.
            if (place.placeId && place.placeId !== id) {
                failures.push({ placeId: id, error: "id mismatch in response" });
                return;
            }
            enriched.push(place);
        } else {
            failures.push({ placeId: id, error: outcome.reason?.message ?? "enrichment failed" });
        }
    });

    return { places: dedupe(enriched), failures };
};

export { DISCOVERY_MASK, ENRICHMENT_MASK, bareId };