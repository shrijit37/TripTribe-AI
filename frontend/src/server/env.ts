/**
 * Every environment variable this app reads, read once.
 *
 * The Express backend grew a dozen `process.env` reads scattered across
 * controllers and services, so "which keys does this deployment have?" was only
 * answerable by grepping. This module is the single answer: it names every
 * variable, says whether it is required, and gives the health route
 * something honest to report.
 *
 * Two rules, and they pull in opposite directions:
 *
 * 1. Missing keys must NOT crash the app. PRODUCT.md's promise is that the
 *    product boots degraded and says which capability is missing, rather than
 *    showing a stack trace. So nothing here throws at import time.
 * 2. Missing keys must NOT be silently ignored. A capability that cannot run
 *    reports `missing("GOOGLE_PLACES_API_KEY")` and the caller decides: the
 *    solver returns `PLACES_NOT_CONFIGURED` (503), the narrator drops its prose
 *    and the plan still renders.
 *
 * The database and auth moved from MongoDB + a shared Better Auth hub to the
 * fleet Supabase project. SUPABASE_URL and SUPABASE_PUBLISHABLE are public
 * values and ship with safe baked-in fallbacks; only the service-role
 * SUPABASE_SECRET is required, and it is read at request time (never baked into
 * the client bundle or the image).
 */

/** Public, safe-to-commit defaults for the fleet Supabase gateway. */
export const SUPABASE_URL_FALLBACK =
  "https://supabase.shrijit.tech/rjrynmjugsxuytpotfma";
export const SUPABASE_PUBLISHABLE_FALLBACK =
  "sb_publishable_gB-4dti01NmMggaCj-o2cY-YsmWkw2_SxAiBHKaIoYQ_CyNbUZzt";

/** Names of every variable, as a union, so a typo is a compile error. */
export type EnvKey =
  | "SUPABASE_URL"
  | "SUPABASE_PUBLISHABLE"
  | "SUPABASE_SECRET"
  | "GOOGLE_PLACES_API_KEY"
  | "GOOGLE_ROUTES_API_KEY"
  | "GOOGLE_CUSTOM_SEARCH_API_KEY"
  | "OPENAI_KEY"
  | "OPENAI_BASE_URL"
  | "OPENAI_MODEL"
  | "NARRATOR_MODEL"
  | "RESEND_API_KEY"
  | "RESEND_FROM"
  | "APP_VERSION"
  | "PLACES_TIMEOUT_MS"
  | "ROUTES_TIMEOUT_MS"
  | "SCRAPER_BASE_URL"
  | "SCRAPER_TIMEOUT_MS"
  | "INTERNAL_PREWARM_TOKEN";
/**
 * What each capability needs. `required` marks the ones with no degraded
 * fallback at all; `fallback` documents what happens when it is absent.
 */
export const ENV_SPEC = {
  SUPABASE_URL: { required: false, fallback: SUPABASE_URL_FALLBACK },
  SUPABASE_PUBLISHABLE: {
    required: false,
    fallback: "bundled fleet publishable (anon) key",
  },
  SUPABASE_SECRET: {
    required: true,
    fallback: "no database writes — service role key missing",
  },
  GOOGLE_PLACES_API_KEY: {
    required: false,
    fallback: "solver returns PLACES_NOT_CONFIGURED (503)",
  },
  GOOGLE_ROUTES_API_KEY: {
    required: false,
    fallback:
      "travel times fall back to the geodesic estimate in solver/geo.ts",
  },
  GOOGLE_CUSTOM_SEARCH_API_KEY: {
    required: false,
    fallback: "city hero image falls back to a placeholder",
  },
  OPENAI_KEY: {
    required: false,
    fallback: "narrator is skipped; places keep their factual descriptions",
  },
  OPENAI_BASE_URL: {
    required: false,
    fallback: "https://openrouter.ai/api/v1",
  },
  OPENAI_MODEL: {
    required: false,
    fallback: "google/gemini-2.0-flash-lite-001",
  },
  NARRATOR_MODEL: { required: false, fallback: "OPENAI_MODEL" },
  RESEND_API_KEY: {
    required: false,
    fallback: "email hand-off is unavailable",
  },
  RESEND_FROM: { required: false, fallback: "Resend's onboarding address" },
  APP_VERSION: { required: false, fallback: "unknown" },
  PLACES_TIMEOUT_MS: { required: false, fallback: "15000" },
  ROUTES_TIMEOUT_MS: { required: false, fallback: "20000" },
  SCRAPER_BASE_URL: {
    required: false,
    fallback: "scrape fallback is inert; the planner serves Google only",
  },
  SCRAPER_TIMEOUT_MS: { required: false, fallback: "120000" },
  INTERNAL_PREWARM_TOKEN: {
    required: false,
    fallback: "POST /api/internal/prewarm refuses every call (no prewarm)",
  },
} as const satisfies Record<EnvKey, { required: boolean; fallback: string }>;

const trimmed = (value: string | undefined): string | null => {
  const next = value?.trim();
  return next ? next : null;
};

/**
 * Read one variable, or report it missing. Callers that need a key for a
 * capability check `missing()` first; callers that genuinely cannot proceed
 * throw with the variable named.
 */
export const missing = (key: EnvKey): boolean =>
  trimmed(process.env[key]) === null;

/** The value, or null. Use for optional capabilities. */
export const optional = (key: EnvKey): string | null =>
  trimmed(process.env[key]);

/**
 * The value, or a thrown error naming the variable. Use only where there is no
 * degraded mode — today that is `SUPABASE_SECRET` and nowhere else.
 */
export function required(key: EnvKey): string {
  const value = trimmed(process.env[key]);
  if (value === null) {
    throw new Error(
      `${key} is not set. ${ENV_SPEC[key].fallback}. See .env.example.`,
    );
  }
  return value;
}

/** Public values with baked-in safe fallbacks, for server and client setup. */
export const supabaseUrl = (): string =>
  optional("SUPABASE_URL") ?? SUPABASE_URL_FALLBACK;
export const supabasePublishable = (): string =>
  optional("SUPABASE_PUBLISHABLE") ?? SUPABASE_PUBLISHABLE_FALLBACK;

/** A positive integer variable, or the given default. */
export function timeoutMs(key: EnvKey, fallback: number): number {
  const raw = trimmed(process.env[key]);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * Which optional capabilities this deployment cannot serve. The health route
 * publishes this, and the degraded banner a visitor sees is built from it, so
 * "honest under missing keys" is one function rather than a judgement call at
 * each call site.
 */
export function degradedCapabilities(): EnvKey[] {
  return (Object.keys(ENV_SPEC) as EnvKey[]).filter(
    (key) => !ENV_SPEC[key].required && missing(key),
  );
}

/**
 * Whether a variable that must be present is present. Only SUPABASE_SECRET
 * today; this exists so the health route can fail rather than silently
 * degrade on a database it cannot write to.
 */
export function unsatisfied(): EnvKey[] {
  return (Object.keys(ENV_SPEC) as EnvKey[]).filter(
    (key) => ENV_SPEC[key].required && missing(key),
  );
}
