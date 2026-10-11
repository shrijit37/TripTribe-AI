import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth/session";
import { findByUuidForUser, replacePlan } from "@/server/db/repositories/trips";
import { fail } from "@/server/http/errors";

/**
 * PATCH /api/trips/[tripId] — update the delivery address on a trip.
 * Ownership first: a signed-in caller may only touch their own trips; a
 * signed-out trip (ownerless, uuid-unguessable) may only be touched without a
 * session. The address is delivery-only — it never becomes identity.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const viewer = await getViewer().catch(() => null);

  let body: { userEmail?: unknown } = {};
  try {
    body = (await request.json()) as { userEmail?: unknown };
  } catch {
    return fail("BAD_INPUT", "Request body must be JSON");
  }

  const userEmail =
    typeof body.userEmail === "string" ? body.userEmail.trim() : "";
  if (!userEmail || !EMAIL.test(userEmail)) {
    return fail("BAD_INPUT", "A valid email address is required", [
      { path: "userEmail", message: "Email is not a valid address." },
    ]);
  }

  try {
    const trip = await findByUuidForUser(
      tripId,
      viewer?.identity.authId ?? null,
    );
    if (!trip) return fail("NOT_FOUND", "No such trip");
    if (viewer && trip.userId !== viewer.identity.authId) {
      return fail("FORBIDDEN", "This trip belongs to someone else");
    }
    const updated = { ...trip.itenary };
    const ok = await replacePlan(tripId, updated);
    if (!ok) return fail("INTERNAL", "Could not save that change");
    // The address lives on the trip row, not inside the rendered payload.
    const { withDb } = await import("@/server/db/mongo");
    const { COLLECTIONS } = await import("@/server/db/mongo");
    await withDb(async (db) =>
      db
        .collection(COLLECTIONS.trips)
        .updateOne(
          { uuid: tripId },
          { $set: { userEmail, updatedAt: new Date() } },
        ),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return fail("INTERNAL", "Could not save that change");
  }
}
