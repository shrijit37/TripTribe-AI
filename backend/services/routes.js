/**
 * Google Routes API client.
 *
 * Two endpoints with very different billing, and the difference drives the
 * whole solver design:
 *
 *   Compute Routes      billed **per query**. Supports
 *                       `optimizeWaypointOrder`, which reorders the stops you
 *                       give it using Google's own road-aware solver and
 *                       returns the order plus the day's real duration and
 *                       distance.
 *   Compute Route Matrix billed **per element** (origins × destinations).
 *                       625 elements per request, and that number is the
 *                       monthly budget, not the per-request one.
 *
 * A full 25×25 matrix for one day is 625 elements — 6.25% of the entire
 * monthly Essentials allowance. Seven days of that exhausts the tier. So the
 * matrix is used only for the intercity leg and for spot-checking the final
 * route; day ordering goes through `computeRoutesOptimized`.
 *
 * Verified limits:
 *   - 625 elements per matrix request (non-TRANSIT, no TRAFFIC_AWARE_OPTIMAL)
 *   - 100 elements if TRAFFIC_AWARE_OPTIMAL or TRANSIT
 *   - 50 origins/destinations max when supplied as address or place ID
 *   - 25 intermediate waypoints max on Compute Routes
 *   - 3,000 queries/min (Routes), 3,000 elements/min (Matrix)
 *
 * SKU escalation is automatic and invisible unless you know it: adding
 * `TRAFFIC_AWARE` or `TRAFFIC_AWARE_OPTIMAL`, or `optimizeWaypointOrder`,
 * moves a request from Essentials to Pro. Plain, traffic-free requests stay
 * Essentials. `routingPreference` is therefore an explicit argument with the
 * cost documented at each choice, never a hidden default.
 */

const ROUTES_BASE = "https://routes.googleapis.com";
const DIRECTIONS_V2 = `${ROUTES_BASE}/directions/v2:computeRoutes`;
const MATRIX_V2 = `${ROUTES_BASE}/distanceMatrix/v2:computeRouteMatrix`;

const TIMEOUT_MS = Number(process.env.ROUTES_TIMEOUT_MS) || 20_000;

export const isRoutesConfigured = () => Boolean(process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_PLACES_API_KEY);

const getApiKey = () => {
    const key = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
        throw new Error("GOOGLE_ROUTES_API_KEY is not configured");
    }
    return key;
};

const request = async (url, body, fieldMask) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": getApiKey(),
                "X-Goog-FieldMask": fieldMask,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text().catch(() => "");
            const error = new Error(`Routes request failed: ${response.status}`);
            error.status = response.status;
            error.detail = text.slice(0, 500);
            throw error;
        }

        return await response.json();
    } finally {
        clearTimeout(timer);
    }
};

/** Routes returns durations as strings like "160s"; never trust a raw number. */
export const parseDurationSeconds = (value) => {
    // NaN is typeof number, so it must be excluded explicitly; letting it
    // through would poison every downstream sum with NaN instead of "unknown".
    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0 ? value : null;
    }
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (trimmed === "") return null;

    if (trimmed.endsWith("s")) {
        const seconds = Number(trimmed.slice(0, -1));
        // A bare "s" parses as Number("") === 0, which would assert a zero-minute
        // leg. Zero is legitimate for a real response, so the *text* is checked,
        // not just the parsed number.
        return Number.isFinite(seconds) && seconds >= 0 && /^[\d.]+s$/.test(trimmed) ? seconds : null;
    }

    // Tolerates the "1h20m" form some responses use. Requires at least one
    // actual component so an empty match cannot fall through as 0.
    const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/);
    if (!match || (!match[1] && !match[2] && !match[3])) return null;

    return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
};

/**
 * Coerce a place into the `{ location: { latLng: … } }` waypoint Routes wants.
 *
 * Two input shapes reach this module: raw `{ lat, lng }` pairs, and normalised
 * places from `services/places.js`, which nest coordinates under
 * `location: { lat, lng }`. Accepting both is deliberate — the solver passes
 * `normalisePlace` output straight through, and silently producing
 * `{latitude: undefined}` would send a request to the middle of the ocean.
 */
export const toLatLng = (place) => {
    const lat = typeof place?.lat === "number" ? place.lat : place?.location?.lat;
    const lng = typeof place?.lng === "number" ? place.lng : place?.location?.lng;

    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("toLatLng requires numeric coordinates, either { lat, lng } or { location: { lat, lng } }");
    }
    return { location: { latLng: { latitude: lat, longitude: lng } } };
};

/**
 * Order one day's stops and get the real traversal time.
 *
 * `optimizeWaypointOrder` is billed at Pro but costs one query rather than N²
 * elements, which is why it is the default path for day ordering.
 * `origin` and `destination` bracket the day. Passing the same hotel for both
 * makes it a loop — start and finish where you slept.
 *
 * Returns `{ order, legs, totalSeconds, totalMeters }` where `order` holds the
 * *original input indices* in Google's chosen sequence, so the caller can map
 * back to its own candidate objects without relying on ids.
 */
export const computeRoutesOptimized = async ({
    origin,
    destination,
    intermediates = [],
    travelMode = "WALK",
    departureTime = null,
    language = "en",
}) => {
    const stops = intermediates.filter(Boolean);
    if (!origin) {
        throw new Error("computeRoutesOptimized requires an origin");
    }
    if (stops.length === 0) {
        return { order: [], legs: [], totalSeconds: 0, totalMeters: 0 };
    }
    if (stops.length > 25) {
        // Google's documented maximum; truncating silently would produce a
        // route that omits stops, so the caller is told instead.
        throw new Error(`A single day may hold at most 25 stops, received ${stops.length}`);
    }

    const body = {
        origin: toLatLng(origin),
        destination: toLatLng(destination ?? origin),
        travelMode,
        // Routes takes `languageCode`; the legacy `language` field is rejected
        // as an unknown name, not ignored.
        languageCode: language,
        // Road-aware reordering. Pro SKU, one query.
        optimizeWaypointOrder: true,
        // Every stop, explicitly non-via: Google rejects waypoint
        // optimisation if any intermediate is a via waypoint.
        intermediates: stops.map((place) => ({ ...toLatLng(place), via: false })),
    };

    // Setting a departure time switches on live traffic and moves the request
    // to Pro; omitting it keeps it on Essentials. Trips are planned before the
    // day happens, so a real ETA is misleading anyway — left off by default.
    if (departureTime) {
        body.departureTime = departureTime;
    }

    const data = await request(
        DIRECTIONS_V2,
        body,
        "routes.optimizedIntermediateWaypointIndex,routes.duration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation"
    );

    const route = data.routes?.[0];
    if (!route) {
        const error = new Error("Routes returned no route");
        error.detail = JSON.stringify(data).slice(0, 300);
        throw error;
    }

    // The optimized indices cover intermediates only; the origin and
    // destination are fixed by us and sit outside the permutation.
    const indices = route.optimizedIntermediateWaypointIndex ?? [];
    const order = Array.isArray(indices) && indices.length > 0 ? indices : stops.map((_, i) => i);

    const legs = (route.legs ?? []).map((leg) => ({
        seconds: parseDurationSeconds(leg.duration),
        meters: typeof leg.distanceMeters === "number" ? leg.distanceMeters : null,
    }));

    return {
        order,
        legs,
        totalSeconds: parseDurationSeconds(route.duration) ?? legs.reduce((sum, leg) => sum + (leg.seconds ?? 0), 0),
        totalMeters: typeof route.distanceMeters === "number"
            ? route.distanceMeters
            : legs.reduce((sum, leg) => sum + (leg.meters ?? 0), 0),
    };
};

/**
 * Full origin × destination matrix — the accurate, expensive path.
 *
 * Billed per element. `elements = origins.length * destinations.length`; the
 * 625 cap is per request, and a caller who exceeds it gets an error rather
 * than a truncated matrix, which is why `MAX_ELEMENTS` is asserted up front.
 *
 * Per-element failures come back in-band (`condition`/`status` on the entry)
 * rather than failing the whole call — a single unroutable pair is normal and
 * must not discard the rest.
 */
export const MAX_ELEMENTS = 625;

export const computeRouteMatrix = async ({ origins, destinations, travelMode = "DRIVE", departureTime = null }) => {
    if (origins.length === 0 || destinations.length === 0) {
        throw new Error("computeRouteMatrix requires at least one origin and one destination");
    }

    const elements = origins.length * destinations.length;
    if (elements > MAX_ELEMENTS) {
        throw new Error(
            `Matrix of ${origins.length}×${destinations.length} = ${elements} elements exceeds the ${MAX_ELEMENTS} per-request maximum; split it or use computeRoutesOptimized`
        );
    }
    if (departureTime && travelMode === "TRANSIT") {
        // 100-element cap when traffic or transit is requested.
        if (elements > 100) {
            throw new Error(`Traffic-aware or transit matrices are capped at 100 elements, received ${elements}`);
        }
    }

    const body = {
        origins: origins.map(toLatLng),
        destinations: destinations.map(toLatLng),
        travelMode,
    };
    if (departureTime) {
        body.departureTime = departureTime;
    }

    const data = await request(
        MATRIX_V2,
        body,
        "originIndex,destinationIndex,duration,distanceMeters,status,condition"
    );

    // Returned as a map keyed "originIndex,destinationIndex" because the
    // response carries no stable ordering guarantee.
    const costs = new Map();
    for (const entry of data ?? []) {
        const key = `${entry.originIndex},${entry.destinationIndex}`;
        costs.set(key, {
            seconds: parseDurationSeconds(entry.duration),
            meters: typeof entry.distanceMeters === "number" ? entry.distanceMeters : null,
            condition: entry.condition ?? null,
            // An in-band error code means this pair is unroutable; recorded
            // rather than thrown so callers can fall back to a straight line.
            ok: (entry.condition ?? "ROUTE_EXISTS") === "ROUTE_EXISTS",
        });
    }

    return { costs, elements };
};

/** Straight-line distance in metres — a fallback, never a substitute for a route. */
export const haversineMeters = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6_371_000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export { MAX_ELEMENTS as MAX_MATRIX_ELEMENTS };