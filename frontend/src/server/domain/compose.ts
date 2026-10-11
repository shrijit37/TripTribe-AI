import "server-only";
import { isMeal } from "@/server/domain/solver/taxonomy";
import type { SolveResult } from "@/server/domain/solver/pipeline";
import type { ScheduledStop } from "@/server/domain/solver/schedule";
import type { Narration } from "@/server/domain/narrate";

/**
 * Compose the response the frontend consumes.
 * Ported from `backend/services/compose.js` — same wire shape Result renders
 * (`city`, `Reach`, `Tips`, `itinerary[].activities/meals`, `hotels`,
 * `Budget`), same provenance markers (`isEstimate`, `computedBy`). Two fixes:
 * 1. `isMeal` comes from `solver/taxonomy.ts`, not the pipeline orchestrator
 *    (migration bug #9).
 * 2. Money is formatted with the runtime default locale for the plan's
 *    currency, not hardcoded `en-IN` (migration bug #3 — a USD plan used to
 *    render in Indian grouping).
 */

const money = (value: number, currency: string): string | null => {
  if (!Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString(undefined)}`;
  }
};

const describeStop = (stop: ScheduledStop, narration: Narration): string =>
  narration?.descriptions?.[stop.placeId] ?? "";

const namedPlace = (place: { name: string }, description: string) => ({
  place: place.name,
  description,
});

export interface ComposedMeal {
  place: string;
  description: string;
  placeId: string;
  arriveAt: number;
  departAt: number;
}

export interface ComposedActivity extends ComposedMeal {
  waitMinutes: number;
  openedAfterWait: boolean;
}

export interface ComposedDay {
  day: number;
  weekday: string | null;
  activities: ComposedActivity[];
  meals: Record<"breakfast" | "lunch" | "dinner", ComposedMeal | null>;
  travelMinutes: number;
  waitMinutes: number;
  endMinute: number;
}

export interface ComposedResponse {
  city: {
    name: string;
    description: string;
    IconicPlace: string;
    Country: string;
    "Region/State": string;
    Currency: string;
    Language: string;
    BestTimeToVisit: string;
  };
  computedBy: "solver";
  itinerary: ComposedDay[];
  hotels: {
    hotelName: string;
    location: string;
    prices: string;
    rating: string;
    placeId: string;
  }[];
  Tips: string[];
  Budget: {
    total: string | null;
    breakdown: {
      accommodation: string | null;
      meals: string | null;
      activities: string | null;
      transportation: string | null;
    };
    insufficientBudget: boolean;
    insufficientBudgetMessage: string;
    alternativeOptions: string;
    averageTotalCost: string | null;
    averageAccommodationCost: string | null;
    isEstimate: true;
    currency: string;
  };
  Reach: null;
  metrics: SolveResult["metrics"];
  warnings: string[];
  verification: SolveResult["verification"];
  trip: SolveResult["trip"];
}

export const composeResponse = (
  solverPlan: SolveResult,
  narration: { narration: Narration | null } = { narration: null },
): ComposedResponse => {
  const prose = narration.narration ?? {
    overview: null,
    tips: [],
    descriptions: {},
  };
  const currency = solverPlan.budget.currency ?? "INR";

  const itinerary: ComposedDay[] = solverPlan.itinerary.map((day) => {
    const isMealStop = (stop: ScheduledStop) => isMeal(stop.place);
    const activities: ComposedActivity[] = day.stops
      .filter((stop) => !isMealStop(stop))
      .map((stop) => ({
        ...namedPlace(stop.place, describeStop(stop, prose)),
        placeId: stop.placeId,
        arriveAt: stop.arriveAt,
        departAt: stop.departAt,
        waitMinutes: stop.waitMinutes ?? 0,
        openedAfterWait: stop.openedAt ?? false,
      }));

    const meals = {} as ComposedDay["meals"];
    for (const mealType of ["breakfast", "lunch", "dinner"] as const) {
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

  const total = money(solverPlan.budget.total, currency);
  const shortfall = money(solverPlan.budget.shortfall, currency);
  const infeasible = solverPlan.budget.feasible === false;

  return {
    city: {
      name: solverPlan.city.name,
      description:
        (typeof prose.overview === "string" && prose.overview) ||
        (typeof solverPlan.city.overview === "string"
          ? solverPlan.city.overview
          : "") ||
        "",
      IconicPlace: solverPlan.city.name,
      Country: "",
      "Region/State": "",
      Currency: currency,
      Language: "",
      BestTimeToVisit: "",
    },
    computedBy: "solver",
    itinerary,
    hotels: solverPlan.hotels.map((hotel) => ({
      hotelName: hotel.hotelName,
      location: hotel.location,
      prices:
        hotel.priceLevel != null
          ? `Price level ${hotel.priceLevel}/5`
          : "Price not listed",
      rating: hotel.rating != null ? `${hotel.rating}/5` : "Not rated",
      placeId: hotel.placeId,
    })),
    Tips: prose.tips.length ? prose.tips : [],
    Budget: {
      total: total ?? money(0, currency),
      breakdown: {
        accommodation:
          money(solverPlan.budget.breakdown.accommodation, currency) ??
          money(0, currency),
        meals:
          money(solverPlan.budget.breakdown.meals, currency) ??
          money(0, currency),
        activities:
          money(solverPlan.budget.breakdown.activities, currency) ??
          money(0, currency),
        transportation:
          money(solverPlan.budget.breakdown.transportation, currency) ??
          money(0, currency),
      },
      insufficientBudget: infeasible,
      insufficientBudgetMessage: infeasible
        ? `This plan costs about ${total} — roughly ${shortfall} over your budget. ${solverPlan.budget.suggestions?.join(" ") ?? ""}`.trim()
        : "",
      alternativeOptions: solverPlan.budget.suggestions?.join(" ") ?? "",
      averageTotalCost:
        money(solverPlan.budget.perDay, currency) ?? money(0, currency),
      averageAccommodationCost:
        money(
          solverPlan.budget.breakdown.accommodation /
            Math.max(1, solverPlan.trip.days),
          currency,
        ) ?? money(0, currency),
      isEstimate: true,
      currency,
    },
    Reach: null,
    metrics: solverPlan.metrics,
    warnings: solverPlan.warnings ?? [],
    verification: solverPlan.verification,
    trip: solverPlan.trip,
  };
};

export default composeResponse;
