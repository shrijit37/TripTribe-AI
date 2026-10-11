import { NextResponse } from "next/server";

/**
 * The uniform fleet health contract.
 *
 * nginx answered this before serving the SPA. Moving to Next.js means this
 * route has to answer it, with the exact same JSON shape, because the deploy
 * gate in `deploy.yml` greps for `"status":"ok"` on both services and a
 * changed shape reads as a failed deploy rather than a renamed service.
 */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "triptribe-web",
    version: process.env.APP_VERSION ?? "unknown",
    checks: { assets: "up" },
  });
}