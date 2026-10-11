/**
 * The planning pipeline: everything deterministic, nothing guessed.
 *
 * Takes the trip's real inputs — city, days, budget, travellers, start date,
 * travel mode — and produces a day-by-day plan whose every claim is computed:
 * which places, which day, what order, what clock time, what cost. The LLM
 * never appears here; it only narrates afterwards (`services/narrate.js`) and
 * cannot alter a single fact.
 *
 * Stages:
 *   1. discover  — Google Places: sights, meals, lodging near the city centre
 *   2. enrich    — Place Details: coordinates, hours, ratings, price levels
 *   3. partition — compact days by geography and quality (dayPartition.js)
 *   4. schedule  — real clock times honouring real opening hours (schedule.js)
 *   5. refill    — a day short of its pace minimum gets the nearest usable
 *                  candidates inserted at the cheapest position
 *   6. cost      — money in code from price levels (cost.js)
 *   7. verify    — optionally re-cost every leg against Google Routes
 */
import {
    resolveCity,
    searchNearby,
    enrichPlaces,
    isPlacesConfigured,
} from "../services/places.js";
import { computeRoutesOptimized, isRoutesConfigured } from "../services/routes.js";
import { haversineMeters, ROAD_CIRCUITY, centroid } from "./geo.js";
import { partitionIntoDays } from "./dayPartition.js";
import { sequenceDay } from "./sequence.js";
import { scheduleDay, weekdayName } from "./schedule.js";
import { costTrip, parseCurrencyCode } from "./cost.js";

/** Google types the discovery pass can query for directly (Nearby Search
 *  `includedTypes`). Google rejects an unknown type with a 400 for the whole
 *  call, so this stays limited to the ones that search verifiably accepts. */
const MEAL_TYPES = new Set([
    "restaurant",
    "cafe",
    "bakery",
    "food_court",
    "fast_food_restaurant",
    "meal_takeaway",
    "ice_cream_shop",
]);

/**
 * Every type that makes a place somewhere to eat.
 *
 * Wider than `MEAL_TYPES` on purpose: a discovered place carries subtypes in
 * its `types` array that the search never asked for — `confectionery` and
 * `tea_house` both arrive off a `restaurant` or `cafe` query and are the
 * reason sweet shops and tea houses were partitioned as attractions (and so
 * counted against the day's pace) instead of riding along as meals.
 */
const FOOD_TYPES = new Set([...MEAL_TYPES, "confectionery", "tea_house"]);

const SIGHT_TYPES = [
    // supported places:searchNearby types only — Google rejects the rest with
    // a 400 ("Unsupported types"), which would fail the whole discovery call.
    "tourist_attraction",
    "museum",
    "historical_landmark",
    "monument",
    "art_gallery",
    "park",
    "castle",
    "shopping_mall",
];

/** Ideal arrival (minutes past midnight) for each meal of a planned day. */
const MEAL_IDEAL = Object.freeze({ breakfast: 9 * 60, lunch: 13 * 60, dinner: 19 * 60 });

/** Clock windows (minutes past midnight) that name a meal. */
const MEAL_WINDOWS = Object.freeze({
    breakfast: [0, 11 * 60],
    lunch: [11 * 60 + 30, 15 * 60 + 30],
    dinner: [18 * 60, 24 * 60],
});

const isMeal = (place) =>
    (place.types ?? []).some((t) => FOOD_TYPES.has(t)) || FOOD_TYPES.has(place.primaryType);

/**
 * Assign breakfast/lunch/dinner to a scheduled day's meal stops by their real
 * arrival time. Deterministic code — not a model decision.
 */
const assignMealRoles = (stops) => {
    const meals = { breakfast: null, lunch: null, dinner: null };
    for (const stop of stops) {
        if (!isMeal(stop.place)) continue;
        for (const [role, [from, to]] of Object.entries(MEAL_WINDOWS)) {
            if (meals[role]) continue;
            if (stop.arriveAt >= from && stop.arriveAt < to) {
                meals[role] = stop;
                stop.role = role;
                break;
            }
        }
    }
    return meals;
};

/**
 * Insert one candidate into a day's order at the position that adds the least
 * travel, and re-schedule. Returns the accepted result or null.
 */
const tryInsert = (ordered, candidate, { weekday, startMinute, mode }) => {
    let best = null;
    for (let position = 0; position <= ordered.length; position += 1) {
        const attempt = [...ordered.slice(0, position), candidate, ...ordered.slice(position)];
        const rescheduled = scheduleDay(attempt, { weekday, startMinute, mode });
        // The candidate must survive scheduling — inserted but immediately
        // dropped by its own opening hours is no improvement.
        const survived = rescheduled.stops.some((s) => s.placeId === candidate.placeId);
        if (!survived) continue;
        if (!best || rescheduled.totalMinutes < best.scheduled.totalMinutes) {
            best = { order: attempt, scheduled: rescheduled };
        }
    }
    return best;
};

/** Max extra walk (metres) from an activity to its meal. Beyond this the meal
 *  is a detour, not a convenience, and would open a dead gap in the day. */
const MEAL_MAX_DETOUR = 1400;

/**
 * Place one meal into an already-scheduled day.
 *
 * Only positions where the meal sits within `MEAL_MAX_DETOUR` of both its
 * neighbours are considered — a meal that hits the ideal clock time but sits
 * 3 km off the route just opens a two-hour hole in the day, which is worse
 * than a meal served slightly early or late. Among the geographically sane
 * positions, pick the one closest to the meal's ideal clock time.
 *
 * Returns {order, scheduled, skew} or null when no candidate fits.
 */
const placeMeal = (order, candidates, role, { weekday, startMinute, mode }) => {
    const ideal = MEAL_IDEAL[role];
    let best = null;

    for (const candidate of candidates) {
        for (let position = 0; position <= order.length; position += 1) {
            const before = order[position - 1] ?? null;
            const after = order[position] ?? null;
            // Locality gate: the meal must be near what precedes and follows it.
            const detourBefore = before ? haversineMeters(before.location, candidate.location) : 0;
            const detourAfter = after ? haversineMeters(candidate.location, after.location) : 0;
            if (detourBefore > MEAL_MAX_DETOUR || detourAfter > MEAL_MAX_DETOUR) continue;

            const attempt = [...order.slice(0, position), candidate, ...order.slice(position)];
            const rescheduled = scheduleDay(attempt, { weekday, startMinute, mode });
            const stop = rescheduled.stops.find((s) => s.placeId === candidate.placeId);
            if (!stop) continue; // dropped by its own opening hours

            const skew = Math.abs(stop.arriveAt - ideal);
            if (!best || skew < best.skew) {
                best = { order: attempt, scheduled: rescheduled, skew, winner: candidate.placeId };
            }
        }
    }
    return best;
};

/**
 * Attach breakfast/lunch/dinner to a day: each meal takes the unused candidate
 * nearest the day's centroid, slotted at the position closest to its ideal
 * time. Meals never displace an activity — they ride along between stops.
 */
const attachMeals = (scheduled, candidates, { weekday, startMinute, mode }) => {
    let order = scheduled.stops.map((s) => s.place);
    let current = scheduled;
    const attached = [];

    for (const role of ["breakfast", "lunch", "dinner"]) {
        // Only candidates near this day's route are worth trying — a meal on
        // the far side of town cannot be "conveniently located near the day's
        // attractions", and `placeMeal` would reject it anyway.
        const local = candidates.filter(
            (c) =>
                !attached.includes(c.placeId) &&
                !order.some((p) => p.placeId === c.placeId) &&
                order.some((p) => (haversineMeters(p.location, c.location) ?? Infinity) <= MEAL_MAX_DETOUR)
        );

        const placed = placeMeal(order, local, role, { weekday, startMinute, mode });
        if (placed) {
            order = placed.order;
            current = placed.scheduled;
            attached.push(placed.winner);
        }
    }

    const meals = assignMealRoles(current.stops);
    return { scheduled: current, meals, attached };
};

/**
 * Plan one trip end to end.
 *
 * @param {object} input
 * @param {string} input.city        city name, e.g. "Jaipur"
 * @param {string} [input.country]   disambiguates, e.g. "India"
 * @param {number} input.days        trip length in days
 * @param {number} [input.budget]    total budget in `currency`
 * @param {string} [input.currency]  ISO code or Google-style label
 * @param {number} [input.headcount] travellers
 * @param {number} [input.stopsPerDay] pace: activity slots per day
 * @param {string} [input.travelMode] WALK | DRIVE | TWO_WHEELER | TRANSIT
 * @param {string} [input.startDate] ISO date; drives opening-hour checks
 * @returns {Promise<object>} the full plan, every field computed
 */
export const solveItinerary = async ({
    city,
    country = "",
    days,
    budget = null,
    currency = "INR",
    headcount = 2,
    stopsPerDay = 4,
    travelMode = "WALK",
    startDate = null,
} = {}) => {
    const warnings = [];

    if (!isPlacesConfigured()) {
        const error = new Error("Places API is not configured (GOOGLE_PLACES_API_KEY missing)");
        error.code = "PLACES_NOT_CONFIGURED";
        throw error;
    }
    if (!city || !Number.isInteger(days) || days < 1) {
        const error = new Error("solveItinerary requires a city and a positive integer day count");
        error.code = "BAD_INPUT";
        throw error;
    }

    // Openings are checked against a real calendar when a start date is given;
    // otherwise against today. Never a made-up weekday.
    const start = startDate ? new Date(`${startDate}T09:00:00`) : new Date();
    if (startDate && Number.isNaN(start.getTime())) {
        const error = new Error(`startDate is not a parseable date: ${startDate}`);
        error.code = "BAD_INPUT";
        throw error;
    }
    const startWeekday = start.getDay();

    // ── 1. discover ────────────────────────────────────────────────────────
    const [centre] = await resolveCity(country ? `${city}, ${country}` : city);
    if (!centre?.location) {
        const error = new Error(`Could not resolve a location for "${city}"`);
        error.code = "CITY_NOT_FOUND";
        throw error;
    }
    const radius = 9000; // metres around the resolved centre
    const [sights, mealsFound, lodgingFound] = await Promise.all([
        searchNearby({
            latitude: centre.location.lat,
            longitude: centre.location.lng,
            includedTypes: SIGHT_TYPES,
            radius,
            maxResultCount: 20,
        }),
        searchNearby({
            latitude: centre.location.lat,
            longitude: centre.location.lng,
            includedTypes: [...MEAL_TYPES],
            radius,
            maxResultCount: 12,
        }),
        searchNearby({
            latitude: centre.location.lat,
            longitude: centre.location.lng,
            includedTypes: ["lodging"],
            radius,
            maxResultCount: 6,
        }),
    ]);

    // ── 2. enrich ──────────────────────────────────────────────────────────
    // Two-tier split, deliberately. Discovery is Pro and returns everything
    // the partition and sequencing need: coordinates, business status, photos.
    // Opening hours, ratings and price levels are Enterprise on *both*
    // Nearby Search and Place Details, with no cheaper tier that returns
    // them, so they are fetched per place here for the shortlist only — never
    // for the whole pool. One Nearby Search call with those fields would bill
    // Enterprise on every result; this spends it on the few that survive.
    const sightPool = sights.filter((p) => p.location);
    const mealPool = mealsFound.filter((p) => p.location);

    // Place Details has no batch endpoint: N places cost N GETs against
    // `GetPlaceRequest per day`. When that quota runs out every call 429s and
    // the plan would collapse to an empty pool. One retry after a pause — a
    // transient 429 clears — then fall back to planning from discovery alone.
    // That fallback loses opening hours and ratings, so it is flagged rather
    // than silent: a plan scheduled without real opening hours cannot promise
    // a venue will be open, and the caller must be able to see that it might
    // not be.
    //
    // Sight and meal failures are tracked separately because only the sight
    // ones can empty the plan — a meal rides along and its absence never
    // fails a day. A partial result is kept partial: enriching what came back
    // is honest, and quietly retrying the rest would make the pool differ run
    // to run, which is what reproducibility means here.
    const sightShortlist = sightPool.slice(0, days * stopsPerDay * 2 + 8);
    const mealShortlist = mealPool.slice(0, 12);
    const shortlist = (pool) => enrichPlaces(pool.map((p) => p.placeId));

    let sightResult = await shortlist(sightShortlist);
    let mealResult = await shortlist(mealShortlist);

    if (sightResult.places.length === 0 && sightResult.failures.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        sightResult = await shortlist(sightShortlist);
        mealResult = await shortlist(mealShortlist);
    }

    const degraded = sightResult.places.length === 0 && sightResult.failures.length > 0;
    if (sightResult.failures.length > 0 && !degraded) {
        warnings.push(
            `${sightResult.failures.length} of ${sightShortlist.length} attraction(s) had no rating or opening hours and were skipped`
        );
    }

    // The fallback pool is discovery only, so `isOperational` is still real
    // (businessStatus is Pro) while hours and ratings are absent.
    const pool = degraded ? [...sightPool, ...mealPool] : [...sightResult.places, ...mealResult.places];
    const usable = pool.filter((p) => p.location && p.isOperational);
    if (degraded) {
        warnings.push(
            "Opening hours and ratings could not be fetched, so times are approximate and venues may be closed when reached"
        );
    }
    if (usable.length === 0) {
        const error = new Error(`No usable places found near "${city}"`);
        error.code = "EMPTY_POOL";
        throw error;
    }

    // ── 3. partition ───────────────────────────────────────────────────────
    // The partition works on sights; meals ride along attached to their day by
    // proximity so they don't displace attraction slots.
    const sightsOnly = usable.filter((p) => !isMeal(p));
    const poolForDays = sightsOnly.length >= days ? sightsOnly : usable;
    const { days: dayGroups, metrics } = partitionIntoDays(poolForDays, {
        dayCount: days,
        stopsPerDay,
    });

    // ── 4. schedule + 5. refill ────────────────────────────────────────────
    const usedIds = new Set();
    const planned = [];
    const minStops = Math.min(3, stopsPerDay); // the product's floor

    for (const [index, group] of dayGroups.entries()) {
        const weekday = (startWeekday + index) % 7;
        const opts = { weekday, startMinute: 9 * 60, mode: travelMode };

        const sequenced = sequenceDay(group, { mode: travelMode });
        let scheduled = scheduleDay(sequenced.order, opts);

        // Refill: a day below its floor gets the nearest still-unused
        // candidates, each inserted at its cheapest position.
        if (scheduled.stops.length < minStops) {
            const dayCentre = centroid(sequenced.order) ?? centre.location;
            const candidates = usable
                .filter((p) => !usedIds.has(p.placeId) && !group.some((g) => g.placeId === p.placeId))
                .map((p) => ({ p, d: haversineMeters(p.location, dayCentre) ?? Infinity }))
                .filter((c) => Number.isFinite(c.d))
                .sort((a, b) => a.d - b.d || a.p.placeId.localeCompare(b.p.placeId))
                .map((c) => c.p);

            for (const candidate of candidates) {
                if (scheduled.stops.length >= minStops) break;
                const inserted = tryInsert(scheduled.stops.map((s) => s.place), candidate, opts);
                if (inserted) scheduled = inserted.scheduled;
            }
            if (scheduled.stops.length < minStops) {
                warnings.push(`Day ${index + 1} could only fit ${scheduled.stops.length} stop(s) within opening hours`);
            }
        }

        for (const stop of scheduled.stops) usedIds.add(stop.placeId);
        for (const drop of scheduled.dropped) usedIds.delete(drop.placeId);

        // Meals: attach breakfast, lunch, dinner from the meal candidates
        // nearest this day's activities, slotted by ideal clock time. Meals
        // ride between stops — they never displace an activity slot.
        const mealCandidates = usable.filter(
            (p) => isMeal(p) && p.location && !usedIds.has(p.placeId)
        );
        const withMeals = attachMeals(scheduled, mealCandidates, opts);
        const finalScheduled = withMeals.scheduled;
        for (const placeId of withMeals.attached) usedIds.add(placeId);

        const meals = withMeals.meals;
        const travelMinutes =
            finalScheduled.stops.length > 1
                ? sequenceDay(finalScheduled.stops.map((s) => s.place), { mode: travelMode }).travelMinutes
                : 0;

        planned.push({
            index: index + 1,
            weekday,
            weekdayName: weekdayName(weekday),
            stops: finalScheduled.stops,
            dropped: finalScheduled.dropped,
            meals,
            waitMinutes: finalScheduled.waitMinutes,
            totalMinutes: finalScheduled.totalMinutes,
            travelMinutes,
            endMinute: finalScheduled.endMinute,
            overrunsNight: finalScheduled.overrunsNight,
        });
    }

    // ── 6. cost ────────────────────────────────────────────────────────────
    const totalMeters = planned.reduce(
        (sum, day) =>
            sum +
            day.stops.slice(1).reduce((acc, stop, i) => {
                const metres = haversineMeters(day.stops[i].place.location, stop.place.location);
                return acc + (metres ?? 0) * ROAD_CIRCUITY;
            }, 0),
        0
    );
    const cost = costTrip({
        days,
        budget,
        currency: parseCurrencyCode(currency) ?? "INR",
        headcount,
        hotel: lodgingFound[0] ?? null,
        activities: planned.flatMap((d) => d.stops.filter((s) => !isMeal(s.place)).map((s) => s.place)),
        meals: {
            breakfast: planned.map((d) => d.meals.breakfast?.place).filter(Boolean),
            lunch: planned.map((d) => d.meals.lunch?.place).filter(Boolean),
            dinner: planned.map((d) => d.meals.dinner?.place).filter(Boolean),
        },
        totalMeters,
        travelMode,
    });

    // ── 7. verify against real roads (optional) ────────────────────────────
    let verification = null;
    if (isRoutesConfigured()) {
        verification = [];
        for (const day of planned) {
            if (day.stops.length < 2) continue;
            try {
                const routed = await computeRoutesOptimized({
                    origin: day.stops[0].place.location,
                    destination: day.stops[day.stops.length - 1].place.location,
                    intermediates: day.stops.slice(0, -1).map((s) => s.place.location),
                    travelMode,
                });
                verification.push({
                    day: day.index,
                    legs: routed.legs.length,
                    totalMeters: routed.totalMeters,
                    totalSeconds: routed.totalSeconds,
                });
            } catch {
                // Verification is a bonus; its failure never invalidates the plan.
            }
        }
        if (verification.length === 0) verification = null;
    }

    const hotels = lodgingFound.map((h) => ({
        placeId: h.placeId,
        hotelName: h.name,
        location: h.address || h.vicinity || "",
        coordinates: h.location ?? null,
        priceLevel: h.priceLevel ?? null,
        rating: h.rating ?? null,
        userRatingCount: h.userRatingCount ?? null,
        photoName: h.photoName ?? null,
    }));

    return {
        city: {
            placeId: centre.placeId,
            name: centre.name,
            location: centre.location,
            overview: centre.editorialSummary ?? null,
            photoName: centre.photoName ?? null,
        },
        trip: {
            days,
            stopsPerDay,
            headcount,
            travelMode,
            startWeekday,
            startDate: startDate ?? null,
        },
        itinerary: planned,
        hotels,
        budget: cost,
        // True when Enterprise fields (opening hours, ratings, price levels)
        // could not be fetched, so times are estimates rather than scheduled
        // against real opening hours. The UI must label the plan as such.
        degraded,
        metrics: {
            ...metrics,
            totalMeters: Math.round(totalMeters),
            realRoads: verification !== null,
            degraded,
        },
        verification,
        warnings,
    };
};

export { isMeal, assignMealRoles, FOOD_TYPES };