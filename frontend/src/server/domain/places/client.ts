import "server-only";
import { missing, optional, timeoutMs } from "@/server/env";
import { PlanError, type LatLng, type Place } from "@/server/domain/types";

/**
 * Google Places API (New) client.
 * Ported from `backend/services/places.js` — masks, tiers and normalisation
 * unchanged. Two changes:
 * 1. Keys and timeouts come from `server/env.ts`, so a missing key reports
 *    `PLACES_NOT_CONFIGURED` through `isPlacesConfigured()` instead of
 *    throwing deep inside a fetch.
 * 2. `enrichPlaces([])` returns `{ places: [], failures: [] }`, not `[]`.
 *    The old early-return broke every caller that destructured the result —
 *    a city with no meal shortlist answered 500 (migration bug #2).
 */

const PLACES_BASE = "https://places.googleapis.com/v1";

export const DISCOVERY_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.formattedAddress",
  "places.businessStatus",
  "places.utcOffsetMinutes",
  "places.photos",
];

export const ENRICHMENT_MASK = [
  "places.id",
  "places.displayName",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.regularOpeningHours",
  "places.businessStatus",
];

const ATMOSPHERE_FIELDS: ReadonlySet<string> = new Set([
  "editorialSummary",
  "generativeSummary",
  "servesBreakfast",
  "servesLunch",
  "servesDinner",
  "servesVegetarianFood",
  "servesCoffee",
  "reviews",
  "reviewSummary",
  "goodForChildren",
  "reservable",
  "takeout",
  "dineIn",
]);

const ENTERPRISE_BARE = new Set([
  "rating",
  "userRatingCount",
  "priceLevel",
  "regularOpeningHours",
]);

export const assertMaskIsSafe = (
  mask: readonly string[],
  { allowEnterprise = false }: { allowEnterprise?: boolean } = {},
): readonly string[] => {
  for (const field of mask) {
    const bare = field.replace(/^places\./, "");
    if (ATMOSPHERE_FIELDS.has(bare)) {
      throw new Error(
        `Field "${field}" is Enterprise+Atmosphere and was not budgeted for`,
      );
    }
    if (
      !allowEnterprise &&
      ENRICHMENT_MASK.includes(field) &&
      ENTERPRISE_BARE.has(bare)
    ) {
      throw new Error(
        `Field "${field}" is Enterprise; this call is budgeted for Pro`,
      );
    }
  }
  return mask;
};

/** Exposed so the caller can report a degraded state instead of crashing. */
export const isPlacesConfigured = (): boolean =>
  !missing("GOOGLE_PLACES_API_KEY");

const getApiKey = (): string => {
  const key = optional("GOOGLE_PLACES_API_KEY");
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  return key;
};

export class PlacesRequestError extends Error {
  readonly status: number;
  readonly detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "PlacesRequestError";
    this.status = status;
    this.detail = detail;
  }
}

/**
 * An upstream 429 means Google's per-project daily cap is spent — the same
 * state our own budget models, so it carries our code (bead 9ve). Anything
 * else stays a `PlacesRequestError` for the caller to log or retry.
 */
const requestError = (
  what: string,
  status: number,
  detail: string,
): PlacesRequestError | PlanError =>
  status === 429
    ? new PlanError(
        "QUOTA_EXHAUSTED",
        `${what} hit Google's daily Places cap (upstream 429)`,
      )
    : new PlacesRequestError(what, status, detail);

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  types?: string[];
  formattedAddress?: string;
  businessStatus?: string;
  utcOffsetMinutes?: number;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: number;
  regularOpeningHours?: unknown;
  photos?: { name?: string }[];
  editorialSummary?: unknown;
  vicinity?: string;
}

const get = async (
  path: string,
  fieldMask: readonly string[],
  { allowEnterprise = false }: { allowEnterprise?: boolean } = {},
): Promise<any> => {
  assertMaskIsSafe(fieldMask, { allowEnterprise });
  const wireMask = fieldMask
    .map((field) => field.replace(/^places\./, ""))
    .join(",");
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs("PLACES_TIMEOUT_MS", 15_000),
  );
  try {
    const response = await fetch(`${PLACES_BASE}/${path}`, {
      method: "GET",
      headers: { "X-Goog-Api-Key": getApiKey(), "X-Goog-FieldMask": wireMask },
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw requestError(
        `Places GET ${path}`,
        response.status,
        text.slice(0, 500),
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const post = async (
  path: string,
  body: unknown,
  fieldMask: readonly string[],
): Promise<any> => {
  assertMaskIsSafe(fieldMask);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs("PLACES_TIMEOUT_MS", 15_000),
  );
  try {
    const response = await fetch(`${PLACES_BASE}/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask": fieldMask.join(","),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw requestError(
        `Places ${path}`,
        response.status,
        text.slice(0, 500),
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

export const bareId = (id: unknown): string =>
  String(id ?? "").replace(/^places\//, "");

export interface EnrichedPlace extends Place {
  placeId: string;
  primaryTypeName?: string | null;
  utcOffsetMinutes?: number | null;
  photoName?: string | null;
  vicinity?: string;
  editorialSummary?: unknown;
}

const normalisePlace = (place: RawPlace): EnrichedPlace => {
  const rating = typeof place.rating === "number" ? place.rating : null;
  const userRatingCount =
    typeof place.userRatingCount === "number" ? place.userRatingCount : null;
  const location: LatLng | null =
    typeof place.location?.latitude === "number" &&
    typeof place.location?.longitude === "number"
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : null;
  return {
    id: bareId(place.id),
    placeId: bareId(place.id),
    name: place.displayName?.text ?? "",
    location,
    primaryType: place.primaryType ?? null,
    primaryTypeName: place.primaryTypeDisplayName?.text ?? null,
    types: Array.isArray(place.types) ? place.types : [],
    address: place.formattedAddress ?? "",
    utcOffsetMinutes:
      typeof place.utcOffsetMinutes === "number"
        ? place.utcOffsetMinutes
        : null,
    rating,
    reviewCount: userRatingCount,
    bayesianRating:
      rating === null || userRatingCount === null
        ? (null as unknown as number)
        : (userRatingCount / (userRatingCount + 25)) * rating +
          (25 / (userRatingCount + 25)) * 4.0,
    priceLevel: typeof place.priceLevel === "number" ? place.priceLevel : null,
    regularOpeningHours: place.regularOpeningHours ?? null,
    photoName:
      Array.isArray(place.photos) && place.photos.length > 0
        ? (place.photos[0]?.name ?? null)
        : null,
    businessStatus: place.businessStatus ?? null,
    isOperational:
      place.businessStatus === null ||
      place.businessStatus === undefined ||
      place.businessStatus === "OPERATIONAL",
    vicinity: place.vicinity ?? "",
    editorialSummary: place.editorialSummary ?? null,
  };
};

const scoreCompleteness = (place: EnrichedPlace): number =>
  (place.rating !== null ? 1 : 0) +
  (place.priceLevel !== null ? 1 : 0) +
  (place.regularOpeningHours ? 1 : 0) +
  (place.photoName ? 1 : 0);

const dedupe = (places: EnrichedPlace[]): EnrichedPlace[] => {
  const byId = new Map<string, EnrichedPlace>();
  for (const place of places) {
    if (!place.placeId) continue;
    if (!place.location) continue;
    const existing = byId.get(place.placeId);
    if (!existing || scoreCompleteness(place) > scoreCompleteness(existing)) {
      byId.set(place.placeId, place);
    }
  }
  return [...byId.values()];
};

export const resolveCity = async (
  textQuery: string,
  { language = "en" }: { language?: string } = {},
): Promise<EnrichedPlace[]> => {
  const data = await post(
    "places:searchText",
    { textQuery, languageCode: language, maxResultCount: 5 },
    DISCOVERY_MASK,
  );
  return dedupe(((data.places ?? []) as RawPlace[]).map(normalisePlace));
};

export interface SearchNearbyOptions {
  latitude: number;
  longitude: number;
  includedTypes?: string[];
  radius?: number;
  maxResultCount?: number;
  language?: string;
  rankPreference?: string;
}

export const searchNearby = async ({
  latitude,
  longitude,
  includedTypes,
  radius = 12_000,
  maxResultCount = 20,
  language = "en",
  rankPreference = "POPULARITY",
}: SearchNearbyOptions): Promise<EnrichedPlace[]> => {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new Error("searchNearby requires numeric latitude and longitude");
  }
  if (radius <= 0 || radius > 50_000) {
    throw new Error(
      `radius must be between 0 and 50000 metres, received ${radius}`,
    );
  }
  const body: Record<string, unknown> = {
    locationRestriction: {
      circle: { center: { latitude, longitude }, radius },
    },
    languageCode: language,
    maxResultCount: Math.min(Math.max(maxResultCount, 1), 20),
  };
  if (Array.isArray(includedTypes) && includedTypes.length > 0)
    body.includedTypes = includedTypes;
  if (rankPreference) body.rankPreference = rankPreference;
  const data = await post("places:searchNearby", body, DISCOVERY_MASK);
  return dedupe(((data.places ?? []) as RawPlace[]).map(normalisePlace));
};

export interface EnrichFailure {
  placeId: string;
  error: string;
}

export interface EnrichResult {
  places: EnrichedPlace[];
  failures: EnrichFailure[];
}

export const enrichPlaces = async (
  placeIds: readonly (string | null | undefined)[],
  { concurrency = 4 }: { concurrency?: number } = {},
): Promise<EnrichResult> => {
  const ids = [...new Set(placeIds.filter((id): id is string => Boolean(id)))];
  // Migration fix: the old code returned `[]` here and every caller that
  // destructured `{ places, failures }` crashed with a TypeError → 500.
  if (ids.length === 0) return { places: [], failures: [] };

  const settled: PromiseSettledResult<unknown>[] = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency);
    settled.push(
      ...(await Promise.allSettled(
        batch.map((id) =>
          get(`places/${id}`, ENRICHMENT_MASK, { allowEnterprise: true }),
        ),
      )),
    );
  }

  const enriched: EnrichedPlace[] = [];
  const failures: EnrichFailure[] = [];
  settled.forEach((outcome, index) => {
    const id = ids[index] as string;
    if (outcome.status === "fulfilled") {
      const place = normalisePlace(outcome.value as RawPlace);
      if (place.placeId && place.placeId !== id) {
        failures.push({ placeId: id, error: "id mismatch in response" });
        return;
      }
      enriched.push(place);
    } else {
      const reason = outcome.reason as
        | { message?: string; code?: string }
        | null;
      // An upstream 429 anywhere in the batch means the cap is dry: serving
      // a plan without hours would pretend otherwise, so refuse honestly
      // instead of recording a degradation (bead 9ve).
      if (reason?.code === "QUOTA_EXHAUSTED") throw reason;
      failures.push({
        placeId: id,
        error: reason?.message ?? "enrichment failed",
      });
    }
  });

  return { places: dedupe(enriched), failures };
};
