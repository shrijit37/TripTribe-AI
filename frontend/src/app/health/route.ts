import { NextResponse } from "next/server";

/**
 * The uniform fleet health contract.
 *
 * nginx answered this before serving the SPA. Moving to Next.js means this
 * route has to answer it, with the same JSON shape, because the deploy gate in
 * `deploy.yml` reads `status` and `version` off both services.
 *
 * Evaluated per request, not statically: `version` is the commit SHA supplied
 * at container start, and the gate compares it against the SHA it just pushed.
 * Cached at build time, this route would bake in the build machine's value and
 * the gate could never tell one deployed build from another.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "triptribe-web",
    version: process.env.APP_VERSION ?? "unknown",
    checks: { assets: "up" },
  });
}