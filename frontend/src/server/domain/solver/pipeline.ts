import "server-only";
import {
  resolveCity,
  searchNearby,
  enrichPlaces,
  isPlacesConfigured,
  type EnrichedPlace,
} from "@/server/domain/places/client";
import {
  readPrewarmPlaces,
  isQuotaError,
} from "@/server/domain/places/fallback";
import {
  computeRoutesOptimized,
  isRoutesConfigured,
} from "@/server/domain/places/routes";
import {
  haversineMeters,
  ROAD_CIRCUITY,
  centroid,
} from "@/server/domain/solver/geo";
import { partitionIntoDays } from "@/server/domain/solver/dayPartition";
import { sequenceDay } from "@/server/domain/solver/sequence";
import {
  scheduleDay,
  weekdayName,
  type ScheduledStop,
} from "@/server/domain/solver/schedule";
import { costTrip, parseCurrencyCode } from "@/server/domain/solver/cost";
import {
  isMeal,
  FOOD_TYPES,
  MEAL_TYPES,
  MEAL_IDEAL,
  MEAL_WINDOWS,
  MEAL_MAX_DETOUR,
} from "@/server/domain/solver/taxonomy";
import type { GeoPoint, LatLng, TravelMode } from "@/server/domain/types";

export {
  isMeal,
  FOOD_TYPES,
  MEAL_TYPES,
  MEAL_IDEAL,
  MEAL_WINDOWS,
  MEAL_MAX_DETOUR,
};

/**
 * The planning pipeline: everything deterministic, nothing guessed.
 * Ported from `backend/solver/pipeline.js` — stages, constants (radius
 * 9000 m, sight shortlist `days*stopsPerDay*2+8`, 12 meals, 2 s retry,
 * error codes) and warning copy unchanged.
 */

export type MealRole = "breakfast" | "lunch" | "dinner";

export interface PipelineMeals {
  breakfast: ScheduledStop | null;
  lunch: ScheduledStop | null;
  dinner: ScheduledStop | null;
}

const assignMealRoles = (stops: ScheduledStop[]): PipelineMeals => {
  const meals: PipelineMeals = { breakfast: null, lunch: null, dinner: null };
  for (const stop of stops) {
    if (!isMeal(stop.place)) continue;
    for (const [role, [from, to]] of Object.entries(MEAL_WINDOWS)) {
      const key = role as MealRole;
      if (meals[key]) continue;
      if (stop.arriveAt >= (from as number) && stop.arriveAt < (to as number)) {
        meals[key] = stop;
        stop.role = key;
        break;
      }
    }
  }
  return meals;
};

interface ScheduleOpts {
  weekday: number;
  startMinute: number;
  mode: TravelMode;
}

const tryInsert = (
  ordered: EnrichedPlace[],
  candidate: EnrichedPlace,
  { weekday, startMinute, mode }: ScheduleOpts,
): {
  order: EnrichedPlace[];
  scheduled: ReturnType<typeof scheduleDay>;
} | null => {
  let best: {
    order: EnrichedPlace[];
    scheduled: ReturnType<typeof scheduleDay>;
  } | null = null;
  for (let position = 0; position <= ordered.length; position += 1) {
    const attempt = [
      ...ordered.slice(0, position),
      candidate,
      ...ordered.slice(position),
    ];
    const rescheduled = scheduleDay(attempt, { weekday, startMinute, mode });
    const survived = rescheduled.stops.some(
      (s) => s.placeId === candidate.placeId,
    );
    if (!survived) continue;
    if (!best || rescheduled.totalMinutes < best.scheduled.totalMinutes) {
      best = { order: attempt, scheduled: rescheduled };
    }
  }
  return best;
};

const placeMeal = (
  order: EnrichedPlace[],
  candidates: EnrichedPlace[],
  role: MealRole,
  { weekday, startMinute, mode }: ScheduleOpts,
): {
  order: EnrichedPlace[];
  scheduled: ReturnType<typeof scheduleDay>;
  skew: number;
  winner: string;
} | null => {
  const ideal = MEAL_IDEAL[role];
  let best: {
    order: EnrichedPlace[];
    scheduled: ReturnType<typeof scheduleDay>;
    skew: number;
    winner: string;
  } | null = null;
  for (const candidate of candidates) {
    if (!candidate.location) continue;
    for (let position = 0; position <= order.length; position += 1) {
      const before = order[position - 1] ?? null;
      const after = order[position] ?? null;
      const detourBefore =
        before?.location && candidate.location
          ? (haversineMeters(before.location, candidate.location) ?? Infinity)
          : 0;
      const detourAfter =
        after?.location && candidate.location
          ? (haversineMeters(candidate.location, after.location) ?? Infinity)
          : 0;
      if (detourBefore > MEAL_MAX_DETOUR || detourAfter > MEAL_MAX_DETOUR)
        continue;
      const attempt = [
        ...order.slice(0, position),
        candidate,
        ...order.slice(position),
      ];
      const rescheduled = scheduleDay(attempt, { weekday, startMinute, mode });
      const stop = rescheduled.stops.find(
        (s) => s.placeId === candidate.placeId,
      );
      if (!stop) continue;
      const skew = Math.abs(stop.arriveAt - ideal);
      if (!best || skew < best.skew) {
        best = {
          order: attempt,
          scheduled: rescheduled,
          skew,
          winner: candidate.placeId,
        };
      }
    }
  }
  return best;
};

const attachMeals = (
  scheduled: ReturnType<typeof scheduleDay>,
  candidates: EnrichedPlace[],
  { weekday, startMinute, mode }: ScheduleOpts,
): {
  scheduled: ReturnType<typeof scheduleDay>;
  meals: PipelineMeals;
  attached: string[];
} => {
  let order = scheduled.stops.map((s) => s.place as EnrichedPlace);
  let current = scheduled;
  const attached: string[] = [];
  for (const role of ["breakfast", "lunch", "dinner"] as const) {
    const local = candidates.filter(
      (c) =>
        c.location &&
        !attached.includes(c.placeId) &&
        !order.some((p) => p.placeId === c.placeId) &&
        order.some(
          (p) =>
            p.location &&
            (haversineMeters(p.location, c.location as LatLng) ?? Infinity) <=
              MEAL_MAX_DETOUR,
        ),
    );
    const placed = placeMeal(order, local, role, {
      weekday,
      startMinute,
      mode,
    });
    if (placed) {
      order = placed.order;
      current = placed.scheduled;
      attached.push(placed.winner);
    }
  }
  return {
    scheduled: current,
    meals: assignMealRoles(current.stops),
    attached,
  };
};

export interface SolveInput {
  city: string;
  country?: string;
  days: number;
  budget?: number | null;
  currency?: string;
  headcount?: number;
  stopsPerDay?: number;
  travelMode?: TravelMode;
  startDate?: string | null;
}

export interface PlannedDayResult {
  index: number;
  weekday: number;
  weekdayName: string | null;
  stops: ScheduledStop[];
  dropped: ReturnType<typeof scheduleDay>["dropped"];
  meals: PipelineMeals;
  waitMinutes: number;
  totalMinutes: number;
  travelMinutes: number;
  endMinute: number;
  overrunsNight: boolean;
}

export interface SolveResult {
  city: {
    placeId: string;
    name: string;
    location: LatLng | null;
    overview: unknown;
    photoName: string | null;
  };
  trip: {
    days: number;
    stopsPerDay: number;
    headcount: number;
    travelMode: TravelMode;
    startWeekday: number;
    startDate: string | null;
  };
  itinerary: PlannedDayResult[];
  hotels: {
    placeId: string;
    hotelName: string;
    location: string;
    coordinates: LatLng | null;
    priceLevel: number | null;
    rating: number | null;
    reviewCount: number | null;
    photoName: string | null;
  }[];
  budget: ReturnType<typeof costTrip>;
  degraded: boolean;
  metrics: Record<string, number | boolean | number[]>;
  verification:
    | { day: number; legs: number; totalMeters: number; totalSeconds: number }[]
    | null;
  warnings: string[];
  /** The enriched shortlist, persisted on the trip so regeneration is free. */
  placesSnapshot: EnrichedPlace[];
}

export class PipelineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}

const fail = (code: string, message: string): never => {
  throw new PipelineError(code, message);
};

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
}: SolveInput): Promise<SolveResult> => {
  const warnings: string[] = [];

  if (!isPlacesConfigured()) {
    fail(
      "PLACES_NOT_CONFIGURED",
      "Places API is not configured (GOOGLE_PLACES_API_KEY missing)",
    );
  }
  if (!city || !Number.isInteger(days) || days < 1) {
    fail(
      "BAD_INPUT",
      "solveItinerary requires a city and a positive integer day count",
    );
  }

  const start = startDate ? new Date(`${startDate}T09:00:00`) : new Date();
  if (startDate && Number.isNaN(start.getTime())) {
    fail("BAD_INPUT", `startDate is not a parseable date: ${startDate}`);
  }
  const startWeekday = start.getDay();

  // ── 1. discover ──
  const [centre] = await resolveCity(country ? `${city}, ${country}` : city);
  if (!centre?.location)
    fail("CITY_NOT_FOUND", `Could not resolve a location for "${city}"`);
  const resolved = centre as EnrichedPlace;
  const radius = 9000;
  let usable: EnrichedPlace[] = [];
  let degraded = false;
  let lodgingFound: EnrichedPlace[] = [];
  try {
    const [sights, mealsFound, lodging] = await Promise.all([
      searchNearby({
        latitude: (resolved.location as LatLng).lat,
        longitude: (resolved.location as LatLng).lng,
        includedTypes: [
          "tourist_attraction",
          "museum",
          "historical_landmark",
          "monument",
          "art_gallery",
          "park",
          "castle",
          "shopping_mall",
        ],
        radius,
        maxResultCount: 20,
      }),
      searchNearby({
        latitude: (resolved.location as LatLng).lat,
        longitude: (resolved.location as LatLng).lng,
        includedTypes: [...MEAL_TYPES],
        radius,
        maxResultCount: 12,
      }),
      searchNearby({
        latitude: (resolved.location as LatLng).lat,
        longitude: (resolved.location as LatLng).lng,
        includedTypes: ["lodging"],
        radius,
        maxResultCount: 6,
      }),
    ]);

    lodgingFound = lodging;
    // ── 2. enrich ──
    const sightPool = sights.filter((p) => p.location);
    const mealPool = mealsFound.filter((p) => p.location);
    const sightShortlist = sightPool.slice(0, days * stopsPerDay * 2 + 8);
    const mealShortlist = mealPool.slice(0, 12);
    const shortlist = (pool: EnrichedPlace[]) =>
      enrichPlaces(pool.map((p) => p.placeId));

    let sightResult = await shortlist(sightShortlist);
    let mealResult = await shortlist(mealShortlist);

    if (sightResult.places.length === 0 && sightResult.failures.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      sightResult = await shortlist(sightShortlist);
      mealResult = await shortlist(mealShortlist);
    }

    degraded =
      sightResult.places.length === 0 && sightResult.failures.length > 0;
    if (sightResult.failures.length > 0 && !degraded) {
      warnings.push(
        `${sightResult.failures.length} of ${sightShortlist.length} attraction(s) had no rating or opening hours and were skipped`,
      );
    }

    const pool = degraded
      ? [...sightPool, ...mealPool]
      : [...sightResult.places, ...mealResult.places];
    usable = pool.filter((p) => p.location && p.isOperational);
    if (degraded) {
      warnings.push(
        "Opening hours and ratings could not be fetched, so times are approximate and venues may be closed when reached",
      );
    }
  } catch (error) {
    // Google's daily Places cap is spent (an upstream 429 carries
    // QUOTA_EXHAUSTED, see client.ts). Serve the prewarm snapshot when the
    // city has one, so the plan still goes out with real — if week-old —
    // hours; otherwise surface the honest quota refusal (bead 9ve).
    if (!isQuotaError(error)) throw error;
    const snapshot = await readPrewarmPlaces(city);
    if (!snapshot) throw error;
    usable = [...snapshot.sights, ...snapshot.meals, ...snapshot.lodging].filter(
      (p) => p.location && p.isOperational,
    );
    degraded = false;
    warnings.push(
      "Today's live map lookup is exhausted, so this plan was built from a recent snapshot of the city's places — some details may be a few days old",
    );
  }
  if (usable.length === 0)
    fail("EMPTY_POOL", `No usable places found near "${city}"`);

  const placesSnapshot: EnrichedPlace[] = [...usable];

  // ── 3. partition ──
  const sightsOnly = usable.filter((p) => !isMeal(p));
  const poolForDays = sightsOnly.length >= days ? sightsOnly : usable;
  const { days: dayGroups, metrics } = partitionIntoDays(poolForDays, {
    dayCount: days,
    stopsPerDay,
  });

  // ── 4. schedule + 5. refill ──
  const usedIds = new Set<string>();
  const planned: PlannedDayResult[] = [];
  const minStops = Math.min(3, stopsPerDay);

  for (const [index, group] of dayGroups.entries()) {
    const weekday = (startWeekday + index) % 7;
    const opts: ScheduleOpts = {
      weekday,
      startMinute: 9 * 60,
      mode: travelMode,
    };

    const sequenced = sequenceDay(group, { mode: travelMode });
    let scheduled = scheduleDay(sequenced.order, opts);

    if (scheduled.stops.length < minStops) {
      const dayCentre =
        centroid(sequenced.order) ?? (resolved.location as LatLng);
      const candidates = usable
        .filter(
          (p) =>
            !usedIds.has(p.placeId) &&
            !group.some((g) => g.placeId === p.placeId),
        )
        .map((p) => ({
          p,
          d: p.location
            ? (haversineMeters(p.location, dayCentre) ?? Infinity)
            : Infinity,
        }))
        .filter((c) => Number.isFinite(c.d))
        .sort((a, b) => a.d - b.d || a.p.placeId.localeCompare(b.p.placeId))
        .map((c) => c.p);

      for (const candidate of candidates) {
        if (scheduled.stops.length >= minStops) break;
        const inserted = tryInsert(
          scheduled.stops.map((s) => s.place as EnrichedPlace),
          candidate,
          opts,
        );
        if (inserted) scheduled = inserted.scheduled;
      }
      if (scheduled.stops.length < minStops) {
        warnings.push(
          `Day ${index + 1} could only fit ${scheduled.stops.length} stop(s) within opening hours`,
        );
      }
    }

    for (const stop of scheduled.stops) usedIds.add(stop.placeId);
    for (const drop of scheduled.dropped) usedIds.delete(drop.placeId);

    const mealCandidates = usable.filter(
      (p) => isMeal(p) && p.location && !usedIds.has(p.placeId),
    );
    const withMeals = attachMeals(scheduled, mealCandidates, opts);
    const finalScheduled = withMeals.scheduled;
    for (const placeId of withMeals.attached) usedIds.add(placeId);

    const travelMinutes =
      finalScheduled.stops.length > 1
        ? sequenceDay(
            finalScheduled.stops.map((s) => s.place as EnrichedPlace),
            { mode: travelMode },
          ).travelMinutes
        : 0;

    planned.push({
      index: index + 1,
      weekday,
      weekdayName: weekdayName(weekday),
      stops: finalScheduled.stops,
      dropped: finalScheduled.dropped,
      meals: withMeals.meals,
      waitMinutes: finalScheduled.waitMinutes,
      totalMinutes: finalScheduled.totalMinutes,
      travelMinutes,
      endMinute: finalScheduled.endMinute,
      overrunsNight: finalScheduled.overrunsNight,
    });
  }

  // ── 6. cost ──
  const totalMeters = planned.reduce(
    (sum, day) =>
      sum +
      day.stops.slice(1).reduce((acc, stop, i) => {
        const prev = day.stops[i];
        const metres =
          prev?.place.location && stop.place.location
            ? haversineMeters(prev.place.location, stop.place.location)
            : null;
        return acc + (metres ?? 0) * ROAD_CIRCUITY;
      }, 0),
    0,
  );
  const cost = costTrip({
    days,
    budget: budget ?? (null as unknown as number),
    currency: parseCurrencyCode(currency) ?? "INR",
    headcount,
    hotel: lodgingFound[0] ?? null,
    activities: planned.flatMap((d) =>
      d.stops.filter((s) => !isMeal(s.place)).map((s) => s.place),
    ),
    meals: {
      breakfast: planned
        .map((d) => d.meals.breakfast?.place)
        .filter(Boolean) as EnrichedPlace[],
      lunch: planned
        .map((d) => d.meals.lunch?.place)
        .filter(Boolean) as EnrichedPlace[],
      dinner: planned
        .map((d) => d.meals.dinner?.place)
        .filter(Boolean) as EnrichedPlace[],
    },
    totalMeters,
    travelMode,
  });

  // ── 7. verify (optional) ──
  let verification: SolveResult["verification"] = null;
  if (isRoutesConfigured()) {
    const checked: NonNullable<SolveResult["verification"]> = [];
    for (const day of planned) {
      if (day.stops.length < 2) continue;
      try {
        const first = day.stops[0];
        const last = day.stops[day.stops.length - 1];
        if (!first || !last) continue;
        const routed = await computeRoutesOptimized({
          origin: first.place.location as GeoPoint,
          destination: last.place.location as GeoPoint,
          intermediates: day.stops
            .slice(0, -1)
            .map((s) => s.place.location as GeoPoint),
          travelMode,
        });
        checked.push({
          day: day.index,
          legs: routed.legs.length,
          totalMeters: routed.totalMeters,
          totalSeconds: routed.totalSeconds,
        });
      } catch {
        // Verification is a bonus; its failure never invalidates the plan.
      }
    }
    if (checked.length > 0) verification = checked;
  }

  const hotels = lodgingFound.map((h) => ({
    placeId: h.placeId,
    hotelName: h.name,
    location: h.address || h.vicinity || "",
    coordinates: h.location ?? null,
    priceLevel: h.priceLevel ?? null,
    rating: h.rating ?? null,
    reviewCount: h.reviewCount ?? null,
    photoName: h.photoName ?? null,
  }));

  return {
    city: {
      placeId: resolved.placeId,
      name: resolved.name,
      location: resolved.location ?? null,
      overview: resolved.editorialSummary ?? null,
      photoName: resolved.photoName ?? null,
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
    degraded,
    metrics: {
      ...metrics,
      totalMeters: Math.round(totalMeters),
      realRoads: verification !== null,
      degraded,
    },
    verification,
    warnings,
    placesSnapshot,
  };
};

export { assignMealRoles, attachMeals, tryInsert, placeMeal };
