import { NextResponse } from "next/server";
import { degradedCapabilities, optional, unsatisfied } from "@/server/env";
import { ping } from "@/server/db/mongo";

/**
 * GET /health — the fleet probe path, kept as an alias.
 *
 * `/api/health` is the real route. This one exists because the health path is
 * configured outside the repository — Dokploy's application healthcheck, and
 * whatever monitors the container — so renaming it here would break a setting
 * nobody in this repo can see. Both paths run the same code and return the same
 * JSON.
 *
 * What changed from the old version: it reported `checks: { assets: "up" }` and
 * a hardcoded `"status": "ok"`, unconditionally, having asked nothing. This one
 * pings Mongo and returns 503 when the database is unreachable, and names every
 * capability that is degraded. An app that answers honestly about its own state
 * is worth more than one that answers "ok" unconditionally.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mongoUp = await ping();
  const missingKeys = degradedCapabilities();
  const blocking = unsatisfied();

  return NextResponse.json(
    {
      status: mongoUp && blocking.length === 0 ? "ok" : "degraded",
      service: "triptribe-web",
      version: optional("APP_VERSION") ?? "unknown",
      checks: {
        assets: "up",
        mongo: mongoUp ? "up" : "down",
        places: missingKeys.includes("GOOGLE_PLACES_API_KEY")
          ? "missing"
          : "up",
        routes: missingKeys.includes("GOOGLE_ROUTES_API_KEY")
          ? "estimated"
          : "up",
        openai: missingKeys.includes("OPENAI_KEY") ? "skipped" : "up",
        resend: missingKeys.includes("RESEND_API_KEY") ? "unavailable" : "up",
        auth: missingKeys.includes("AUTH_URL") ? "default" : "up",
      },
    },
    { status: mongoUp ? 200 : 503 },
  );
}
