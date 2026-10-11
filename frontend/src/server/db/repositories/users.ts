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

/**
 * Editable profile fields — the port of Express `PUT /profile`.
 * Identity (`authId`, `email`) is never writable here: it comes from the
 * Better Auth cookie, not the request body. Sanitising lives here so the
 * route stays a thin auth + status-code shell.
 */
export interface ProfilePatch {
  fname?: string;
  lname?: string;
  userInterest?: string[];
  userAddress?: string;
}

const cleanName = (value: string, max = 60): string =>
  value.trim().slice(0, max);

const cleanInterests = (values: string[]): string[] => {
  const seen = new Set<string>();
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const cleaned = raw.trim().slice(0, 40);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size >= 20) break;
  }
  return [...seen];
};

export const updateProfile = async (
  authId: string,
  patch: ProfilePatch,
): Promise<UserDoc | null> => {
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.fname !== undefined) {
    const fname = cleanName(patch.fname);
    if (fname) set.fname = fname;
  }
  if (patch.lname !== undefined) {
    const lname = cleanName(patch.lname);
    // An emptied last name removes the field rather than storing "".
    if (lname) set.lname = lname;
  }
  if (patch.userInterest !== undefined && Array.isArray(patch.userInterest)) {
    set.userInterest = cleanInterests(patch.userInterest);
  }
  if (patch.userAddress !== undefined) {
    set.userAddress =
      typeof patch.userAddress === "string"
        ? patch.userAddress.trim().slice(0, 200)
        : "";
  }
  if (patch.lname !== undefined && !set.lname) {
    // `$unset` cannot share the same update document shape cleanly here, so
    // handle the clear-name case with its own update below.
  }
  return withDb(async (db) => {
    const col = db.collection<UserDoc>(COLLECTIONS.users);
    if (patch.lname !== undefined && !set.lname) {
      await col.updateOne({ authId }, { $unset: { lname: "" } });
      delete set.lname;
    }
    const doc = await col.findOneAndUpdate(
      { authId },
      { $set: set },
      { returnDocument: "after" },
    );
    return (doc ?? null) as unknown as UserDoc | null;
  });
};

/**
 * Delete-account cleanup: the local profile plus every trip it owns.
 * The Better Auth identity itself is deleted through the auth service
 * (`POST /api/auth/delete-user`); this removes what TripTribe stored.
 */
export const deleteUserData = async (authId: string): Promise<void> => {
  await withDb(async (db) => {
    await db.collection(COLLECTIONS.trips).deleteMany({ userId: authId });
    await db.collection<UserDoc>(COLLECTIONS.users).deleteOne({ authId });
  });
};
