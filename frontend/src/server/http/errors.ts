import "server-only";
import { NextResponse } from "next/server";
import type { PlanErrorDetail } from "@/server/domain/plan/schema";

/**
 * The one error envelope. `{ error, code, details? }` — the shape the old API
 * returned on 400s, now kept everywhere so `lib/api.ts` has one thing to read
 * (it used to read `body.message`, which no endpoint ever sent, and every
 * failure rendered as "Itinerary request failed").
 */

export type ErrorCode =
  | "BAD_INPUT"
  | "CITY_NOT_FOUND"
  | "EMPTY_POOL"
  | "PLACES_NOT_CONFIGURED"
  | "ROUTES_NOT_CONFIGURED"
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMITED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_INPUT: 400,
  CITY_NOT_FOUND: 400,
  EMPTY_POOL: 400,
  PLACES_NOT_CONFIGURED: 503,
  ROUTES_NOT_CONFIGURED: 503,
  QUOTA_EXHAUSTED: 503,
  RATE_LIMITED: 429,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UPSTREAM_UNAVAILABLE: 502,
  INTERNAL: 500,
};

export interface ErrorBody {
  error: string;
  code: ErrorCode;
  details?: PlanErrorDetail[];
}

export const fail = (
  code: ErrorCode,
  message: string,
  details?: PlanErrorDetail[],
): NextResponse<ErrorBody> =>
  NextResponse.json(
    details ? { error: message, code, details } : { error: message, code },
    { status: STATUS[code] },
  );

/** Map a pipeline/solver throw to the status its code deserves. */
export const failFrom = (error: unknown): NextResponse<ErrorBody> => {
  const code = (error as { code?: string } | null)?.code;
  if (
    code === "BAD_INPUT" ||
    code === "CITY_NOT_FOUND" ||
    code === "EMPTY_POOL"
  ) {
    return fail(
      code,
      code === "BAD_INPUT"
        ? "Invalid itinerary request"
        : "Could not plan that trip",
    );
  }
  if (code === "PLACES_NOT_CONFIGURED" || code === "ROUTES_NOT_CONFIGURED") {
    return fail(code, "The planning service is missing its map data right now");
  }
  if (code === "QUOTA_EXHAUSTED") {
    return fail(
      code,
      "Today's map allowance is spent — planning reopens tomorrow",
    );
  }
  const message =
    error instanceof Error ? error.message : "Internal Server Error";
  return fail("INTERNAL", message);
};
