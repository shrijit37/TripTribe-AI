import "server-only";
import { addCount, getCount, dayKey } from "@/server/db/repositories/usage";

/**
 * The Places daily budget, enforced before a call is spent.
 *
 * Google's real ceiling is per-project per-day: `SearchNearbyRequestPerDayPerProject`
 * = 100/day and `GetPlaceRequestPerDayPerProject` = 100/day (measured
 * 2026-10-12, project 1024136789335). The old model assumed a 1,000/month
 * Enterprise allowance, which is the wrong axis (bead 5uz): discovery and
 * enrichment are separate metrics, and both reset at 00:00 UTC.
 *
 * So this module tracks two counters and answers `QUOTA_EXHAUSTED` (503)
 * with honest copy when either one cannot cover the next plan, instead of
 * spending the cap and letting a real upstream 429 surface as an opaque 500.
 */

export const DAILY_DISCOVERY_ALLOWANCE = 100;
export const DAILY_ENRICHMENT_ALLOWANCE = 100;

/** Discovery: 3×searchNearby (sights/meals/lodging) + 1×resolveCity.
 * Enrichment: sights shortlist (days×stopsPerDay×2+8) + meals shortlist (12). */
export interface PlanCost {
  discovery: number;
  enrichment: number;
}

export const projectPlanCost = ({
  days,
  stopsPerDay,
}: {
  days: number;
  stopsPerDay: number;
}): PlanCost => ({
  discovery: 4,
  enrichment: days * stopsPerDay * 2 + 8 + 12,
});

export const recordPlacesSpent = async (
  cost: PlanCost,
  at = new Date(),
): Promise<void> => {
  await Promise.all([
    addCount(dayKey("places-discovery", at), cost.discovery),
    addCount(dayKey("places-enrichment", at), cost.enrichment),
  ]);
};

/**
 * Whether the projected cost fits today's remaining allowance on *both*
 * axes. Returns the used/remaining pair for each so the refusal can say
 * which cap is dry.
 */
export const quotaShortfall = async (
  projected: PlanCost,
  at = new Date(),
): Promise<{
  fits: boolean;
  discovery: { used: number; remaining: number };
  enrichment: { used: number; remaining: number };
}> => {
  const [discoveryUsed, enrichmentUsed] = await Promise.all([
    getCount(dayKey("places-discovery", at)),
    getCount(dayKey("places-enrichment", at)),
  ]);
  const discovery = {
    used: discoveryUsed,
    remaining: Math.max(0, DAILY_DISCOVERY_ALLOWANCE - discoveryUsed),
  };
  const enrichment = {
    used: enrichmentUsed,
    remaining: Math.max(0, DAILY_ENRICHMENT_ALLOWANCE - enrichmentUsed),
  };
  return {
    fits:
      projected.discovery <= discovery.remaining &&
      projected.enrichment <= enrichment.remaining,
    discovery,
    enrichment,
  };
};
