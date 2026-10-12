import "server-only";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import { readMany } from "@/server/db/repositories/placeCache";
import { toSlug } from "@/lib/seo";
import type { EnrichedPlace } from "@/server/domain/places/client";

/**
 * Serve a plan from a prewarm snapshot when Google's Places cap is spent.
 *
 * The weekly cron (`POST /api/internal/prewarm`) scrapes each curated city
 * once, writes the full `EnrichedPlace` payloads into `placeCache`, and records
 * which ids belonged to which pool under `prewarm:<citySlug>`. When a live plan
 * hits a 429 (see `domain/places/client.ts`), the planner reads that snapshot
 * instead of failing — the places are already enriched, so no Google call is
 * needed to serve them.
 *
 * TTL is 7 days: older than that and the snapshot is treated as absent, so the
 * planner falls through to an honest `QUOTA_EXHAUSTED` rather than a stale plan.
 */

const PREWARM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** The snapshot document: ordered place ids per pool, plus when it was written. */
export interface PrewarmSnapshot {
  at: string;
  sights: string[];
  meals: string[];
  lodging: string[];
}

/** Hydrated pools: the full places behind a snapshot's ids. */
export interface PrewarmPlaces {
  sights: EnrichedPlace[];
  meals: EnrichedPlace[];
  lodging: EnrichedPlace[];
}

const prewarmId = (city: string): string => `prewarm:${toSlug(city)}`;

export const readPrewarm = async (
  city: string,
): Promise<PrewarmSnapshot | null> => {
  try {
    const row = await withDb(async (db) =>
      db
        .collection<{ _id: string; value: PrewarmSnapshot }>(
          COLLECTIONS.placeCache,
        )
        .findOne({ _id: prewarmId(city) }),
    );
    if (!row?.value) return null;
    if (Date.now() - new Date(row.value.at).getTime() > PREWARM_TTL_MS)
      return null;
    return row.value;
  } catch {
    return null;
  }
};

export const writePrewarm = async (
  city: string,
  value: Omit<PrewarmSnapshot, "at">,
): Promise<void> => {
  try {
    await withDb(async (db) =>
      db
        .collection<{ _id: string; value: PrewarmSnapshot }>(
          COLLECTIONS.placeCache,
        )
        .updateOne(
          { _id: prewarmId(city) },
          { $set: { value: { ...value, at: new Date().toISOString() } } },
          { upsert: true },
        ),
    );
  } catch {
    // A lost snapshot only costs the next 429 its fallback.
  }
};

/**
 * Read a snapshot and hydrate its ids from `placeCache`. Returns null when the
 * city has no fresh snapshot, so the caller can surface an honest refusal.
 */
export const readPrewarmPlaces = async (
  city: string,
): Promise<PrewarmPlaces | null> => {
  const snapshot = await readPrewarm(city);
  if (!snapshot) return null;
  const all = [...snapshot.sights, ...snapshot.meals, ...snapshot.lodging];
  if (all.length === 0) return null;
  const cached = await readMany(all);
  const hydrate = (ids: readonly string[]): EnrichedPlace[] =>
    ids
      .map((id) => cached.get(id))
      .filter((p): p is EnrichedPlace => Boolean(p));
  return {
    sights: hydrate(snapshot.sights),
    meals: hydrate(snapshot.meals),
    lodging: hydrate(snapshot.lodging),
  };
};

/** True when the error is our upstream-429 quota signal (see client.ts). */
export const isQuotaError = (error: unknown): boolean =>
  (error as { code?: string } | null)?.code === "QUOTA_EXHAUSTED";
