import "server-only";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import type { UsageDoc } from "@/server/db/documents";

/**
 * Monotonic counters in Mongo: `{ _id: "places:2026-10", count }`.
 * Backs the Places monthly budget (`domain/places/quota.ts`) and the rate
 * limits (`http/rateLimit.ts`). Mongo-backed rather than in-process so a
 * restart or a second container cannot reset the month.
 */
export const getCount = async (key: string): Promise<number> => {
  try {
    const row = await withDb(async (db) =>
      db.collection<UsageDoc>(COLLECTIONS.usage).findOne({ _id: key }),
    );
    return row?.count ?? 0;
  } catch {
    // A counter that cannot be read must not fail the request it guards.
    // Callers treat "unknown" as zero and the quota check stays permissive
    // rather than refusing every plan during a database blip.
    return 0;
  }
};

export const addCount = async (key: string, by: number): Promise<number> => {
  try {
    const result = await withDb(async (db) =>
      db
        .collection<UsageDoc>(COLLECTIONS.usage)
        .findOneAndUpdate(
          { _id: key },
          { $inc: { count: by }, $set: { updatedAt: new Date() } },
          { upsert: true, returnDocument: "after" },
        ),
    );
    return (result as unknown as UsageDoc | null)?.count ?? by;
  } catch {
    return by;
  }
};

export const monthKey = (prefix: string, at = new Date()): string =>
  `${prefix}:${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;

export const hourKey = (prefix: string, at = new Date()): string =>
  `${monthKey(prefix, at)}-${String(at.getUTCHours()).padStart(2, "0")}`;
