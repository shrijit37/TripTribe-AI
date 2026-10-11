import { NextResponse } from "next/server";
import { getViewer } from "@/server/auth/session";
import { findByUuidForUser, markEmailed } from "@/server/db/repositories/trips";
import { isMailConfigured, sendPlanEmail } from "@/server/domain/mail";
import { fail } from "@/server/http/errors";
import { checkLimit, EMAIL_LIMIT } from "@/server/http/rateLimit";

/**
 * POST /api/plan/email — send a generated plan to an inbox.
 * Body: `{ tripUuid: string, to?: string }`.
 * - Signed-in owner: may send to any address, up to the limit.
 * - Signed-out (ownerless trip): may send once, and only to the address given
 *   at generation time — the hand-off, not a relay.
 * Without `RESEND_API_KEY` the route says so plainly instead of failing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isMailConfigured()) {
    return fail("BAD_INPUT", "Email hand-off is not available right now");
  }

  const limit = await checkLimit("email", EMAIL_LIMIT);
  if (!limit.allowed) {
    return fail(
      "RATE_LIMITED",
      "Too many emails in the last hour — try again later",
    );
  }

  let body: { tripUuid?: unknown; to?: unknown } = {};
  try {
    body = (await request.json()) as { tripUuid?: unknown; to?: unknown };
  } catch {
    return fail("BAD_INPUT", "Request body must be JSON");
  }
  if (typeof body.tripUuid !== "string" || !body.tripUuid) {
    return fail("BAD_INPUT", "tripUuid is required", [
      { path: "tripUuid", message: "tripUuid is required." },
    ]);
  }

  const viewer = await getViewer().catch(() => null);
  try {
    const trip = await findByUuidForUser(
      body.tripUuid,
      viewer?.identity.authId ?? null,
    );
    if (!trip) return fail("NOT_FOUND", "No such trip");

    let to: string;
    if (viewer && trip.userId === viewer.identity.authId) {
      to = typeof body.to === "string" ? body.to.trim() : "";
      if (!to || !EMAIL.test(to)) {
        return fail("BAD_INPUT", "A valid destination address is required", [
          { path: "to", message: "Email is not a valid address." },
        ]);
      }
    } else if (!viewer && trip.userId === null) {
      // Ownerless trip: the one send goes to the address from generation.
      if (trip.emailSentAt) {
        return fail("RATE_LIMITED", "This plan has already been sent");
      }
      to = trip.userEmail;
      if (!to || !EMAIL.test(to)) {
        return fail(
          "BAD_INPUT",
          "This trip has no delivery address to send to",
        );
      }
    } else {
      return fail("FORBIDDEN", "This trip belongs to someone else");
    }

    const { id } = await sendPlanEmail({ to, plan: trip.itenary });
    await markEmailed(trip.uuid, new Date().toISOString());
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof Error && error.message.includes("RESEND_API_KEY")) {
      return fail("BAD_INPUT", "Email hand-off is not available right now");
    }
    return fail("UPSTREAM_UNAVAILABLE", "Could not send that email right now");
  }
}
