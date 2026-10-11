/**
 * The itinerary controller.
 *
 * This used to be the whole product: one prompt, one model call, whatever it
 * said back. It is now the *seam* between three parts that each do one job:
 *
 *   solver/pipeline.js   decides every fact — which places, which day, what
 *                        order, what clock time, what cost. Deterministic.
 *   services/narrate.js  writes prose on top of those facts. Optional; can
 *                        only name places it was handed, and its failure
 *                        costs the itinerary nothing.
 *   services/compose.js  shapes the result into the payload the frontend
 *                        has always rendered.
 *
 * The ordering matters: narration runs *after* the plan exists, so a slow or
 * missing model degrades to a factually complete itinerary with empty
 * descriptions — never to a fabricated one.
 */
import asyncHandler from "express-async-handler";
import dotenv from "dotenv";
import { solveItinerary } from "../solver/pipeline.js";
import { narrate } from "../services/narrate.js";
import { composeResponse } from "../services/compose.js";

dotenv.config();

// Solver inputs that are not part of the public request contract yet. Chosen
// here rather than defaulted inside the solver so the controller owns the
// product decisions and the solver stays a pure function of its arguments.
const DEFAULTS = Object.freeze({
    country: process.env.PLANNER_DEFAULT_COUNTRY || "",
    headcount: 2,
    stopsPerDay: 4,
    travelMode: "WALK",
});

/**
 * Map a solver error code to the HTTP status the caller deserves.
 *
 * A city that does not resolve and a malformed day count are both the
 * caller's problem (400). A missing Places key or an upstream failure is
 * ours (503), and saying so keeps the frontend from blaming the user's input.
 */
const statusFor = (error) => {
    switch (error?.code) {
        case "BAD_INPUT":
        case "CITY_NOT_FOUND":
        case "EMPTY_POOL":
            return 400;
        case "PLACES_NOT_CONFIGURED":
        case "ROUTES_NOT_CONFIGURED":
            return 503;
        default:
            return 500;
    }
};

/**
 * Generate an itinerary.
 *
 * `input` is the parsed request: `{ days, cityName, budget, email, country?,
 * headcount?, stopsPerDay?, travelMode?, startDate? }`. Returns the composed
 * payload. Throws an Error carrying `status` for the route to surface.
 */
const getResponse = asyncHandler(async (input) => {
    const {
        days,
        cityName,
        budget,
        country = DEFAULTS.country,
        headcount = DEFAULTS.headcount,
        stopsPerDay = DEFAULTS.stopsPerDay,
        travelMode = DEFAULTS.travelMode,
        startDate = null,
    } = input;

    let solverPlan;
    try {
        solverPlan = await solveItinerary({
            city: cityName,
            country,
            days,
            budget,
            headcount,
            stopsPerDay,
            travelMode,
            startDate,
        });
    } catch (error) {
        // Annotate for the route; rethrow so the caller's 400/503/500 is
        // decided by the failure kind, not by a generic 500.
        error.status = statusFor(error);
        throw error;
    }

    // Narration is best-effort by contract. narrate() resolves with an empty
    // narration on any failure, so this await cannot reject and the plan
    // below is always returned.
    const narratedPlan = await narrate(solverPlan);

    return composeResponse(solverPlan, narratedPlan);
});

export default getResponse;
