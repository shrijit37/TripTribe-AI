/**
 * End-to-end smoke of the real pipeline entry point against live Google data.
 *
 * This deliberately calls `solveItinerary` — the same function the HTTP route
 * calls — rather than re-enacting its stages. A smoke that re-implements the
 * pipeline proves the stages work in isolation and proves nothing about the
 * wiring the user actually hits: it was the reason an enrichment failure
 * surfaced as a raw `partitionIntoDays` throw instead of the pipeline's own
 * EMPTY_POOL error.
 *
 * Requires GOOGLE_PLACES_API_KEY. Routes verification runs only when
 * GOOGLE_ROUTES_API_KEY is also set.
 *
 *   source scripts/infisical-env.sh && node tests/solver.smoke.mjs [city] [days]
 */
import { isPlacesConfigured } from "../services/places.js";
import { computeRoutesOptimized, isRoutesConfigured } from "../services/routes.js";
import { solveItinerary, isMeal } from "../solver/pipeline.js";
import { formatClock } from "../solver/schedule.js";

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
    if (ok) {
        console.log(`PASS  ${label}`);
        passed += 1;
    } else {
        console.log(`FAIL  ${label}${detail ? `\n      ${detail}` : ""}`);
        failed += 1;
    }
};

if (!isPlacesConfigured()) {
    console.error("GOOGLE_PLACES_API_KEY is not set — cannot run the live solver smoke.");
    process.exit(2);
}

const CITY = process.argv[2] || "Jaipur";
const DAYS = Number(process.argv[3]) || 2;
const PER_DAY = 3;
const MODE = "WALK";
const BUDGET = 48000;

console.log(`=== ${CITY}, ${DAYS} days, ${PER_DAY} stops/day, ${MODE} ===\n`);

// ── run the real pipeline ─────────────────────────────────────────────────
console.log("── pipeline ──");
let plan;
try {
    plan = await solveItinerary({
        city: CITY,
        country: "India",
        days: DAYS,
        budget: BUDGET,
        currency: "INR",
        headcount: 2,
        stopsPerDay: PER_DAY,
        travelMode: MODE,
    });
    check("pipeline produced a plan", !!plan);
} catch (error) {
    // A quota exhaustion is an upstream fault, not a solver defect: report it
    // as a skip so a 429 does not masquerade as a broken algorithm.
    const upstream = /429|quota|rate limit/i.test(String(error?.message ?? ""));
    console.log(`${upstream ? "SKIP" : "FAIL"}  pipeline aborted: ${error?.code ?? "UNKNOWN"} — ${error?.message ?? error}`);
    if (upstream) {
        console.log("\nGoogle Place Details quota exhausted. Nothing to verify against; not a solver failure.");
        process.exit(0);
    }
    process.exit(1);
}

// A meal is a food venue, not a stop that happened to win a clock slot:
// `assignMealRoles` gives breakfast/lunch/dinner to at most one stop each, and
// a meal landing between two windows — or arriving after that window's slot is
// taken — carries no role at all. Classify on the place, the same way the
// pipeline does, so this cannot drift from it.
const isMealStop = (stop) => isMeal(stop.place);
const allStops = plan.itinerary.flatMap((d) => d.stops);

console.log(`      city ${plan.city.name} @ ${plan.city.location.lat.toFixed(5)},${plan.city.location.lng.toFixed(5)}`);
console.log(`      ${plan.itinerary.length} day(s), ${allStops.length} stop(s), metrics sizes ${JSON.stringify(plan.metrics.sizes)}`);
if (plan.warnings.length) console.log(`      warnings: ${plan.warnings.join("; ")}`);

// ── structure ─────────────────────────────────────────────────────────────
console.log("\n── structure ──");
check("one entry per requested day", plan.itinerary.length === DAYS,
    `asked ${DAYS}, got ${plan.itinerary.length}`);
check("every day holds at least one stop", plan.itinerary.every((d) => d.stops.length > 0),
    JSON.stringify(plan.itinerary.map((d) => d.stops.length)));
// Pace is an activity budget: meals ride along between activities and never
// take a slot, so `stops.length` is not the thing to compare against PER_DAY.
const activitiesOn = (day) => day.stops.filter((s) => !isMealStop(s)).length;
check("no day exceeds the pace", plan.itinerary.every((d) => activitiesOn(d) <= PER_DAY),
    JSON.stringify(plan.itinerary.map((d) => activitiesOn(d))));
check("no place is scheduled twice", new Set(allStops.map((s) => s.placeId)).size === allStops.length);
check("every stop carries coordinates", allStops.every((s) => s.place?.location?.lat != null));
check("every stop carries a Google placeId", allStops.every((s) => typeof s.placeId === "string" && s.placeId.length > 10));

// ── schedule sanity ───────────────────────────────────────────────────────
console.log("\n── schedule ──");
for (const day of plan.itinerary) {
    console.log(`      day ${day.index} (${day.weekdayName}): ${day.stops.length} stops, ends ${formatClock(day.endMinute)}`);
    for (const stop of day.stops) {
        console.log(`         ${formatClock(stop.arriveAt)}–${formatClock(stop.departAt)}  ${stop.name}${stop.role ? ` [${stop.role}]` : ""}${stop.openedAt ? ` (waited ${stop.waitMinutes}m)` : ""}`);
    }
    for (const drop of day.dropped) {
        console.log(`         dropped: ${drop.name} (${drop.reason})`);
    }
}
check("no stop starts before the day does", allStops.every((s) => s.arriveAt >= 540));
check("no stop overlaps the one before it", plan.itinerary.every((d) =>
    d.stops.every((s, i) => i === 0 || s.arriveAt >= d.stops[i - 1].departAt)));
check("every stop has a real duration", allStops.every((s) => s.departAt > s.arriveAt));
check("no day runs past midnight", plan.itinerary.every((d) => !d.overrunsNight));
// The whole pipeline is deterministic given the same upstream response, so a
// second run must produce byte-identical stops and clock times.
const rerun = await solveItinerary({
    city: CITY, country: "India", days: DAYS, budget: BUDGET,
    currency: "INR", headcount: 2, stopsPerDay: PER_DAY, travelMode: MODE,
});
const stopKey = (p) => JSON.stringify(p.itinerary.map((d) => d.stops.map((s) => [s.placeId, s.arriveAt, s.departAt])));
check("scheduling is reproducible", stopKey(rerun) === stopKey(plan));

// ── meals ─────────────────────────────────────────────────────────────────
console.log("\n── meals ──");
for (const day of plan.itinerary) {
    const names = ["breakfast", "lunch", "dinner"].map((k) => day.meals?.[k]?.name ?? "—");
    console.log(`      day ${day.index}: ${names.join(" / ")}`);
}
check("every scheduled meal is on that day", plan.itinerary.every((d) =>
    ["breakfast", "lunch", "dinner"].every((k) => {
        const meal = d.meals?.[k];
        return !meal || d.stops.some((s) => s.placeId === meal.placeId);
    })));

// ── cost ──────────────────────────────────────────────────────────────────
console.log("\n── cost ──");
const cost = plan.budget;
console.log(`      ${cost.currency}: total ${cost.total}, per day ${cost.perDay}, per person/day ${cost.perPersonPerDay}`);
console.log(`      breakdown ${JSON.stringify(cost.breakdown)}`);
console.log(`      budget ${cost.budget ?? "—"} → feasible ${cost.feasible}${cost.feasible ? "" : ` (short ${cost.shortfall})`}`);
check("cost is labelled an estimate", cost.isEstimate === true);
check("breakdown sums to total",
    Math.abs(Object.values(cost.breakdown).reduce((a, b) => a + b, 0) - cost.total) <= 4,
    `${JSON.stringify(cost.breakdown)} vs ${cost.total}`);
check("a plausible short trip costs a plausible amount", cost.total > 1000 && cost.total < 400000, `${cost.total}`);

// ── verify against real roads ─────────────────────────────────────────────
console.log("\n── verify with Routes (real roads) ──");
if (!isRoutesConfigured()) {
    console.log("SKIP  GOOGLE_ROUTES_API_KEY not set");
} else {
    for (const day of plan.itinerary) {
        if (day.stops.length < 2) {
            console.log(`      day ${day.index}: single stop, nothing to route`);
            continue;
        }
        // Google re-costs the intermediate permutation only — origin and
        // destination are fixed and sit outside it, so N stops send N-1.
        const intermediates = day.stops.slice(0, -1).map((s) => s.place.location);
        const routed = await computeRoutesOptimized({
            origin: day.stops[0].place.location,
            destination: day.stops[day.stops.length - 1].place.location,
            intermediates,
            travelMode: "WALK",
        });
        const realMinutes = routed.totalSeconds / 60;
        const estimated = day.travelMinutes;
        const ratio = estimated / Math.max(1, realMinutes);
        console.log(`      day ${day.index}: estimate ${estimated.toFixed(0)} min vs real ${realMinutes.toFixed(0)} min (ratio ${ratio.toFixed(2)})`);

        check(`day ${day.index} route visits every intermediate`,
            routed.order.length === intermediates.length,
            `sent ${intermediates.length}, got ${routed.order.length}`);
        check(`day ${day.index} route indices are in range`,
            routed.order.every((i) => i >= 0 && i < intermediates.length),
            JSON.stringify(routed.order));
        check(`day ${day.index} real duration is plausible`,
            realMinutes > 0 && realMinutes < 600, `${realMinutes.toFixed(0)} min`);
        // The solver estimates walking; verify against walking. Comparing a
        // walking estimate to driving roads would disagree by the speed ratio.
        check(`day ${day.index} estimate is within 3x of reality`,
            ratio > 0.33 && ratio < 3, `ratio ${ratio.toFixed(2)}`);
    }
}

console.log(`\npassed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
