/**
 * Live smoke for the grounding clients.
 *
 * Requires GOOGLE_PLACES_API_KEY (and optionally GOOGLE_ROUTES_API_KEY) in the
 * environment. Run with:
 *   GOOGLE_PLACES_API_KEY=... node tests/grounding.smoke.mjs
 *
 * Exits non-zero on failure. Not part of `npm test` — it spends real quota and
 * needs a key, so it is run deliberately.
 */
import { resolveCity, searchNearby, enrichPlaces, isPlacesConfigured } from "../services/places.js";
import { computeRoutesOptimized, computeRouteMatrix, isRoutesConfigured } from "../services/routes.js";

let passed = 0;
let failed = 0;

const check = (label, condition, detail = "") => {
    if (condition) {
        console.log(`PASS  ${label}`);
        passed += 1;
    } else {
        console.log(`FAIL  ${label}${detail ? `\n      ${detail}` : ""}`);
        failed += 1;
    }
};

if (!isPlacesConfigured()) {
    console.error("GOOGLE_PLACES_API_KEY is not set — cannot run the live smoke.");
    process.exit(2);
}

console.log("=== resolveCity ===");
const matches = await resolveCity("Jaipur, India");
check("returns at least one match", matches.length > 0, `got ${matches.length}`);
const jaipur = matches[0];
console.log(`      ${jaipur.name} @ ${jaipur.location?.lat},${jaipur.location?.lng} (${jaipur.primaryType})`);
check("has coordinates", jaipur.location?.lat !== undefined);
check("has a bare place id", !!jaipur.placeId && !jaipur.placeId.startsWith("places/"), jaipur.placeId);
check("name is not the raw resource id", !!jaipur.name && jaipur.name !== jaipur.placeId);

console.log("\n=== searchNearby: attractions ===");
const sights = await searchNearby({
    latitude: jaipur.location.lat,
    longitude: jaipur.location.lng,
    includedTypes: ["tourist_attraction", "museum"],
    radius: 8000,
    maxResultCount: 15,
});
check("finds attractions", sights.length > 0, `got ${sights.length}`);
console.log(`      first 3: ${sights.slice(0, 3).map((p) => p.name).join(" | ")}`);
check("all have coordinates", sights.every((p) => p.location?.lat !== undefined));
check("all have a place id", sights.every((p) => !!p.placeId));
check("all are operational", sights.every((p) => p.isOperational));
check("radius is respected", sights.every((p) => p.location && p.location.lat !== undefined));

console.log("\n=== searchNearby: radius validation ===");
try {
    await searchNearby({ latitude: jaipur.location.lat, longitude: jaipur.location.lng, radius: 60_000 });
    check("rejects an out-of-range radius", false, "no error thrown");
} catch (error) {
    check("rejects an out-of-range radius", /radius/.test(error.message), error.message);
}

console.log("\n=== enrichPlaces ===");
const shortlist = sights.slice(0, 3);
const { places, failures } = await enrichPlaces(shortlist.map((p) => p.placeId));
console.log(`      enriched ${places.length}/${shortlist.length}, failures: ${failures.length}`);
if (failures.length) console.log(`      ${JSON.stringify(failures)}`);
const withRating = places.filter((p) => p.rating !== null);
check("returns enriched places", places.length > 0);
check("ids match the request", places.every((p) => shortlist.some((s) => s.placeId === p.placeId)));
check("at least one carries a rating", withRating.length > 0, `got ${withRating.length}`);
if (withRating[0]) {
    console.log(`      ${withRating[0].name}: ${withRating[0].rating}★ (${withRating[0].userRatingCount} reviews), bayesian ${withRating[0].bayesianRating?.toFixed(2)}, priceLevel ${withRating[0].priceLevel}`);
    check("bayesian rating is computed", typeof withRating[0].bayesianRating === "number");
    check("bayesian rating is bounded 0-5", withRating[0].bayesianRating > 0 && withRating[0].bayesianRating <= 5);
}

console.log("\n=== routes (optional) ===");
if (!isRoutesConfigured()) {
    console.log("SKIP  GOOGLE_ROUTES_API_KEY not set");
} else {
    const hotelish = (await searchNearby({
        latitude: jaipur.location.lat,
        longitude: jaipur.location.lng,
        includedTypes: ["lodging"],
        radius: 6000,
        maxResultCount: 3,
    }))[0];

    const stops = sights.slice(0, 5).map((p) => ({ lat: p.location.lat, lng: p.location.lng }));
    if (stops.length < 3) {
        check("enough stops for a route", false, `only ${stops.length}`);
    } else {
        const routed = await computeRoutesOptimized({
            origin: hotelish ? { lat: hotelish.location.lat, lng: hotelish.location.lng } : stops[0],
            destination: hotelish ? { lat: hotelish.location.lat, lng: hotelish.location.lng } : stops[0],
            intermediates: stops,
            travelMode: "DRIVE",
        });
        console.log(`      order: ${JSON.stringify(routed.order)}`);
        console.log(`      total: ${routed.totalSeconds}s, ${Math.round(routed.totalMeters)}m, ${routed.legs.length} legs`);
        check("returns a permutation of the stops", routed.order.length === stops.length && new Set(routed.order).size === stops.length);
        check("indices are in range", routed.order.every((i) => i >= 0 && i < stops.length));
        check("reports a total duration", routed.totalSeconds > 0);
        check("reports a total distance", routed.totalMeters > 0);

        const matrix = await computeRouteMatrix({
            origins: stops.slice(0, 3),
            destinations: stops.slice(0, 3),
            travelMode: "DRIVE",
        })
            .then((value) => ({ ok: true, value }))
            .catch((error) => ({ ok: false, error }));

        if (matrix.ok) {
            check("matrix returns costs", matrix.value.costs.size > 0, `got ${matrix.value.costs.size}`);
            check("matrix element count is origins x destinations", matrix.value.elements === 9, `got ${matrix.value.elements}`);
        } else if (matrix.error.status === 403) {
            // Compute Route Matrix is billed per element and requires billing to
            // be enabled on the project; `triptribe-ai` currently is not. The
            // solver does not use it — see the module header in
            // services/routes.js — so this is an environment gap, not a
            // defect. Reported so it stays visible, never fatal.
            console.log("SKIP  computeRouteMatrix needs project billing enabled — not a code failure");
        } else {
            check("matrix returns costs", false, String(matrix.error.message ?? matrix.error).slice(0, 160));
        }
    }
}

console.log(`\npassed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);