import "server-only";

import { MongoClient, type Collection, type Db, type Document } from "mongodb";
import { required } from "@/server/env";

/**
 * The one Mongo connection this app has.
 *
 * Mongoose did three jobs here and is gone: connection management, schema
 * coercion and `process.exit(1)`. The first moves to `withDb` below; the third
 * never happens — a request that cannot reach the database returns 503 and says
 * so, and the container stays up so the health route can report the failure
 * instead of the orchestrator reporting a crash-loop. Schema coercion moves to
 * `domain/plan/schema.ts`, which already decided the request contract, rather
 * than being asserted a second time by an ODM at write time.
 *
 * The client is cached on `globalThis` because Next's dev server re-evaluates
 * modules on every hot reload; without the cache, every edit would open a new
 * pool and Mongo would eventually refuse connections. This is the same
 * pattern `next-mongodb-client` and Prisma use, and it is the only reason this
 * module has state.
 */

const DATABASE_NAME = "triptribe";

/**
 * Collection names, as they exist in the production Atlas database today.
 *
 * They are Mongoose's defaults — model name pluralised and lowercased — and
 * they are spelled wrong (`itenary`), which is why they are written out in one
 * place instead of derived. Renaming a collection is a data migration and is
 * deliberately not part of this rewrite; it is filed as its own piece of work
 * so it can happen once, with a backfill, rather than smuggled into a cutover.
 *
 * CONFIRM BEFORE CUTOVER: `db.getCollectionNames()` against the production
 * database. If these four names are not what it reports, every read and write
 * below is against a collection that does not exist, and the app will appear
 * to work while saving nothing.
 */
export const COLLECTIONS = {
  users: "users",
  /** One document per generated itinerary. Named `itenaries` by Mongoose. */
  trips: "itenaries",
  /** 90-day TTL cache of enriched places, feeding the SEO city pages. */
  placeCache: "placecaches",
  /** Call counters for the Places allowance and the rate limits. */
  usage: "usage",
  planCache: "planCache",
} as const;

interface MongoGlobal {
  __triptribeClient?: MongoClient;
}

const globalScope = globalThis as unknown as MongoGlobal;

/**
 * The database, connecting on first use.
 *
 * Lazy on purpose: importing this module must not open a socket, or every
 * build, every prerendered page and every `next build` route analysis would
 * need a reachable database. The first repository call pays the connect.
 */
export async function getDb(): Promise<Db> {
  const existing = globalScope.__triptribeClient;
  if (!existing) {
    const client = new MongoClient(required("MONGO_URI"), {
      // Atlas' server-side selection timeout defaults to 30s. A request that
      // cannot reach the database should answer 503 inside the function's
      // own budget, not hang for the full platform timeout.
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
    });
    // A background reconnect after a network blip is normal and should not
    // take the process down; the next `withDb` will fail fast instead.
    client.on("error", (error) => {
      console.error("[db] mongodb client error:", error.message);
    });
    globalScope.__triptribeClient = client;
  }
  const active = globalScope.__triptribeClient as MongoClient;
  return (await active.connect()).db(DATABASE_NAME);
}

/**
 * Run `fn` with the database, closing the connection for tests.
 *
 * Nothing in this file logs "DB connection established" the way
 * `backend/config/db.js` did. The health route pings the database per request,
 * which is a more useful answer than a line printed once at boot that nobody
 * ever sees.
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = await getDb();
  return fn(db);
}

export async function collection<T extends Document>(
  name: string,
): Promise<Collection<T>> {
  return (await getDb()).collection<T>(name);
}

/**
 * Close the client. Only tests and scripts use this — a serverless or
 * container process should hold its pool open for its whole lifetime.
 */
export async function closeDb(): Promise<void> {
  const client = globalScope.__triptribeClient;
  if (!client) return;
  delete globalScope.__triptribeClient;
  await client.close();
}

/** Whether the database answers. Used by /api/health; never throws. */
export async function ping(): Promise<boolean> {
  try {
    await withDb((db) => db.command({ ping: 1 }));
    return true;
  } catch {
    return false;
  }
}
