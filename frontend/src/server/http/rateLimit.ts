import "server-only";
import { cookies, headers } from "next/headers";
import { addCount, getCount, hourKey } from "@/server/db/repositories/usage";

/**
 * Per-caller rate limits, counted in Mongo.
 * The old API had none: `POST /api/itenary` spends ~20 Enterprise Places calls
 * per request against a 1,000/month allowance, so 50 requests from one client
 * could burn the month for everyone. Limits are deliberately coarse — 5/hour
 * signed-out, 20/hour signed in — because a plan is a considered act, not a
 * keystroke.
 */

export interface LimitRule {
  /** Requests allowed per hour. */
  signedOut: number;
  signedIn: number;
}

export const PLAN_LIMIT: LimitRule = { signedOut: 5, signedIn: 20 };
export const EMAIL_LIMIT: LimitRule = { signedOut: 1, signedIn: 5 };
export const IMAGE_LIMIT: LimitRule = { signedOut: 30, signedIn: 60 };

const callerKey = async (namespace: string): Promise<string> => {
  const jar = await headers();
  const forwarded = jar.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() || jar.get("x-real-ip") || "unknown";
  // Signed-in callers share a higher bucket keyed by bucket-kind, not by the
  // cookie's value — the value never belongs in a counter key.
  const authed = (await cookies())
    .toString()
    .includes("better-auth.session_token");
  return `${namespace}:${authed ? "user" : "anon"}:${ip}`;
};

export const checkLimit = async (
  namespace: string,
  rule: LimitRule,
): Promise<{ allowed: boolean; remaining: number }> => {
  const key = hourKey(`ratelimit:${namespace}:${await callerKey(namespace)}`);
  const authed = key.includes(":user:");
  const limit = authed ? rule.signedIn : rule.signedOut;
  const used = await getCount(key);
  if (used >= limit) return { allowed: false, remaining: 0 };
  await addCount(key, 1);
  return { allowed: true, remaining: Math.max(0, limit - used - 1) };
};
