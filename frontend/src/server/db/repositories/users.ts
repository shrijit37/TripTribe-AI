import "server-only";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import type { RecentEntry, UserDoc } from "@/server/db/documents";

/**
 * Users, in one round trip.
 * The old `authenticate` middleware upserted the user and then
 * `userController` re-queried with `findById` — two trips for one answer.
 * `getOrCreate` returns the document from the upsert itself.
 */

export interface SessionIdentity {
  authId: string;
  email: string;
  name: string;
}

export const getOrCreate = async (
  identity: SessionIdentity,
): Promise<UserDoc> => {
  return withDb(async (db) => {
    const col = db.collection<UserDoc>(COLLECTIONS.users);
    const now = new Date();
    const doc = await col.findOneAndUpdate(
      { authId: identity.authId },
      {
        $setOnInsert: {
          authId: identity.authId,
          email: identity.email,
          fname: identity.name?.split(" ")[0] || identity.email,
          recentSearch: [],
          userInterest: [],
          userAddress: "",
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    // `findOneAndUpdate` with upsert always returns a document.
    return doc as unknown as UserDoc;
  });
};

export const findByAuthId = async (authId: string): Promise<UserDoc | null> => {
  return withDb(async (db) =>
    db.collection<UserDoc>(COLLECTIONS.users).findOne({ authId }),
  );
};

/**
 * Record a trip pointer, newest first, capped at 20.
 * The old code pushed the *whole itinerary* into `recentSearch` with no cap —
 * a 16 MB document waiting to happen. This stores a pointer; the plan lives
 * in `trips`.
 */
export const pushRecent = async (
  authId: string,
  entry: RecentEntry,
  cap = 20,
): Promise<void> => {
  await withDb(async (db) => {
    const col = db.collection<UserDoc>(COLLECTIONS.users);
    await col.updateOne(
      { authId },
      {
        $pull: { recentSearch: { tripId: entry.tripId } },
      },
    );
    await col.updateOne(
      { authId },
      {
        $push: { recentSearch: { $each: [entry], $position: 0, $slice: cap } },
        $set: { updatedAt: new Date() },
      },
    );
  });
};
