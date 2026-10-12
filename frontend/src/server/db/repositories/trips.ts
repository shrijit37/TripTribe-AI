import "server-only";
import { randomUUID } from "node:crypto";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import type { ComposedResponse } from "@/server/domain/compose";
import type { EnrichedPlace } from "@/server/domain/places/client";
import type { TripDoc } from "@/server/db/documents";

/**
 * Trips: one document per generated plan, owned by the session's `userId`.
 * Stored in the existing `itenaries` collection under the old field names
 * (`uuid`, `city`, `itenary`) so nothing already saved stops reading.
 */
export type { TripDoc };

export interface CreateTripInput {
  city: string;
  itenary: ComposedResponse;
  userId: string | null;
  userEmail: string;
  days: number;
  budget: number;
  currency: string;
  travellers: number;
  pace: string;
  placesSnapshot: EnrichedPlace[];
}

export const createTrip = async (input: CreateTripInput): Promise<TripDoc> => {
  const doc: TripDoc = {
    uuid: randomUUID(),
    city: input.city,
    itenary: input.itenary,
    userId: input.userId,
    userEmail: input.userEmail,
    days: input.days,
    budget: input.budget,
    currency: input.currency,
    travellers: input.travellers,
    pace: input.pace,
    placesSnapshot: input.placesSnapshot,
    snapshotAt: new Date().toISOString(),
    emailSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await withDb(async (db) => {
    await db.collection<TripDoc>(COLLECTIONS.trips).insertOne(doc);
  });
  return doc;
};

export interface TripSummary {
  cityName: string;
  time: Date | undefined;
  itenary: ComposedResponse;
  uuid: string;
}

/**
 * The account drawer's list. Same shape `GET /api/itenary/all` always
 * returned (`cityName`, `time`, `itenary`, `uuid`), now read from `trips`
 * instead of the denormalised `user.recentSearch`.
 */
export const listByUserId = async (
  userId: string,
  limit = 20,
): Promise<TripSummary[]> => {
  return withDb(async (db) => {
    const rows = await db
      .collection<TripDoc>(COLLECTIONS.trips)
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return rows.map((row) => ({
      cityName: row.city,
      time: row.createdAt,
      itenary: row.itenary,
      uuid: row.uuid,
    }));
  });
};

export const findByUuidForUser = async (
  uuid: string,
  userId: string | null,
): Promise<TripDoc | null> => {
  // Signed-out trips have `userId: null` and are addressable only by their
  // unguessable uuid — the same property that makes them safe to email.
  return withDb(async (db) =>
    db.collection<TripDoc>(COLLECTIONS.trips).findOne({ uuid, userId }),
  );
};

export const replacePlan = async (
  uuid: string,
  itenary: ComposedResponse,
): Promise<boolean> => {
  const result = await withDb(async (db) =>
    db
      .collection<TripDoc>(COLLECTIONS.trips)
      .updateOne({ uuid }, { $set: { itenary, updatedAt: new Date() } }),
  );
  return result.modifiedCount > 0;
};

export const markEmailed = async (uuid: string, at: string): Promise<void> => {
  await withDb(async (db) => {
    await db
      .collection<TripDoc>(COLLECTIONS.trips)
      .updateOne(
        { uuid },
        { $set: { emailSentAt: at, updatedAt: new Date() } },
      );
  });
};
