import "server-only";

/**
 * Places-content retention: what may be persisted, and for how long.
 *
 * Verified 2026-10-12 against the live terms (bead e88):
 * - Place IDs are exempt from the caching restrictions and may be stored
 *   indefinitely ("You can therefore store place ID values indefinitely",
 *   Places API policies; "Google ID Caching", Service Specific Terms).
 * - Latitude/longitude from Places may be cached up to 30 consecutive
 *   calendar days, after which they must be deleted (Service Terms, Caching).
 * - Every other Places field must not be pre-fetched, cached or stored
 *   beyond the allowed exceptions (Places API policies). Read strictly, that
 *   leaves no allowance at all for names, ratings, hours and the rest — the
 *   30-day ceiling below is applied to the whole cached payload uniformly as
 *   a mitigation, not as a permission slip. If counsel disagrees, the fix is
 *   to shrink the payload to `{ placeId, lat, lng }`, not to lengthen this.
 * - The narrator (domain/narrate.ts) is handed placeId + name + type only —
 *   no ratings, reviews, hours or addresses reach the model — kept minimal
 *   under "no creating content from Maps content" (ToS 3.2.3(c) family).
 *
 * Enforced where the data lives: `placeCache.readMany` (stale rows are
 * deleted, not just skipped), the city-resolution cache in catalogue.ts, and
 * the trip `placesSnapshot` via `snapshotStaleReason` on the regenerate
 * route. The 24 h plan cache and 7-day prewarm snapshots sit inside the
 * ceiling already and need no check.
 */
export const PLACES_CONTENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** True when `when` is a date within the retention window. */
export const isRetentionFresh = (when: Date | string | undefined): boolean => {
  if (!when) return false;
  const at = new Date(when).getTime();
  if (!Number.isFinite(at)) return false;
  return Date.now() - at <= PLACES_CONTENT_RETENTION_MS;
};

interface SnapshotAged {
  /** Set on every trip written since the retention fix; absent before it. */
  snapshotAt?: string;
  /** Immutable-ish (never bumped by re-plans or emails); legacy fallback. */
  createdAt?: Date | string;
}

/**
 * Why this trip's saved place data must no longer be re-planned from, or
 * null when it is still inside the window. `updatedAt` is deliberately NOT
 * a fallback: re-plans and emails bump it without refreshing the data.
 */
export const snapshotStaleReason = (trip: SnapshotAged): string | null => {
  if (isRetentionFresh(trip.snapshotAt ?? trip.createdAt)) return null;
  return (
    "This trip's saved place data is older than 30 days, so day-regeneration " +
    "is disabled — generate the trip again for fresh availability and hours"
  );
};
