import "server-only";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import type { EnrichedPlace } from "@/server/domain/places/client";
import type { PlaceCacheDoc } from "@/server/db/documents";

/**
 * The 90-day place cache behind the SEO city pages.
 * Same semantics as `models/placeCacheModel.js`: one entry per Google place
 * id, `enriched` marks real metadata, reads never throw (a dead database
 * means "fetch it live", not "fail the page"), writes never throw (a lost
 * write costs quota, not correctness).
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
    return new Map(rows.map((row) => [row.placeId, row.payload]));
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
