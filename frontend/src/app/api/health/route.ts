import { GET as health } from "@/app/health/route";

/**
 * GET /api/health — the real health route.
 *
 * It is a re-export of the `/health` body rather than a second implementation,
 * because there used to be two: `/health` in this app and `/health` in the
 * Express backend, each reporting only what its own process could see, and the
 * deploy gate looping over both of them to decide whether a two-container
 * deploy had converged. One route, one answer, one thing to wait on.
 *
 * The result is 503 when Mongo is unreachable and 200 otherwise. `status` is
 * "ok" or "degraded"; "degraded" is a legitimate healthy state for an app that
 * is built to run with keys missing, and it is not the same as being down.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export { health as GET };
