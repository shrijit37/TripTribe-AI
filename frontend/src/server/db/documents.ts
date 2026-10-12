import "server-only";
import type { ObjectId } from "mongodb";
import type { ComposedResponse } from "@/server/domain/compose";
import type { EnrichedPlace } from "@/server/domain/places/client";

/**
 * Document shapes for the four collections. No ODM: these are the types the
 * repositories read and write, and nothing coerces at the boundary — `schema.ts`
 * already decided the request contract, so a second assertion at write time
 * would only ever disagree with it.
 *
 * Collection names live in `db/mongo.ts` (`COLLECTIONS`); the `trips` documents
 * below are stored in the existing `itenaries` collection with the old field
 * names (`uuid`, `city`, `itenary`) kept, so the cutover needs no migration.
 * New fields are additive; old documents simply lack them.
 */

/** One entry in the capped recent-trips list — a pointer, never a plan. */
export interface RecentEntry {
  tripId: string;
  cityName: string;
  at: string;
}

export interface UserDoc {
  _id?: ObjectId;
  authId: string;
  email: string;
  fname: string;
  lname?: string;
  /** Capped at 20, newest first. The plan lives in `trips`, not here. */
  recentSearch: RecentEntry[];
  userInterest: string[];
  userAddress: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** One generated trip. Stored in the `itenaries` collection. */
export interface TripDoc {
  _id?: ObjectId;
  /** Public id, shown in URLs and the email route. Never sequential. */
  uuid: string;
  city: string;
  /** The composed payload the result page renders. */
  itenary: ComposedResponse;
  /** Owner. The request body's email is NEVER written here. */
  userId: string | null;
  /** Delivery address for the Resend hand-off, if the visitor gave one. */
  userEmail: string;
  days: number;
  budget: number;
  currency: string;
  travellers: number;
  pace: string;
  /** Enriched shortlist, so day-regeneration costs zero Places calls. */
  placesSnapshot: EnrichedPlace[];
  /** ISO stamp of when the snapshot was fetched (bead e88). Absent on trips
   * written before the retention fix — those age by `createdAt` instead. */
  snapshotAt?: string;
  emailSentAt?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PlaceCacheDoc {
  _id?: ObjectId;
  placeId: string;
  name: string;
  payload: EnrichedPlace;
  enriched: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Monotonic counters: `{ _id: "places:2026-10", count: n }`. */
export interface UsageDoc {
  _id: string;
  count: number;
  updatedAt?: Date;
}
