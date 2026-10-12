import "server-only";
import { createHash } from "node:crypto";
import { COLLECTIONS, withDb } from "@/server/db/mongo";
import {
  solveItinerary,
  PipelineError,
  type SolveResult,
} from "@/server/domain/solver/pipeline";
import { narrate } from "@/server/domain/narrate";
import {
  composeResponse,
  type ComposedResponse,
} from "@/server/domain/compose";
import type { ParsedPlanRequest } from "@/server/domain/plan/schema";
import type { EnrichedPlace } from "@/server/domain/places/client";
import {
  projectPlanCost,
  quotaShortfall,
  recordPlacesSpent,
} from "@/server/domain/places/quota";
import { createTrip, type TripDoc } from "@/server/db/repositories/trips";
import { pushRecent } from "@/server/db/repositories/users";

/**
 * Generate a plan end to end: quota → cache → solver → narrator → composer → save.
 * The old `POST /api/itenary` did solve → compose → save-under-body-email.
 * This does the same shape with the three migration fixes: the quota is
 * checked before a rupee of it is spent, a repeat request is served from the
 * 24 h plan cache for zero Places calls, and the trip is saved under the
 * session's `userId` — never under the request body's email.
 */

const PLAN_CACHE_MS = 24 * 60 * 60 * 1000;

interface CachedPlan {
  _id: string;
  response: ComposedResponse;
  snapshot: EnrichedPlace[];
  at: string;
}

const requestHash = (value: ParsedPlanRequest): string =>
  createHash("sha1")
    .update(
      JSON.stringify({
        city: value.cityName.toLowerCase(),
        country: "",
        days: value.days,
        budget: value.budget,
        currency: value.currency,
        travellers: value.travellers,
        pace: value.pace,
        travelMode: value.travelMode,
        interests: [...value.interests].sort(),
        startDate: value.startDate,
        origin: value.originCity.toLowerCase(),
      }),
    )
    .digest("hex");

const readPlanCache = async (hash: string): Promise<CachedPlan | null> => {
  try {
    const row = await withDb(async (db) =>
      db.collection<CachedPlan>(COLLECTIONS.planCache).findOne({ _id: hash }),
    );
    if (!row) return null;
    if (Date.now() - new Date(row.at).getTime() > PLAN_CACHE_MS) return null;
    return row;
  } catch {
    return null;
  }
};

const writePlanCache = async (
  hash: string,
  response: ComposedResponse,
  snapshot: EnrichedPlace[],
): Promise<void> => {
  try {
    await withDb(async (db) =>
      db.collection<CachedPlan>(COLLECTIONS.planCache).updateOne(
        { _id: hash },
        {
          $set: { response, snapshot, at: new Date().toISOString() },
          $setOnInsert: { _id: hash },
        },
        { upsert: true },
      ),
    );
  } catch {
    // A lost cache entry costs quota on the next repeat, not correctness.
  }
};

export interface GenerateResult {
  response: ComposedResponse;
  trip: TripDoc;
  cached: boolean;
}

export const generatePlan = async (
  input: ParsedPlanRequest,
  viewer: { authId: string } | null,
): Promise<GenerateResult> => {
  // 1. Quota first: refuse before spending, with honest copy.
  const projected = projectPlanCost({
    days: input.days,
    stopsPerDay: input.paceSettings.stopsPerDay,
  });
  const quota = await quotaShortfall(projected);
  if (!quota.fits) {
    throw new PipelineError(
      "QUOTA_EXHAUSTED",
      `Today's map allowance is spent (discovery ${quota.discovery.used}/${quota.discovery.used + quota.discovery.remaining}, enrichment ${quota.enrichment.used}/${quota.enrichment.used + quota.enrichment.remaining}) — planning reopens tomorrow`,
    );
  }
  // 2. Repeat requests are free.

  const hash = requestHash(input);
  const cached = await readPlanCache(hash);
  if (cached) {
    const trip = await createTrip({
      city: input.cityName,
      itenary: cached.response,
      userId: viewer?.authId ?? null,
      userEmail: input.email,
      days: input.days,
      budget: input.budget,
      currency: input.currency,
      travellers: input.travellers,
      pace: input.pace,
      placesSnapshot: cached.snapshot,
    });
    if (viewer) {
      await pushRecent(viewer.authId, {
        tripId: trip.uuid,
        cityName: input.cityName,
        at: new Date().toISOString(),
      });
    }
    return { response: cached.response, trip, cached: true };
  }

  // 3. Solve with the *whole* parsed request — headcount, pace, mode, date
  //    and currency all reach the solver (migration bug #4).
  const solved: SolveResult = await solveItinerary({
    city: input.cityName,
    country: "",
    days: input.days,
    budget: input.budget,
    currency: input.currency,
    headcount: input.travellers,
    stopsPerDay: input.paceSettings.stopsPerDay,
    travelMode: input.travelMode,
    startDate: input.startDate,
  });
  await recordPlacesSpent(projected);

  // 4. Narrate (never throws) and compose the wire payload.
  const narrated = await narrate(solved);
  const response = composeResponse(solved, narrated);

  // 5. Cache the answer, then persist under the session owner.
  await writePlanCache(hash, response, solved.placesSnapshot);
  const trip = await createTrip({
    city: input.cityName,
    itenary: response,
    userId: viewer?.authId ?? null,
    userEmail: input.email,
    days: input.days,
    budget: input.budget,
    currency: input.currency,
    travellers: input.travellers,
    pace: input.pace,
    placesSnapshot: solved.placesSnapshot,
  });
  if (viewer) {
    await pushRecent(viewer.authId, {
      tripId: trip.uuid,
      cityName: input.cityName,
      at: new Date().toISOString(),
    });
  }

  return { response, trip, cached: false };
};
