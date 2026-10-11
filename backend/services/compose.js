/**
 * Compose the response the frontend consumes.
 *
 * The wire shape is the one Result.jsx has always rendered — `city`, `Reach`,
 * `Tips`, `itinerary[].activities/meals`, `hotels`, `Budget` — so switching the
 * source of truth from "what the model said" to "what the solver computed"
 * does not require the render layer to change to ship.
 *
 * What changed is *where each value comes from*:
 *
 *   - activities, meals, their order, their clock times  ← solver, always
 *   - Budget.total / breakdown / insufficientBudget      ← solver cost model
 *   - descriptions, overview, tips                        ← LLM narration only
 *   - Reach, the city-info block                          ← Places metadata,
 *                                                          with narration as a
 *                                                          fallback
 *
 * Two fields carry provenance so a claim is never passed off as computed when
 * it was not: `isEstimate` on every cost, and `computedBy` on the itinerary
 * block naming the solver that produced it.
 */

import { isMeal } from "../solver/pipeline.js";

const money = (value, currency) => {
    if (!Number.isFinite(value)) return null;
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency} ${Math.round(value).toLocaleString("en-IN")}`;
    }
};

const describeStop = (stop, narration) => narration?.descriptions?.[stop.placeId] ?? "";

const namedPlace = (place, description) => ({
    place: place.name,
    description,
});

/**
 * Compose the final itinerary payload.
 *
 * @param {object} solverPlan  return value of solver/pipeline.js
 * @param {object} narration   return value of services/narrate.js (may be empty)
 * @returns {object} the payload Result.jsx renders
 */
export const composeResponse = (solverPlan, narration = { narration: null }) => {
    const prose = narration.narration ?? { overview: null, tips: [], descriptions: {} };
    const currency = solverPlan.budget.currency ?? "INR";

    // The solver keeps activities and meals in one chronologically-sorted stop
    // list; the wire contract presents them as two lists. Split without losing
    // the clock, which is the whole point of running a scheduler.
    const itinerary = solverPlan.itinerary.map((day) => {
        // A meal is a food venue, not a stop that won a clock slot:
        // `assignMealRoles` names at most one stop per meal window, so a meal
        // that lands between two windows carries no `role` at all. Classifying
        // on the place is what keeps such a meal out of the activities list.
        const isMealStop = (stop) => isMeal(stop.place);
        const activities = day.stops
            .filter((stop) => !isMealStop(stop))
            .map((stop) => ({
                ...namedPlace(stop.place, describeStop(stop, prose)),
                placeId: stop.placeId,
                arriveAt: stop.arriveAt,
                departAt: stop.departAt,
                waitMinutes: stop.waitMinutes ?? 0,
                openedAfterWait: stop.openedAt ?? false,
            }));

        const meals = {};
        for (const mealType of ["breakfast", "lunch", "dinner"]) {
            const stop = day.meals?.[mealType];
            meals[mealType] = stop
                ? {
                    ...namedPlace(stop.place, describeStop(stop, prose)),
                    placeId: stop.placeId,
                    arriveAt: stop.arriveAt,
                    departAt: stop.departAt,
                }
                : null;
        }

        return {
            day: day.index,
            weekday: day.weekdayName,
            activities,
            meals,
            travelMinutes: Math.round(day.travelMinutes ?? 0),
            waitMinutes: day.waitMinutes ?? 0,
            endMinute: day.endMinute,
        };
    });

    const budgetBlock = {
        total: money(solverPlan.budget.total, currency) ?? money(0, currency),
        breakdown: {
            accommodation: money(solverPlan.budget.breakdown.accommodation, currency) ?? money(0, currency),
            meals: money(solverPlan.budget.breakdown.meals, currency) ?? money(0, currency),
            activities: money(solverPlan.budget.breakdown.activities, currency) ?? money(0, currency),
            transportation: money(solverPlan.budget.breakdown.transportation, currency) ?? money(0, currency),
        },
        insufficientBudget: solverPlan.budget.feasible === false,
        insufficientBudgetMessage:
            solverPlan.budget.feasible === false
                ? `This plan costs about ${money(solverPlan.budget.total, currency)} — roughly ${money(
                    solverPlan.budget.shortfall,
                    currency
                )} over your budget. ${solverPlan.budget.suggestions?.join(" ") ?? ""}`.trim()
                : "",
        alternativeOptions: solverPlan.budget.suggestions?.join(" ") ?? "",
        averageTotalCost: money(solverPlan.budget.perDay, currency) ?? money(0, currency),
        averageAccommodationCost: money(solverPlan.budget.breakdown.accommodation / Math.max(1, solverPlan.trip.days), currency) ?? money(0, currency),
        // Every number above is modelled, not booked. The UI must say so.
        isEstimate: true,
        currency,
    };

    return {
        city: {
            name: solverPlan.city.name,
            description: prose.overview ?? solverPlan.city.overview ?? "",
            IconicPlace: solverPlan.city.name,
            Country: "",
            "Region/State": "",
            Currency: currency,
            Language: "",
            BestTimeToVisit: "",
        },
        // The solver is the source of truth for the plan. Named explicitly so
        // anything reading this payload can tell it was not LLM-authored.
        computedBy: "solver",
        itinerary,
        hotels: solverPlan.hotels.map((hotel) => ({
            hotelName: hotel.hotelName,
            location: hotel.location,
            prices: hotel.priceLevel != null ? `Price level ${hotel.priceLevel}/5` : "Price not listed",
            rating: hotel.rating != null ? `${hotel.rating}/5` : "Not rated",
            placeId: hotel.placeId,
        })),
        Tips: prose.tips.length ? prose.tips : [],
        Budget: budgetBlock,
        // Reach needs transport data the solver does not gather yet. It is
        // served as null rather than invented — the UI shows an honest gap.
        Reach: null,
        metrics: solverPlan.metrics,
        warnings: solverPlan.warnings ?? [],
        verification: solverPlan.verification,
        trip: solverPlan.trip,
    };
};

export default composeResponse;
