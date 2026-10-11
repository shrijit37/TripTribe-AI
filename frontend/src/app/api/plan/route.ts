import { NextResponse } from "next/server";
import { parsePlanRequest } from "@/server/domain/plan/schema";
import { generatePlan } from "@/server/domain/plan/generate";
import { getViewer } from "@/server/auth/session";
import { fail, failFrom } from "@/server/http/errors";
import { checkLimit, PLAN_LIMIT } from "@/server/http/rateLimit";

/**
 * POST /api/plan — generate an itinerary.
 * Replaces `POST /api/itenary`. Same 400 shape (`{ error, details }`), but
 * the whole parsed request reaches the solver (pace, travellers, interests,
 * currency included), the quota is checked before anything is spent, and the
 * trip is saved under the session owner — never under the body's email.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const limit = await checkLimit("plan", PLAN_LIMIT);
  if (!limit.allowed) {
    return fail(
      "RATE_LIMITED",
      "Too many plans in the last hour — try again later",
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return fail("BAD_INPUT", "Invalid itinerary request", [
      { path: "body", message: "Request body must be JSON." },
    ]);
  }

  const parsed = parsePlanRequest(body);
  if (!parsed.ok) {
    return fail("BAD_INPUT", "Invalid itinerary request", parsed.errors);
  }

  // Signed-out generation still works (PRODUCT.md); the trip is simply owned
  // by nobody until it is emailed or the visitor signs in.
  const viewer = await getViewer().catch(() => null);

  try {
    const { response, trip, cached } = await generatePlan(
      parsed.value,
      viewer ? { authId: viewer.identity.authId } : null,
    );
    return NextResponse.json({ ...response, tripUuid: trip.uuid, cached });
  } catch (error) {
    return failFrom(error);
  }
}
