import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth/session";
import { listByUserId } from "@/server/db/repositories/trips";
import { fail } from "@/server/http/errors";

/**
 * GET /api/trips — the account drawer's list.
 * Replaces `GET /api/itenary/all`. Same item shape (`cityName`, `time`,
 * `itenary`, `uuid`), now read from `trips` instead of the denormalised
 * `user.recentSearch`. Signed-out callers get 401, as before.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) {
    return fail("UNAUTHENTICATED", "Sign in to see your trips");
  }
  try {
    const trips = await listByUserId(viewer.identity.authId);
    return NextResponse.json(trips);
  } catch {
    return fail("INTERNAL", "Could not load trips right now");
  }
}
