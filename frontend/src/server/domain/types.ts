/**
 * The shapes the solver passes between its own steps.
 *
 * The backend carried these as untyped JavaScript, so every step re-derived
 * what it was being handed and nothing caught a drift. These are the types the
 * ported solver agrees on; the wire shape the React app renders stays in
 * `src/lib/types.ts`, because that is a different contract with different
 * tolerances (it must survive a null `Budget` from an older build).
 */

/** A point on the earth. `lat`/`lng`, not GeoJSON order. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Anything that carries a position. Places arrive from Google either bare or
 * wrapped in `{ location }`, and the old helpers all accepted both, so this
 * union is the honest type for a solver input.
 */
export type GeoPoint = LatLng | { location?: LatLng | null };

/** The position inside a GeoPoint, or null if it has none. */
export function pointOf(value: GeoPoint): LatLng | null {
  // `in` throws on a nullish left operand, and the backend reached for
  // optional chaining here (`a?.lat`), so a place that arrives with no
  // location at all must fall through to the `null` below rather than throw.
  const raw: unknown =
    value !== null && typeof value === "object" && "lat" in value
      ? value
      : (value as { location?: LatLng | null } | null | undefined)?.location;
  if (!raw || typeof raw !== "object") return null;
  const { lat, lng } = raw as Partial<LatLng>;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
/** Travel modes the solver schedules for. BICYCLE is estimated, never verified. */
export const TRAVEL_MODES = ["WALK", "TRANSIT", "DRIVE", "BICYCLE"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const isTravelMode = (value: unknown): value is TravelMode =>
  typeof value === "string" &&
  (TRAVEL_MODES as readonly string[]).includes(value);

/**
 * A place as the solver sees it: Google's fields plus the two the solver
 * derives. `bayesianRating` and `isOperational` are computed once during
 * enrichment so every later step ranks and filters identically.
 */
export interface Place {
  id: string;
  name: string;
  /** Google's primary type, e.g. `museum`, `restaurant`. */
  primaryType?: string | null;
  /** Every type Google assigned, used for the meal/sight taxonomy. */
  types?: string[];
  address?: string | null;
  location?: LatLng | null;
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: number | null;
  websiteUri?: string | null;
  googleMapsUri?: string | null;
  regularOpeningHours?: unknown;
  businessStatus?: string | null;
  /** rating shrunk toward 4.0 by review count — see domain/places. */
  bayesianRating: number;
  /** null businessStatus counts as operational; Google omits it for live places. */
  isOperational: boolean;
  /** Narrative attached by the narrator, keyed by place id. Absent if skipped. */
  narration?: string | null;
  /** Fields returned for the destination card but not stored or costed. */
  atmosphere?: Record<string, unknown> | null;
}

/** One meal placed inside a day: the place, the role it fills, when, and why. */
export interface MealSlot {
  role: "breakfast" | "lunch" | "dinner";
  place: Place;
  /** Minutes from midnight of the traveler's local day. */
  at: number;
  /** How far the meal sat from its neighbours, in metres. */
  detourMeters?: number | null;
}

/** One stop in a day: when it starts, how long it holds you, and what it costs. */
export interface ScheduledActivity {
  place: Place;
  /** Minutes from midnight. */
  start: number;
  dwellMinutes: number;
  kind: "sight" | "meal";
  mealRole?: MealSlot["role"];
  /** True when Routes confirmed the leg rather than the estimate. */
  verified?: boolean;
}

/** A planned day: its stops, its meals, and the hours it spans. */
export interface PlannedDay {
  index: number;
  activities: ScheduledActivity[];
  meals: MealSlot[];
  startMinutes: number;
  endMinutes: number;
  /** 0 = Sunday, matching `Date#getDay`. */
  weekday: number;
  totalMeters: number;
  /** Real travel minutes from Routes, or null when Routes was not consulted. */
  verifiedMinutes?: number | null;
}

/** The cost verdict for a whole trip. See domain/solver/cost.ts. */
export interface CostBreakdown {
  accommodation: number;
  meals: number;
  activities: number;
  transportation: number;
}

export interface CostResult {
  currency: string;
  headcount: number;
  days: number;
  total: number;
  perDay: number;
  perPersonPerDay: number;
  breakdown: CostBreakdown;
  /** True when every figure came from bands rather than from real prices. */
  isEstimate: boolean;
  budget: number;
  feasible: boolean;
  shortfall: number;
  suggestions: string[];
}

/** Why a plan could not be produced. Maps to an HTTP status in http/errors.ts. */
export const PLAN_ERROR_CODES = [
  "PLACES_NOT_CONFIGURED",
  "ROUTES_NOT_CONFIGURED",
  "BAD_INPUT",
  "CITY_NOT_FOUND",
  "EMPTY_POOL",
  "QUOTA_EXHAUSTED",
] as const;
export type PlanErrorCode = (typeof PLAN_ERROR_CODES)[number];

/** The thrown form of a plan failure. Carries a code, never just a message. */
export class PlanError extends Error {
  readonly code: PlanErrorCode;
  readonly details?: unknown;

  constructor(code: PlanErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "PlanError";
    this.code = code;
    this.details = details;
  }
}
