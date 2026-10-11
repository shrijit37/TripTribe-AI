import { NextResponse } from "next/server";
import { optional, missing } from "@/server/env";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import { fail } from "@/server/http/errors";
import { checkLimit, IMAGE_LIMIT } from "@/server/http/rateLimit";

/**
 * GET /api/plan/image?query= — city hero image via Custom Search.
 * Replaces `GET /api/itenary/city-image`. Same upstream call, two fixes:
 * the result is cached 30 days by query (the old route paid a billable call
 * on every render with no cache, no auth and no limit), and the key comes
 * from `env.ts` instead of a `VITE_` leftover.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CX = "c63fff3e039f04940";
const CACHE_MS = 30 * 24 * 60 * 60 * 1000;

interface ImageCacheRow {
  _id: string;

  data: any;
  at: string;
}

export async function GET(request: Request) {
  const limit = await checkLimit("image", IMAGE_LIMIT);
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Too many image requests — try again later");
  }

  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) return fail("BAD_INPUT", "Missing query parameter");
  if (missing("GOOGLE_CUSTOM_SEARCH_API_KEY")) {
    return fail("BAD_INPUT", "City images are unavailable right now");
  }

  const key = `img:${query.toLowerCase()}`;
  try {
    const row = await withDb(async (db) =>
      db.collection<ImageCacheRow>(COLLECTIONS.planCache).findOne({ _id: key }),
    );
    if (row && Date.now() - new Date(row.at).getTime() < CACHE_MS) {
      return NextResponse.json(row.data);
    }
  } catch {
    // Cache miss on a dead database: fetch live rather than fail the image.
  }

  const apiKey = optional("GOOGLE_CUSTOM_SEARCH_API_KEY") as string;
  const url =
    `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}` +
    `&searchType=image&cx=${CX}&key=${apiKey}`;
  try {
    const googleRes = await fetch(url);

    const data = (await googleRes.json()) as any;
    try {
      await withDb(async (db) =>
        db.collection<ImageCacheRow>(COLLECTIONS.planCache).updateOne(
          { _id: key },
          {
            $set: { data, at: new Date().toISOString() },
            $setOnInsert: { _id: key },
          },
          { upsert: true },
        ),
      );
    } catch {
      // Lost cache write costs quota, not correctness.
    }
    return NextResponse.json(data);
  } catch {
    return fail(
      "UPSTREAM_UNAVAILABLE",
      "City images are unavailable right now",
    );
  }
}
