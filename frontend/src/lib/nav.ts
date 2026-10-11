/**
 * Carrying state across navigations.
 *
 * `react-router` had a `location.state` channel for this: Search navigated to
 * `/result` with the whole payload attached, and Result read it back off the
 * location. App Router has no equivalent, and the obvious substitute — a query
 * parameter — would put a multi-kilobyte plan into a URL that ends up in
 * browser history, referrer headers and server logs.
 *
 * So payloads are parked in `sessionStorage` under one-shot keys and consumed
 * on arrival. Storage, not memory: a hard reload on `/result` must still find
 * the plan rather than render an empty page.
 *
 * The keys are kept apart on purpose. Reopening an old trip must never show the
 * plan the visitor generated ten seconds ago because the other key was left
 * behind, and the Hero's form seed is a different shape from a plan entirely.
 */
import type { PlanPayload } from "./types";

const PLAN_KEY = "triptribe:result";
const TRIP_KEY = "triptribe:trip";
export const HERO_SEED_KEY = "triptribe:hero-seed";

const park = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or disabled store (private mode, quota) must not break the
    // navigation — the destination falls back to asking for a trip instead.
  }
};

const take = (key: string): unknown => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Park the plan Search just generated, then navigate to `/result`. */
export const storeResult = (plan: PlanPayload) => park(PLAN_KEY, plan);

/** Claim a parked plan, if there is one. Consumed once. */
export const takeResult = (): PlanPayload | null => {
  const value = take(PLAN_KEY);
  // A key left behind by an older build, or a hand-edited store, must not be
  // trusted to be a plan — the destination indexes straight into it.
  return value && typeof value === "object" && "city" in value
    ? (value as PlanPayload)
    : null;
};

/** Park a saved trip being reopened from the account drawer. */
export const storeTripPlan = (plan: PlanPayload) => park(TRIP_KEY, plan);

/** Claim a reopened trip. Consumed once. */
export const takeTripPlan = (): PlanPayload | null => {
  const value = take(TRIP_KEY);
  return value && typeof value === "object" && "city" in value
    ? (value as PlanPayload)
    : null;
};

/**
 * The Hero slip's three values on their way to the Search stepper: the
 * destination, days and budget the visitor has already typed.
 *
 * Not a plan — nothing has been asked of the backend yet — so it travels
 * under its own key with its own shape.
 */
export interface HeroSeed {
  cityName: string;
  days: string;
  budget: string;
}

export const storeSeed = (seed: HeroSeed) => park(HERO_SEED_KEY, seed);

/**
 * Claim the slip. Null when absent or malformed, which Search treats as a
 * first-time visitor arriving with empty fields.
 */
export const takeSeed = (): HeroSeed | null => {
  const value = take(HERO_SEED_KEY);
  if (!value || typeof value !== "object") return null;
  const seed = value as Partial<HeroSeed>;
  return {
    cityName: typeof seed.cityName === "string" ? seed.cityName : "",
    days: typeof seed.days === "string" ? seed.days : "",
    budget: typeof seed.budget === "string" ? seed.budget : "",
  };
};