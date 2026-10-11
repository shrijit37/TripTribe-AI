import "server-only";
import { missing, optional, timeoutMs } from "@/server/env";
import { haversineMeters } from "@/server/domain/solver/geo";
import type { GeoPoint, LatLng } from "@/server/domain/types";

/**
 * Google Routes API client.
 * Ported from `backend/services/routes.js` — endpoints, caps and the
 * Essentials-by-default billing posture unchanged. One deletion: the file
 * carried its own unguarded `haversineMeters` that threw on bad input; the
 * null-safe `solver/geo.ts` implementation is re-exported instead
 * (migration bug #8).
 */

const ROUTES_BASE = "https://routes.googleapis.com";
const DIRECTIONS_V2 = `${ROUTES_BASE}/directions/v2:computeRoutes`;
const MATRIX_V2 = `${ROUTES_BASE}/distanceMatrix/v2:computeRouteMatrix`;

export const MAX_ELEMENTS = 625;
export const MAX_MATRIX_ELEMENTS = MAX_ELEMENTS;

export const isRoutesConfigured = (): boolean =>
  !missing("GOOGLE_ROUTES_API_KEY") || !missing("GOOGLE_PLACES_API_KEY");

const getApiKey = (): string => {
  const key =
    optional("GOOGLE_ROUTES_API_KEY") ?? optional("GOOGLE_PLACES_API_KEY");
  if (!key) throw new Error("GOOGLE_ROUTES_API_KEY is not configured");
  return key;
};

export class RoutesRequestError extends Error {
  readonly status: number;
  readonly detail?: string;
  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "RoutesRequestError";
    this.status = status;
    this.detail = detail;
  }
}

const request = async (
  url: string,
  body: unknown,
  fieldMask: string,
): Promise<any> => {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs("ROUTES_TIMEOUT_MS", 20_000),
  );
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": getApiKey(),
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new RoutesRequestError(
        `Routes request failed: ${response.status}`,
        response.status,
        text.slice(0, 500),
      );
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

export const parseDurationSeconds = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed.endsWith("s")) {
    const seconds = Number(trimmed.slice(0, -1));
    return Number.isFinite(seconds) && seconds >= 0 && /^[\d.]+s$/.test(trimmed)
      ? seconds
      : null;
  }
  const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  return (
    Number(match[1] ?? 0) * 3600 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
};

type WaypointInput =
  { lat?: unknown; lng?: unknown; location?: unknown } | LatLng;

export const toLatLng = (
  place: WaypointInput,
): { location: { latLng: { latitude: number; longitude: number } } } => {
  const raw = place as {
    lat?: unknown;
    lng?: unknown;
    location?: { lat?: unknown; lng?: unknown } | null;
  };
  const lat = typeof raw?.lat === "number" ? raw.lat : raw?.location?.lat;
  const lng = typeof raw?.lng === "number" ? raw.lng : raw?.location?.lng;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    throw new Error(
      "toLatLng requires numeric coordinates, either { lat, lng } or { location: { lat, lng } }",
    );
  }
  return { location: { latLng: { latitude: lat, longitude: lng } } };
};

export interface OptimizedRouteLeg {
  seconds: number | null;
  meters: number | null;
}

export interface OptimizedRoute {
  order: number[];
  legs: OptimizedRouteLeg[];
  totalSeconds: number;
  totalMeters: number;
}

export interface OptimizeOptions {
  origin: GeoPoint;
  destination?: GeoPoint | null;
  intermediates?: GeoPoint[];
  travelMode?: string;
  departureTime?: string | null;
  language?: string;
}

export const computeRoutesOptimized = async ({
  origin,
  destination,
  intermediates = [],
  travelMode = "WALK",
  departureTime = null,
  language = "en",
}: OptimizeOptions): Promise<OptimizedRoute> => {
  const stops = intermediates.filter(Boolean);
  if (!origin) throw new Error("computeRoutesOptimized requires an origin");
  if (stops.length === 0)
    return { order: [], legs: [], totalSeconds: 0, totalMeters: 0 };
  if (stops.length > 25) {
    throw new Error(
      `A single day may hold at most 25 stops, received ${stops.length}`,
    );
  }
  const body: Record<string, unknown> = {
    origin: toLatLng(origin as WaypointInput),
    destination: toLatLng((destination ?? origin) as WaypointInput),
    travelMode,
    languageCode: language,
    optimizeWaypointOrder: true,
    intermediates: stops.map((place) => ({
      ...toLatLng(place as WaypointInput),
      via: false,
    })),
  };
  if (departureTime) body.departureTime = departureTime;

  const data = await request(
    DIRECTIONS_V2,
    body,
    "routes.optimizedIntermediateWaypointIndex,routes.duration,routes.distanceMeters,routes.legs.duration,routes.legs.distanceMeters,routes.legs.startLocation,routes.legs.endLocation",
  );
  const route = data.routes?.[0] as
    | {
        optimizedIntermediateWaypointIndex?: number[];
        duration?: unknown;
        distanceMeters?: number;
        legs?: { duration?: unknown; distanceMeters?: number }[];
      }
    | undefined;
  if (!route) {
    const error = new RoutesRequestError(
      "Routes returned no route",
      502,
      JSON.stringify(data).slice(0, 300),
    );
    throw error;
  }
  const indices = route.optimizedIntermediateWaypointIndex ?? [];
  const order =
    Array.isArray(indices) && indices.length > 0
      ? indices
      : stops.map((_, i) => i);
  const legs = (route.legs ?? []).map((leg) => ({
    seconds: parseDurationSeconds(leg.duration),
    meters: typeof leg.distanceMeters === "number" ? leg.distanceMeters : null,
  }));
  return {
    order,
    legs,
    totalSeconds:
      parseDurationSeconds(route.duration) ??
      legs.reduce((sum, leg) => sum + (leg.seconds ?? 0), 0),
    totalMeters:
      typeof route.distanceMeters === "number"
        ? route.distanceMeters
        : legs.reduce((sum, leg) => sum + (leg.meters ?? 0), 0),
  };
};

export interface MatrixEntry {
  seconds: number | null;
  meters: number | null;
  condition: string | null;
  ok: boolean;
}

export const computeRouteMatrix = async ({
  origins,
  destinations,
  travelMode = "DRIVE",
  departureTime = null,
}: {
  origins: GeoPoint[];
  destinations: GeoPoint[];
  travelMode?: string;
  departureTime?: string | null;
}): Promise<{ costs: Map<string, MatrixEntry>; elements: number }> => {
  if (origins.length === 0 || destinations.length === 0) {
    throw new Error(
      "computeRouteMatrix requires at least one origin and one destination",
    );
  }
  const elements = origins.length * destinations.length;
  if (elements > MAX_ELEMENTS) {
    throw new Error(
      `Matrix of ${origins.length}×${destinations.length} = ${elements} elements exceeds the ${MAX_ELEMENTS} per-request maximum; split it or use computeRoutesOptimized`,
    );
  }
  if (departureTime && travelMode === "TRANSIT" && elements > 100) {
    throw new Error(
      `Traffic-aware or transit matrices are capped at 100 elements, received ${elements}`,
    );
  }
  const body: Record<string, unknown> = {
    origins: origins.map((o) => toLatLng(o as WaypointInput)),
    destinations: destinations.map((d) => toLatLng(d as WaypointInput)),
    travelMode,
  };
  if (departureTime) body.departureTime = departureTime;

  const data = (await request(
    MATRIX_V2,
    body,
    "originIndex,destinationIndex,duration,distanceMeters,status,condition",
  )) as any[];
  const costs = new Map<string, MatrixEntry>();
  for (const entry of data ?? []) {
    const key = `${entry.originIndex},${entry.destinationIndex}`;
    costs.set(key, {
      seconds: parseDurationSeconds(entry.duration),
      meters:
        typeof entry.distanceMeters === "number" ? entry.distanceMeters : null,
      condition: entry.condition ?? null,
      ok: (entry.condition ?? "ROUTE_EXISTS") === "ROUTE_EXISTS",
    });
  }
  return { costs, elements };
};

/** The one distance function. Null-safe; never throws, never NaN. */
export { haversineMeters };
