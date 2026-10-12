import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth/session";
import { findByUuidForUser, replacePlan } from "@/server/db/repositories/trips";
import {
  regenerateDay,
  RegenError,
  type RegenScope,
} from "@/server/domain/plan/regenerate";
import { snapshotStaleReason } from "@/server/domain/places/retention";
import { fail } from "@/server/http/errors";
import { checkLimit, PLAN_LIMIT } from "@/server/http/rateLimit";

/**
 * POST /api/trips/[tripId]/regenerate — re-plan one day, zero Places calls.
 * Body: `{ dayIndex: number, scope: "day" | "meals" | "order" }`.
 * Everything it uses is already on the trip (`placesSnapshot`), so this is
 * rate-limited as a planning act but never touches the monthly allowance.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SCOPES: RegenScope[] = ["day", "meals", "order"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const limit = await checkLimit("regenerate", PLAN_LIMIT);
  if (!limit.allowed) {
    return fail(
      "RATE_LIMITED",
      "Too many re-plans in the last hour — try again later",
    );
  }

  const { tripId } = await params;
  let body: { dayIndex?: unknown; scope?: unknown } = {};
  try {
    body = (await request.json()) as { dayIndex?: unknown; scope?: unknown };
  } catch {
    return fail("BAD_INPUT", "Request body must be JSON");
  }

  const dayIndex = Number(body.dayIndex);
  if (!Number.isInteger(dayIndex) || dayIndex < 0) {
    return fail("BAD_INPUT", "dayIndex must be a non-negative whole number", [
      {
        path: "dayIndex",
        message: "dayIndex must be a non-negative whole number.",
      },
    ]);
  }
  if (
    typeof body.scope !== "string" ||
    !SCOPES.includes(body.scope as RegenScope)
  ) {
    return fail("BAD_INPUT", 'scope must be "day", "meals" or "order"', [
      { path: "scope", message: 'scope must be "day", "meals" or "order".' },
    ]);
  }

  const viewer = await getViewer().catch(() => null);
  try {
    const trip = await findByUuidForUser(
      tripId,
      viewer?.identity.authId ?? null,
    );
    if (!trip) return fail("NOT_FOUND", "No such trip");
    if (viewer && trip.userId !== viewer.identity.authId) {
      return fail("FORBIDDEN", "This trip belongs to someone else");
    }
    // Retention (bead e88): only the place id may be kept indefinitely, so a
    // snapshot older than 30 days can no longer back a re-plan.
    const stale = snapshotStaleReason(trip);
    if (stale) return fail("BAD_INPUT", stale);
    const patched = regenerateDay(trip, dayIndex, body.scope as RegenScope);
    const ok = await replacePlan(tripId, patched);
    if (!ok) return fail("INTERNAL", "Could not save the re-planned day");
    return NextResponse.json({ ...patched, tripUuid: tripId });
  } catch (error) {
    if (error instanceof RegenError) {
      if (error.status === 404) return fail("NOT_FOUND", error.message);
      return fail("BAD_INPUT", error.message);
    }
    return fail("INTERNAL", "Could not re-plan that day right now");
  }
}
