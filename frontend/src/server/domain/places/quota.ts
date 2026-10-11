import "server-only";
import { addCount, getCount, monthKey } from "@/server/db/repositories/usage";

/**
 * The Places monthly budget, enforced before a single call is spent.
 * `rating`, `priceLevel` and `regularOpeningHours` are Enterprise on every
 * Places endpoint with a 1,000 calls/month allowance. A plan costs ~20
 * enrichment calls plus 3 discovery calls, so the pipeline projects its cost
 * *before* running: when the remaining allowance cannot cover the request, it
 * answers `QUOTA_EXHAUSTED` (503) with honest copy instead of serving a plan
 * scheduled without real opening hours and pretending otherwise.
 */

export const MONTHLY_PLACES_ALLOWANCE = 1000;

/** What a full plan costs, by shape. Discovery is Pro (free tier); enrichment is Enterprise. */
export const projectPlanCost = ({
  days,
  stopsPerDay,
}: {
  days: number;
  stopsPerDay: number;
}): number => days * stopsPerDay * 2 + 8 + 12;

export const placesUsedThisMonth = async (at = new Date()): Promise<number> =>
  getCount(monthKey("places", at));

export const recordPlacesSpent = async (
  calls: number,
  at = new Date(),
): Promise<number> => addCount(monthKey("places", at), calls);

/**
 * Whether the projected cost fits the remaining allowance.
 * Returns the shortfall (0 when it fits) so the route can report it.
 */
export const quotaShortfall = async (
  projected: number,
  at = new Date(),
): Promise<{ fits: boolean; used: number; remaining: number }> => {
  const used = await placesUsedThisMonth(at);
  const remaining = Math.max(0, MONTHLY_PLACES_ALLOWANCE - used);
  return { fits: projected <= remaining, used, remaining };
};
