import { NextResponse } from "next/server";
import { buildCityCatalogue } from "@/server/domain/catalogue";
import { fail } from "@/server/http/errors";

/**
 * GET /api/seo/city-catalogue?city= — data behind the public city pages.
 * Replaces `GET /api/seo/city-catalogue` in place (same path, so the
 * server-side catalogue reader needs no change). Same city-name cap, same
 * cache headers, same 404-when-unresolvable.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CITY = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]{1,60}$/u;

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get("city")?.trim() ?? "";
  if (!CITY.test(city)) {
    return fail("BAD_INPUT", "city must be a plain city name");
  }
  try {
    const catalogue = await buildCityCatalogue(city, { limit: 18 });
    if (!catalogue) {
      return fail("NOT_FOUND", `No places found for "${city}"`);
    }
    return NextResponse.json(catalogue, {
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return fail("UPSTREAM_UNAVAILABLE", "Places are unavailable right now");
  }
}
