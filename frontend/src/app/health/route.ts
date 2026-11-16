import { NextResponse } from "next/server";
import { degradedCapabilities, optional, unsatisfied } from "@/server/env";
import { ping } from "@/server/db/mongo";

/**
 * GET /health — the fleet probe path, kept as an alias.
 *
 * `/api/health` is the real route. This one exists because the health path is
 * configured outside the repository — Coolify's application healthcheck, and
 * whatever monitors the container — so renaming it here would break a setting
 * nobody in this repo can see. Both paths run the same code and return the same
 * JSON.
 *
 * The database check now probes Supabase through the public gateway. It
 * returns 503 when Supabase is unreachable and names every capability that is
 * degraded. An app that answers honestly about its own state is worth more
 * than one that answers "ok" unconditionally.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const databaseUp = await ping();
  const missingKeys = degradedCapabilities();
  const blocking = unsatisfied();

  return NextResponse.json(
    {
      status: databaseUp && blocking.length === 0 ? "ok" : "degraded",
      service: "triptribe-web",
      version: optional("APP_VERSION") ?? "unknown",
      checks: {
        assets: "up",
        database: databaseUp ? "up" : "down",
        places: missingKeys.includes("GOOGLE_PLACES_API_KEY")
          ? "missing"
          : "up",
        routes: missingKeys.includes("GOOGLE_ROUTES_API_KEY")
          ? "estimated"
          : "up",
        openai: missingKeys.includes("OPENAI_KEY") ? "skipped" : "up",
        resend: missingKeys.includes("RESEND_API_KEY") ? "unavailable" : "up",
        auth: missingKeys.includes("SUPABASE_PUBLISHABLE") ? "default" : "up",
      },
    },
    { status: databaseUp ? 200 : 503 },
  );
}
