import "server-only";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import type { EnrichedPlace } from "@/server/domain/places/client";
import type { PlaceCacheDoc } from "@/server/db/documents";
import { isRetentionFresh } from "@/server/domain/places/retention";

/**
 * The 30-day place cache behind the SEO city pages.
 * Same semantics as `models/placeCacheModel.js`: one entry per Google place
 * id, `enriched` marks real metadata, reads never throw (a dead database
 * means "fetch it live", not "fail the page"), writes never throw (a lost
 * write costs quota, not correctness).
 * Retention (bead e88): only the place id may be kept indefinitely — every
 * other cached field expires after 30 days per the Places terms, so stale
 * rows are deleted on read, not merely skipped.
 */
export const readMany = async (
  placeIds: readonly string[],
): Promise<Map<string, EnrichedPlace>> => {
  try {
    const rows = await withDb(async (db) =>
      db
        .collection<PlaceCacheDoc>(COLLECTIONS.placeCache)
        .find({ placeId: { $in: [...placeIds] } })
        .toArray(),
    );
    const fresh = rows.filter((row) =>
      isRetentionFresh(row.updatedAt ?? row.createdAt),
    );
    const staleIds = rows
      .filter((row) => !isRetentionFresh(row.updatedAt ?? row.createdAt))
      .map((row) => row.placeId);
    if (staleIds.length > 0) {
      // Best effort: the terms say expired data must be deleted. A failed
      // delete only means the next read retries it, never a thrown error.
      await withDb(async (db) =>
        db
          .collection<PlaceCacheDoc>(COLLECTIONS.placeCache)
          .deleteMany({ placeId: { $in: staleIds } }),
      ).catch(() => undefined);
    }
    return new Map(fresh.map((row) => [row.placeId, row.payload]));
  } catch {
    return new Map();
  }
};

export const writeMany = async (
  entries: readonly EnrichedPlace[],
): Promise<void> => {
  if (entries.length === 0) return;
  try {
    await withDb(async (db) =>
      db.collection<PlaceCacheDoc>(COLLECTIONS.placeCache).bulkWrite(
        entries.map((place) => ({
          updateOne: {
            filter: { placeId: place.placeId },
            update: {
              $set: {
                placeId: place.placeId,
                name: place.name,
                payload: place,
                enriched: true,
                updatedAt: new Date(),
              },
              $setOnInsert: { createdAt: new Date() },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      ),
    );
  } catch {
    // Cache write is an optimisation. Swallowed on purpose — see module doc.
  }
};
