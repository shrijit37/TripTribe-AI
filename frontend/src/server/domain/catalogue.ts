import "server-only";
import {
  enrichPlaces,
  isPlacesConfigured,
  resolveCity,
  searchNearby,
  type EnrichedPlace,
} from "@/server/domain/places/client";
import { readMany, writeMany } from "@/server/db/repositories/placeCache";
import { readPrewarmPlaces, isQuotaError } from "@/server/domain/places/fallback";
import { PLACES_CONTENT_RETENTION_MS } from "@/server/domain/places/retention";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import type { LatLng } from "@/server/domain/types";

/**
 * The place catalogue behind the public city pages.
 * Ported from `backend/services/catalogue.js` — cold-city costs one enrichment
 * pass, then serves from cache forever; a city Google cannot resolve yields
 * null and the page says so. Only the imports changed (client + repository
 * instead of `places.js` + Mongoose model).
 */

export const CATALOGUE_TYPES: readonly string[] = Object.freeze([
  "tourist_attraction",
  "historical_landmark",
  "museum",
  "monument",
  "castle",
  "art_gallery",
  "park",
  "shopping_mall",
]);

export interface CatalogueEntry {
  placeId: string;
  name: string;
  category: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  address: string;
  lat: number | null;
  lng: number | null;
  opensToday: string | null;
}

export interface CityCatalogue {
  city: string;
  /** Google's own name for the city; falls back to what was asked for. */
  resolvedName: string;
  /** Non-null because a null centre is how this function says "no such city". */
  centre: { lat: number; lng: number };
  region: string;
  entries: CatalogueEntry[];
  enriched: boolean;
  generatedAt: string;
}

export const toCatalogueEntry = (place: EnrichedPlace): CatalogueEntry => {
  const hours = place.regularOpeningHours as {
    weekdayDescriptions?: string[];
  } | null;
  const descriptions = Array.isArray(hours?.weekdayDescriptions)
    ? (hours?.weekdayDescriptions as string[])
    : null;
  return {
    placeId: place.placeId,
    name: place.name,
    category: place.primaryTypeName ?? place.primaryType ?? "place",
    rating: place.rating ?? null,
    reviewCount: place.reviewCount ?? null,
    priceLevel: place.priceLevel ?? null,
    address: place.address ?? "",
    lat: place.location?.lat ?? null,
    lng: place.location?.lng ?? null,
    opensToday: descriptions
      ? (descriptions[descriptions.length - 1] ?? null)
      : null,
  };
};

/**
 * The city resolution itself, cached for 30 days.
 *
 * `resolveCity` is one Places call and it happens on *every* render, even with
 * every place already cached. That mattered when these pages were prerendered at
 * build time and mattered more once they render on demand: a crawler walking
 * the sitemap would have spent one search per page view. So the answer to "what
 * is Jaipur's place id and where is it" is stored beside the places, and a warm
 * city costs one indexed read and no Google calls at all.
 *
 * Retention (bead e88): the row holds a name, address and coordinates alongside
 * the place id, so it shares the 30-day Places-content ceiling — only the
 * place id itself may be kept indefinitely.
 */
interface CityResolution {
  placeId: string;
  name: string;
  location: LatLng;
  region: string;
}

const CITY_TTL_MS = PLACES_CONTENT_RETENTION_MS;
const readCity = async (slug: string): Promise<CityResolution | null> => {
  try {
    const row = await withDb(async (db) =>
      db
        .collection<{ _id: string; at: string; value: CityResolution }>(
          COLLECTIONS.placeCache,
        )
        .findOne({ _id: `city:${slug.toLowerCase()}` }),
    );
    if (!row) return null;
    if (Date.now() - new Date(row.at).getTime() > CITY_TTL_MS) return null;
    return row.value;
  } catch {
    return null;
  }
};

const writeCity = async (
  slug: string,
  value: CityResolution,
): Promise<void> => {
  try {
    await withDb(async (db) =>
      db
        .collection<{ _id: string; at: string; value: CityResolution }>(
          COLLECTIONS.placeCache,
        )
        .updateOne(
          { _id: `city:${slug.toLowerCase()}` },
          { $set: { at: new Date().toISOString(), value } },
          { upsert: true },
        ),
    );
  } catch {
    // A lost city entry costs one search on the next render.
  }
};

const rankScore = (entry: CatalogueEntry): number | null => {
  if (entry.rating == null) return null;
  const reviews = entry.reviewCount ?? 0;
  return (
    (reviews / (reviews + 25)) * entry.rating + (25 / (reviews + 25)) * 4.0
  );
};

export const buildCityCatalogue = async (
  city: string,
  { limit = 18 }: { limit?: number } = {},
): Promise<CityCatalogue | null> => {
  if (!city || !isPlacesConfigured()) return null;

  let centre = await readCity(city);
  if (!centre) {
    const [resolved] = await resolveCity(city);
    if (!resolved?.location) return null;
    centre = {
      placeId: resolved.placeId,
      name: resolved.name,
      location: resolved.location,
      region: resolved.address ?? "",
    };
    await writeCity(city, centre);
  }
  let entries: CatalogueEntry[];
  try {
    const discovered = await searchNearby({
      latitude: centre.location.lat,
      longitude: centre.location.lng,
      includedTypes: [...CATALOGUE_TYPES],
      radius: 12_000,
      maxResultCount: Math.min(Math.max(limit, 1), 20),
    });

    const ids = discovered.map((place) => place.placeId);
    const cached = await readMany(ids);
    const missing = ids.filter((id) => !cached.has(id));

    if (missing.length > 0) {
      const { places } = await enrichPlaces(missing);
      await writeMany(places);
      for (const place of places) cached.set(place.placeId, place);
    }

    entries = discovered
      .map((place) => cached.get(place.placeId) ?? place)
      .map(toCatalogueEntry)
      .filter((entry) => entry.name && entry.lat != null);
  } catch (error) {
    // Google's daily Places cap is spent (upstream 429 → QUOTA_EXHAUSTED).
    // Serve the week-old prewarm snapshot rather than blanking the page
    // (bead 9ve); if there is no snapshot, surface the honest refusal.
    if (!isQuotaError(error)) throw error;
    const snapshot = await readPrewarmPlaces(city);
    if (!snapshot) throw error;
    entries = snapshot.sights.map(toCatalogueEntry).filter((entry) => entry.name && entry.lat != null);
  }

  entries.sort((a, b) => (rankScore(b) ?? -1) - (rankScore(a) ?? -1));

  return {
    city: centre.name || city,
    resolvedName: centre.name || city,
    centre: centre.location,
    region: centre.region,
    entries: entries.slice(0, limit),
    enriched: entries.some((entry) => entry.rating != null),
    generatedAt: new Date().toISOString(),
  };
};
