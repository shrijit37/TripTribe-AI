import "server-only";
import type { Place } from "@/server/domain/types";

/**
 * What counts as food, and what counts as a sight.
 * Extracted from `backend/solver/pipeline.js` so the wire-shaping layer
 * (`domain/compose.ts`) no longer imports the orchestrator to ask `isMeal`.
 * Sets unchanged.
 */

export const MEAL_TYPES: ReadonlySet<string> = new Set([
  "restaurant",
  "cafe",
  "bakery",
  "food_court",
  "fast_food_restaurant",
  "meal_takeaway",
  "ice_cream_shop",
]);

export const FOOD_TYPES: ReadonlySet<string> = new Set([
  ...MEAL_TYPES,
  "confectionery",
  "tea_house",
]);

export const SIGHT_TYPES: readonly string[] = [
  "tourist_attraction",
  "museum",
  "historical_landmark",
  "monument",
  "art_gallery",
  "park",
  "castle",
  "shopping_mall",
];

export const MEAL_IDEAL = Object.freeze({
  breakfast: 9 * 60,
  lunch: 13 * 60,
  dinner: 19 * 60,
});

export const MEAL_WINDOWS = Object.freeze({
  breakfast: [0, 11 * 60],
  lunch: [11 * 60 + 30, 15 * 60 + 30],
  dinner: [18 * 60, 24 * 60],
}) as Record<"breakfast" | "lunch" | "dinner", readonly [number, number]>;

export const MEAL_MAX_DETOUR = 1400;

type TaxonomyPlace = Pick<Place, "primaryType" | "types"> & {
  primaryType?: string | null;
  types?: string[] | null;
};

export const isMeal = (place: TaxonomyPlace | null | undefined): boolean =>
  (place?.types ?? []).some((t) => FOOD_TYPES.has(t)) ||
  (place?.primaryType ? FOOD_TYPES.has(place.primaryType) : false);
