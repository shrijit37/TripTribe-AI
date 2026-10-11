import "server-only";
import { sequenceDay } from "@/server/domain/solver/sequence";
import { scheduleDay, weekdayName } from "@/server/domain/solver/schedule";
import { costTrip } from "@/server/domain/solver/cost";
import { isMeal } from "@/server/domain/solver/taxonomy";
import {
  attachMeals,
  type PipelineMeals,
} from "@/server/domain/solver/pipeline";
import { PACES } from "@/server/domain/plan/schema";
import type { EnrichedPlace } from "@/server/domain/places/client";
import type { ComposedResponse, ComposedDay } from "@/server/domain/compose";
import type { TripDoc } from "@/server/db/documents";
import type { TravelMode } from "@/server/domain/types";

/**
 * Re-plan one day of a saved trip for zero Places calls.
 * Every place it can use is already on the trip document (`placesSnapshot`,
 * written at generation time): it re-runs sequence → schedule → meals →
 * cost for that day only, patches the composed payload, and recomputes the
 * budget totals from the same band midpoints `compose.ts` uses. Anything it
 * cannot do honestly it refuses:
 * - a trip saved before snapshots existed (empty `placesSnapshot`) → 409
 * - a day index that does not exist → 404
 * - no usable places left for the requested scope → 409
 * Scopes: "day" (fresh sights + fresh meals), "meals" (same sights, new
 * meals), "order" (same places, re-sequenced and re-timed).
 */

export type RegenScope = "day" | "meals" | "order";

export class RegenError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RegenError";
    this.status = status;
  }
}

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

/** Lodging band recovered from the composed hotel line ("Price level 3/5"). */
const hotelPriceLevel = (plan: ComposedResponse): number | null => {
  const first = plan.hotels[0];
  if (!first) return null;
  const match = first.prices.match(/Price level (\d)\/5/);
  return match?.[1] ? Number(match[1]) : null;
};

const toMeal = (
  stop: {
    place: { name: string };
    placeId: string;
    arriveAt: number;
    departAt: number;
  } | null,
): ComposedDay["meals"]["breakfast"] =>
  stop
    ? {
        place: stop.place.name,
        description: "",
        placeId: stop.placeId,
        arriveAt: stop.arriveAt,
        departAt: stop.departAt,
      }
    : null;

/** "order" scope keeps the day's current meals, re-hung on the new schedule. */
const reattachCurrentMeals = (
  scheduled: ReturnType<typeof scheduleDay>,
  day: ComposedDay,
  snapshot: Map<string, EnrichedPlace>,
): PipelineMeals => {
  const byId = new Map(scheduled.stops.map((s) => [s.placeId, s]));
  const pick = (role: "breakfast" | "lunch" | "dinner") => {
    const meal = day.meals[role];
    if (!meal) return null;
    const stop = byId.get(meal.placeId);
    if (!stop || !snapshot.get(meal.placeId)) return null;
    return stop;
  };
  return {
    breakfast: pick("breakfast"),
    lunch: pick("lunch"),
    dinner: pick("dinner"),
  };
};

export const regenerateDay = (
  trip: TripDoc,
  dayIndex: number,
  scope: RegenScope,
): ComposedResponse => {
  const plan = trip.itenary;
  const day = plan.itinerary[dayIndex];
  if (!day)
    throw new RegenError(
      404,
      `Day ${dayIndex + 1} does not exist on this trip`,
    );
  if (!trip.placesSnapshot || trip.placesSnapshot.length === 0) {
    throw new RegenError(
      409,
      "This trip was saved before day-regeneration existed and carries no place data to re-plan from — generate it again to enable per-day changes",
    );
  }

  const snapshot = new Map(trip.placesSnapshot.map((p) => [p.placeId, p]));
  const full = (placeId: string): EnrichedPlace | null =>
    snapshot.get(placeId) ?? null;
  const mode = (plan.trip.travelMode ?? "WALK") as TravelMode;
  const weekday = (plan.trip.startWeekday + dayIndex) % 7;
  const opts = { weekday, startMinute: 9 * 60, mode };
  const stopsPerDay =
    (PACES as Record<string, { stopsPerDay: number }>)[trip.pace]
      ?.stopsPerDay ?? 4;

  const usedElsewhere = new Set<string>();
  plan.itinerary.forEach((d, i) => {
    if (i === dayIndex) return;
    for (const stop of d.activities) usedElsewhere.add(stop.placeId);
    for (const role of ["breakfast", "lunch", "dinner"] as const) {
      const meal = d.meals[role];
      if (meal) usedElsewhere.add(meal.placeId);
    }
  });

  let sights: EnrichedPlace[];
  if (scope === "meals" || scope === "order") {
    sights = day.activities
      .map((s) => full(s.placeId))
      .filter((p): p is EnrichedPlace => !!p && !!p.location);
    if (sights.length === 0) {
      throw new RegenError(
        409,
        "None of this day's stops are in the saved place data",
      );
    }
  } else {
    const keep = Math.max(day.activities.length, Math.min(3, stopsPerDay));
    sights = trip.placesSnapshot
      .filter(
        (p) =>
          p.location &&
          p.isOperational !== false &&
          !isMeal(p) &&
          !usedElsewhere.has(p.placeId),
      )
      .slice(0, Math.max(keep, stopsPerDay));
    if (sights.length === 0) {
      throw new RegenError(
        409,
        "No unused places remain in the saved data for a fresh day",
      );
    }
  }

  const sequenced = sequenceDay(sights, { mode });
  const scheduled = scheduleDay(sequenced.order, opts);

  const mealCandidates = trip.placesSnapshot.filter(
    (p) => p.location && isMeal(p) && !usedElsewhere.has(p.placeId),
  );
  const withMeals =
    scope === "order"
      ? { scheduled, meals: reattachCurrentMeals(scheduled, day, snapshot) }
      : attachMeals(scheduled, mealCandidates, opts);

  const finalScheduled = withMeals.scheduled;
  const travelMinutes =
    finalScheduled.stops.length > 1
      ? sequenceDay(
          finalScheduled.stops.map((s) => s.place as EnrichedPlace),
          { mode },
        ).travelMinutes
      : 0;

  const newDay: ComposedDay = {
    day: day.day,
    weekday: weekdayName(weekday),
    activities: finalScheduled.stops
      .filter((s) => !isMeal(s.place))
      .map((stop) => ({
        place: stop.place.name,
        description: "",
        placeId: stop.placeId,
        arriveAt: stop.arriveAt,
        departAt: stop.departAt,
        waitMinutes: stop.waitMinutes ?? 0,
        openedAfterWait: stop.openedAt ?? false,
      })),
    meals: {
      breakfast: toMeal(withMeals.meals.breakfast),
      lunch: toMeal(withMeals.meals.lunch),
      dinner: toMeal(withMeals.meals.dinner),
    },
    travelMinutes: Math.round(travelMinutes),
    waitMinutes: finalScheduled.waitMinutes ?? 0,
    endMinute: finalScheduled.endMinute,
  };

  // A surviving stop keeps the traveller's own description (possibly edited by
  // the narrator at generation time); a new stop arrives undescribed rather
  // than inventing prose for it.
  const oldDescriptions = new Map<string, string>();
  for (const stop of day.activities) {
    if (stop.description) oldDescriptions.set(stop.placeId, stop.description);
  }
  for (const stop of newDay.activities) {
    const kept = oldDescriptions.get(stop.placeId);
    if (kept) stop.description = kept;
  }

  const patched: ComposedResponse = {
    ...plan,
    itinerary: plan.itinerary.map((d, i) => (i === dayIndex ? newDay : d)),
  };

  // Recompute the money from full place objects looked up in the snapshot.
  // The hotel band is recovered from the composed "Price level N/5" string so
  // the accommodation line survives regeneration in the same band.
  const currency = plan.Budget.currency;
  const priced = (placeId: string): { priceLevel: number | null } => {
    const place = full(placeId);
    return { priceLevel: place?.priceLevel ?? null };
  };
  const cost = costTrip({
    days: plan.trip.days,
    budget: trip.budget,
    currency,
    headcount: plan.trip.headcount,
    hotel:
      hotelPriceLevel(plan) !== null
        ? { priceLevel: hotelPriceLevel(plan) }
        : null,
    activities: patched.itinerary.flatMap((d) =>
      d.activities.map((s) => priced(s.placeId)),
    ),
    meals: {
      breakfast: mealPlaces(patched, "breakfast", snapshot),
      lunch: mealPlaces(patched, "lunch", snapshot),
      dinner: mealPlaces(patched, "dinner", snapshot),
    },
    totalMeters:
      typeof plan.metrics.totalMeters === "number"
        ? plan.metrics.totalMeters
        : 0,
    travelMode: plan.trip.travelMode,
  });

  const total = money(cost.total, currency);
  const shortfall = money(cost.shortfall, currency);
  const infeasible = cost.feasible === false;
  patched.Budget = {
    total: total ?? money(0, currency),
    breakdown: {
      accommodation:
        money(cost.breakdown.accommodation, currency) ?? money(0, currency),
      meals: money(cost.breakdown.meals, currency) ?? money(0, currency),
      activities:
        money(cost.breakdown.activities, currency) ?? money(0, currency),
      transportation:
        money(cost.breakdown.transportation, currency) ?? money(0, currency),
    },
    insufficientBudget: infeasible,
    insufficientBudgetMessage: infeasible
      ? `This plan costs about ${total} — roughly ${shortfall} over your budget. ${cost.suggestions?.join(" ") ?? ""}`.trim()
      : "",
    alternativeOptions: cost.suggestions?.join(" ") ?? "",
    averageTotalCost: money(cost.perDay, currency) ?? money(0, currency),
    averageAccommodationCost:
      money(
        cost.breakdown.accommodation / Math.max(1, plan.trip.days),
        currency,
      ) ?? money(0, currency),
    isEstimate: true,
    currency,
  };
  return patched;
};

const mealPlaces = (
  plan: ComposedResponse,
  role: "breakfast" | "lunch" | "dinner",
  snapshot: Map<string, EnrichedPlace>,
): EnrichedPlace[] =>
  plan.itinerary
    .map((d) => d.meals[role]?.placeId ?? null)
    .filter((id): id is string => !!id)
    .map((id) => snapshot.get(id))
    .filter((p): p is EnrichedPlace => !!p);
