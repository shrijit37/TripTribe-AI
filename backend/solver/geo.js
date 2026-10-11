/**
 * Geometry for the day solver.
 *
 * Everything here is a pure function over coordinates. No I/O, no clock, no
 * randomness — the solver's correctness claim rests on determinism, and a
 * non-deterministic step anywhere upstream makes the whole plan unverifiable.
 *
 * The central problem: the optimiser needs a travel cost between two places
 * *before* it knows the order, and calling Routes for every pair is unaffordable
 * (Compute Route Matrix bills per element; a 25×25 day is 625 elements, 6.25%
 * of the entire monthly Essentials allowance). So the solver optimises on an
 * estimate and verifies the chosen legs once, afterwards, with a single
 * `computeRoutesOptimized` call per day.
 *
 * The estimate is straight-line distance × a circuity factor ÷ a mode speed.
 * That is crude but *monotonic*: it preserves the ordering of candidate
 * sequences almost everywhere, which is all an initial ordering needs. The real
 * number replaces it before anything is shown to the traveller.
 */

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;
const toDegrees = (radians) => (radians * 180) / Math.PI;

/**
 * Great-circle distance in metres.
 *
 * Returns null rather than NaN for unusable input: a NaN that enters the
 * objective function silently turns every comparison false, which makes the
 * optimiser return nonsense while still looking like it ran.
 */
export const haversineMeters = (a, b) => {
    const lat1 = a?.lat;
    const lng1 = a?.lng;
    const lat2 = b?.lat;
    const lng2 = b?.lng;

    if (![lat1, lng1, lat2, lng2].every((v) => typeof v === "number" && Number.isFinite(v))) {
        return null;
    }

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Initial bearing from a to b, in degrees clockwise from north. */
export const bearingDegrees = (a, b) => {
    if (![a?.lat, a?.lng, b?.lat, b?.lng].every((v) => typeof v === "number" && Number.isFinite(v))) {
        return null;
    }

    const dLng = toRadians(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(toRadians(b.lat));
    const x =
        Math.cos(toRadians(a.lat)) * Math.sin(toRadians(b.lat)) -
        Math.sin(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.cos(dLng);

    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
};

/**
 * Walking speed in metres per minute, by travel mode.
 *
 * Deliberately below real-world averages (a healthy adult walks ~80 m/min):
 * a plan that reads as optimistic on paper and impossible in the street is
 * worse than one that is merely conservative. These are used for *scheduling*,
 * where over-estimating duration only ever leaves more slack, never less.
 */
const SPEED_M_PER_MIN = Object.freeze({
    WALK: 72,
    TRANSIT: 260, // average including wait and transfer time, not in-vehicle
    DRIVE: 380,   // average urban door-to-door, not open-road
    BICYCLE: 200,
});

/**
 * Road circuity: how much longer a real route is than the straight line.
 *
 * 1.0 means "as the crow flies" (open tundra, straight canal). Real city
 * travel is 1.2–1.5. 1.3 is the standard mid value and is what most
 * open-source routing approximations use. It is applied *consistently*, so it
 * cancels out of comparisons between candidate orders — its job is to convert
 * the estimate into plausible minutes, not to rank sequences.
 */
export const ROAD_CIRCUITY = 1.3;

/**
 * Estimated travel minutes between two places.
 *
 * Returns null when the inputs are unusable, so a caller can tell "no route"
 * apart from "zero minutes".
 */
export const estimateTravelMinutes = (from, to, { mode = "WALK" } = {}) => {
    const straightLine = haversineMeters(from, to);
    if (straightLine === null) return null;

    const speed = SPEED_M_PER_MIN[mode] ?? SPEED_M_PER_MIN.WALK;
    // Below ~150 m nobody waits for a signal; the fixed cost of crossing a road
    // dominates and a purely linear model under-reports short hops.
    const overhead = straightLine < 150 ? 2 : 0;

    return (straightLine * ROAD_CIRCUITY) / speed + overhead;
};

/** Total estimated minutes for an ordered list of places, excluding dwell. */
export const estimateRouteMinutes = (orderedPlaces, { mode = "WALK", anchor = null } = {}) => {
    if (!Array.isArray(orderedPlaces) || orderedPlaces.length === 0) return 0;

    const points = [];
    if (anchor) points.push(anchor.location ?? anchor);
    points.push(...orderedPlaces.map((p) => p.location ?? p));
    if (anchor) points.push(anchor.location ?? anchor);

    let total = 0;
    for (let i = 1; i < points.length; i += 1) {
        total += estimateTravelMinutes(points[i - 1], points[i], { mode }) ?? 0;
    }
    return total;
};

/** Bounding box helpers, for deciding search radii and detecting spread. */

export const centroid = (places) => {
    const points = places.map((p) => p.location ?? p).filter((l) => l && typeof l.lat === "number");
    if (points.length === 0) return null;

    const sumLat = points.reduce((sum, p) => sum + p.lat, 0);
    const sumLng = points.reduce((sum, p) => sum + p.lng, 0);
    return { lat: sumLat / points.length, lng: sumLng / points.length };
};

export const bounds = (places) => {
    const points = places.map((p) => p.location ?? p).filter((l) => l && typeof l.lat === "number");
    if (points.length === 0) return null;

    return points.reduce(
        (acc, p) => ({
            minLat: Math.min(acc.minLat, p.lat),
            maxLat: Math.max(acc.maxLat, p.lat),
            minLng: Math.min(acc.minLng, p.lng),
            maxLng: Math.max(acc.maxLng, p.lng),
        }),
        { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity }
    );
};

/** Largest distance between any two places — how spread out a set really is. */
export const diameterMeters = (places) => {
    const points = places.map((p) => p.location ?? p).filter((l) => l && typeof l.lat === "number");
    let worst = 0;
    for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
            const d = haversineMeters(points[i], points[j]);
            if (d !== null && d > worst) worst = d;
        }
    }
    return worst;
};

/**
 * Scale a metre distance to a 0–1 "closeness" score.
 *
 * Used by the partitioning step so a city spread over 30 km and a compact old
 * town are not clustered on the same absolute threshold. 500 m counts as very
 * close; 10 km is effectively far.
 */
export const closeness = (meters) => {
    if (meters === null || !Number.isFinite(meters)) return 0;
    return Math.exp(-meters / 3000);
};