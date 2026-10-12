import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { INDEXED_CITIES, toSlug } from "@/lib/seo";
import { optional } from "@/server/env";
import { fail } from "@/server/http/errors";
import { resolveCity } from "@/server/domain/places/client";
import {
  isScraperConfigured,
  submitScrape,
  waitForScrape,
  downloadScrape,
} from "@/server/domain/places/scraper";
import { writePrewarm } from "@/server/domain/places/fallback";
import { writeMany } from "@/server/db/repositories/placeCache";

export const runtime = "nodejs";
export const maxDuration = 300;

// One scrape job per pool, tuned to what the solver and catalogue read:
// sights carry ratings/hours for the itinerary, meals and lodging fill the
// daily pools. zoom 15 + radius 5km keeps the result within the solver's
// 9km discovery ring while staying dense enough to fill each pool.
const POOLS = [
  { key: "sights", keywords: ["museum", "monument", "landmark", "park", "attraction"] },
  { key: "meals", keywords: ["restaurant", "cafe", "bar"] },
  { key: "lodging", keywords: ["hotel", "hostel", "guest house"] },
] as const;

interface PrewarmBody {
  city: string;
  sights: string[];
  meals: string[];
  lodging: string[];
}

/**
 * POST /api/internal/prewarm — refresh the scraper snapshot for curated cities.
 *
 * Called weekly by a GitHub Action. For each requested city it resolves a
 * centre (one Google call), runs three scrape jobs (sights / meals / lodging),
 * writes every returned place into placeCache, and records an ordered id
 * snapshot that the quota fallback in pipeline.ts / catalogue.ts reads when
 * Google's daily cap is dry (bead gr1).
 *
 * Guarded by a bearer token (INTERNAL_PREWARM_TOKEN). With no token configured
 * the route refuses every call, so an unconfigured deployment is inert rather
 * than an open scraper proxy.
 */
export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const token = optional("INTERNAL_PREWARM_TOKEN");
  const offered = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || offered !== token) {
    return fail("UNAUTHENTICATED", "Missing or invalid prewarm token");
  }
  if (!isScraperConfigured()) {
    return fail("UPSTREAM_UNAVAILABLE", "Scraper fallback is not configured");
  }

  let cities: string[];
  try {
    const body = (await request.json()) as { cities?: unknown };
    cities = Array.isArray(body.cities)
      ? (body.cities.filter((c): c is string => typeof c === "string").map((c) => c.trim()).filter(Boolean))
      : [...INDEXED_CITIES];
  } catch {
    cities = [...INDEXED_CITIES];
  }
  if (cities.length === 0) {
    return fail("BAD_INPUT", "No cities to prewarm");
  }

  const results: Record<string, { ok: boolean; sights: number; meals: number; lodging: number; error?: string }> = {};
  for (const city of cities) {
    try {
      const [resolved] = await resolveCity(city);
      const centre = resolved?.location;
      if (!centre) {
        results[toSlug(city)] = { ok: false, sights: 0, meals: 0, lodging: 0, error: "unresolvable city" };
        continue;
      }
      const { lat, lng } = centre;
      const snapshot: PrewarmBody = { city, sights: [], meals: [], lodging: [] };
      for (const pool of POOLS) {
        const jobId = await submitScrape({
          name: `prewarm-${toSlug(city)}-${pool.key}`,
          keywords: [...pool.keywords],
          lang: "en",
          zoom: 15,
          lat,
          lon: lng,
          radius: 5000,
          depth: 5,
        });
        await waitForScrape(jobId);
        const places = await downloadScrape(jobId);
        await writeMany(places);
        snapshot[pool.key] = places.map((p) => p.placeId);
      }
      await writePrewarm(city, snapshot);
      results[toSlug(city)] = {
        ok: true,
        sights: snapshot.sights.length,
        meals: snapshot.meals.length,
        lodging: snapshot.lodging.length,
      };
    } catch (error) {
      results[toSlug(city)] = {
        ok: false,
        sights: 0, meals: 0, lodging: 0,
        error: error instanceof Error ? error.message : "unknown",
      };
    }
  }
  return NextResponse.json({ ok: true, results });
};
