import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { required, supabasePublishable, supabaseUrl } from "@/server/env";

/**
 * The one database this app has — now the fleet Supabase project.
 *
 * This module used to wrap the MongoDB native driver. The repository and
 * service layer speak a small Mongo-shaped vocabulary (`withDb`,
 * `db.collection(name).findOne(...)`, `$set`, `$setOnInsert`, `$inc`, `$push`…),
 * so instead of rewriting every caller in the same change, this module keeps
 * that vocabulary and implements it on top of `@supabase/supabase-js` over the
 * public HTTP gateway. Raw Postgres is intentionally not used: Coolify
 * containers cannot reach it, but the gateway answers on 443.
 *
 * Each collection is one Postgres table with the same shape:
 *   id text primary key, data jsonb not null, created_at, updated_at
 * The document (including its `_id`) lives in `data`; filters on `_id` address
 * the `id` column, every other filter addresses `data->>field`. Reads are
 * fetched through PostgREST and, where needed, refined in JS; writes are
 * read-modify-write so the update operators keep their Mongo semantics. This
 * is deliberate: these tables are small (users, trips, caches, counters) and
 * correctness of the ported call sites matters more than squeezing the query
 * shape into PostgREST.
 *
 * The client is cached on `globalThis` because Next's dev server re-evaluates
 * modules on hot reload; without the cache every edit would build a new client.
 * supabase-js holds no socket to close, so `closeDb()` just clears the cache.
 */

/** Collection names — unchanged from the Mongo days so callers do not move. */
export const COLLECTIONS = {
  users: "users",
  /** One document per generated itinerary (was `itenaries`). */
  trips: "itenaries",
  /** 30-day retention cache of enriched places, feeding the SEO city pages. */
  placeCache: "placecaches",
  /** Call counters for the Places allowance and the rate limits. */
  usage: "usage",
  planCache: "planCache",
} as const;

/** Collection name -> Postgres table in `supabase/migrations/0001_fleet_schema.sql`. */
const TABLE_FOR: Record<string, string> = {
  [COLLECTIONS.users]: "users",
  [COLLECTIONS.trips]: "trips",
  [COLLECTIONS.placeCache]: "place_cache",
  [COLLECTIONS.usage]: "usage",
  [COLLECTIONS.planCache]: "plan_cache",
};

const tableFor = (name: string): string => TABLE_FOR[name] ?? name;

interface SupabaseGlobal {
  __triptribeSupabase?: SupabaseClient;
}

const globalScope = globalThis as unknown as SupabaseGlobal;

/**
 * Service-role client for database reads and writes. Created lazily (importing
 * this module must not need a reachable database — builds and route analysis
 * import it) and never persisted into the browser bundle.
 */
export function serverSupabase(): SupabaseClient {
  if (!globalScope.__triptribeSupabase) {
    globalScope.__triptribeSupabase = createClient(
      supabaseUrl(),
      required("SUPABASE_SECRET"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return globalScope.__triptribeSupabase;
}

/** Auth-only client (anon key) used to verify caller tokens. */
export function authSupabase(): SupabaseClient {
  return createClient(supabaseUrl(), supabasePublishable(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A generic JSON document. Dated fields are ISO strings once round-tripped. */
type Row = Record<string, unknown>;

/**
 * The slice of supabase-js' query builder we use. The generated DB types are
 * not present in this repo, so the library's fully-generic builder produces
 * pathologically deep types when re-assigned; a narrow local interface keeps
 * the translation code honest and readable.
 */
interface SimpleQuery {
  eq(column: string, value: unknown): SimpleQuery;
  in(column: string, value: unknown[]): SimpleQuery;
  is(column: string, value: unknown): SimpleQuery;
  then: Promise<{ data: unknown; error: { message: string } | null }>["then"];
}

/** Mongo-shaped filter used by the existing repositories. */
export type Filter = Record<string, unknown>;
/** Mongo-shaped update document ($set, $setOnInsert, $inc, $push, $pull, $unset). */
export type Update = Record<string, unknown>;

export interface WriteOptions {
  upsert?: boolean;
  returnDocument?: "before" | "after";
}

export interface UpdateResult {
  matchedCount: number;
  modifiedCount: number;
  upsertedCount: number;
}

export interface BulkWriteOp {
  updateOne?: { filter: Filter; update: Update; upsert?: boolean };
}

export interface Cursor<T> {
  sort(spec: Record<string, 1 | -1>): Cursor<T>;
  limit(n: number): Cursor<T>;
  toArray(): Promise<T[]>;
}

export interface Collection<T extends object> {
  findOne(filter?: Filter): Promise<T | null>;
  find(filter?: Filter): Cursor<T>;
  insertOne(doc: T): Promise<{ insertedId: string }>;
  updateOne(
    filter: Filter,
    update: Update,
    options?: WriteOptions,
  ): Promise<UpdateResult>;
  updateMany(filter: Filter, update: Update): Promise<UpdateResult>;
  deleteOne(filter: Filter): Promise<{ deletedCount: number }>;
  deleteMany(filter: Filter): Promise<{ deletedCount: number }>;
  findOneAndUpdate(
    filter: Filter,
    update: Update,
    options?: WriteOptions,
  ): Promise<T | null>;
  bulkWrite(
    ops: readonly BulkWriteOp[],
    options?: { ordered?: boolean },
  ): Promise<UpdateResult>;
}

export interface Db {
  collection<T extends object>(name: string): Collection<T>;
}

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Match a document against a filter, including `{ field: { $in: [...] } }`. */
function matchesFilter(doc: Row, filter: Filter): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    const field = key === "_id" ? doc._id : doc[key];
    if (isRow(condition) && Array.isArray(condition.$in)) {
      return (condition.$in as unknown[]).some((value) => value === field);
    }
    return field === condition;
  });
}

/** Match a `$pull` element condition against an array item. */
function matchesElement(item: unknown, condition: unknown): boolean {
  if (!isRow(condition)) return item === condition;
  if (!isRow(item)) return false;
  return Object.entries(condition).every(([key, value]) => item[key] === value);
}

/** Apply Mongo update operators to a copy of `doc`. */
function applyUpdate(doc: Row, update: Update, inserting: boolean): Row {
  const next: Row = { ...doc };

  if (inserting && isRow(update.$setOnInsert)) {
    Object.assign(next, update.$setOnInsert);
  }
  if (isRow(update.$set)) Object.assign(next, update.$set);

  if (isRow(update.$inc)) {
    for (const [key, amount] of Object.entries(update.$inc)) {
      next[key] = (Number(next[key]) || 0) + Number(amount);
    }
  }

  if (isRow(update.$push)) {
    for (const [key, value] of Object.entries(update.$push)) {
      const current = Array.isArray(next[key]) ? [...(next[key] as unknown[])] : [];
      if (isRow(value) && Array.isArray(value.$each)) {
        const at =
          typeof value.$position === "number"
            ? Math.max(0, Math.min(value.$position, current.length))
            : current.length;
        current.splice(at, 0, ...(value.$each as unknown[]));
        const slice = value.$slice;
        if (typeof slice === "number") {
          next[key] = slice >= 0 ? current.slice(0, slice) : current.slice(slice);
        } else {
          next[key] = current;
        }
      } else {
        current.push(value);
        next[key] = current;
      }
    }
  }

  if (isRow(update.$pull)) {
    for (const [key, condition] of Object.entries(update.$pull)) {
      const current = Array.isArray(next[key]) ? (next[key] as unknown[]) : [];
      next[key] = current.filter((item) => !matchesElement(item, condition));
    }
  }

  if (isRow(update.$unset)) {
    for (const key of Object.keys(update.$unset)) delete next[key];
  }

  return next;
}

/** Seed a new document from the equality fields of an upsert filter. */
function seedFromFilter(filter: Filter): Row {
  const seed: Row = {};
  for (const [key, value] of Object.entries(filter)) {
    if (isRow(value) && Array.isArray(value.$in)) continue;
    seed[key === "_id" ? "_id" : key] = value;
  }
  return seed;
}

/** Translate a filter into PostgREST column constraints (id / data->>field). */
function addFilter(query: SimpleQuery, filter: Filter): SimpleQuery {
  let next = query;
  for (const [key, condition] of Object.entries(filter)) {
    const column = key === "_id" ? "id" : `data->>${key}`;
    if (isRow(condition) && Array.isArray(condition.$in)) {
      next = next.in(column, (condition.$in as unknown[]).map(String));
    } else if (condition === null) {
      next = next.is(column, null);
    } else {
      next = next.eq(column, String(condition));
    }
  }
  return next;
}

/** Read all rows matching a filter, refined in JS for exact semantics. */
async function fetchRows(table: string, filter: Filter): Promise<Row[]> {
  let query = globalScope.__triptribeSupabase!
    .from(table)
    .select("id, data") as unknown as SimpleQuery;
  query = addFilter(query, filter);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows: unknown[] = Array.isArray(data) ? data : [];
  return rows
    .map((row) => (isRow(row) && isRow(row.data) ? row.data : null))
    .filter((doc): doc is Row => doc !== null)
    .filter((doc) => matchesFilter(doc, filter));
}

async function insertRow(table: string, doc: Row): Promise<void> {
  const id = typeof doc._id === "string" ? doc._id : randomUUID();
  const stored: Row = { ...doc, _id: id };
  const now = new Date().toISOString();
  const { error } = await globalScope.__triptribeSupabase!
    .from(table)
    .insert({ id, data: stored, created_at: now, updated_at: now });
  if (error) throw error;
}

async function upsertRow(table: string, doc: Row): Promise<void> {
  const id = typeof doc._id === "string" ? doc._id : randomUUID();
  const stored: Row = { ...doc, _id: id };
  const { error } = await globalScope.__triptribeSupabase!
    .from(table)
    .upsert(
      { id, data: stored, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) throw error;
}

async function deleteRows(table: string, filter: Filter): Promise<number> {
  const rows = await fetchRows(table, filter);
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => String(row._id));
  const { error } = await globalScope.__triptribeSupabase!
    .from(table)
    .delete()
    .in("id", ids);
  if (error) throw error;
  return ids.length;
}

class CursorImpl<T extends object> implements Cursor<T> {
  private sortSpec: Record<string, 1 | -1> = {};
  private max: number | null = null;
  private readonly rows: T[];

  constructor(rows: T[]) {
    this.rows = rows;
  }

  sort(spec: Record<string, 1 | -1>): Cursor<T> {
    this.sortSpec = { ...spec };
    return this;
  }

  limit(n: number): Cursor<T> {
    this.max = n;
    return this;
  }

  async toArray(): Promise<T[]> {
    const rows = [...this.rows];
    const keys = Object.keys(this.sortSpec);
    if (keys.length > 0) {
      rows.sort((a, b) => {
        for (const key of keys) {
          const av = (a as Row)[key];
          const bv = (b as Row)[key];
          if (av === bv) continue;
          if (av === undefined || av === null) return 1;
          if (bv === undefined || bv === null) return -1;
          const direction = this.sortSpec[key] ?? 1;
          return (String(av) < String(bv) ? -1 : 1) * direction;
        }
        return 0;
      });
    }
    return this.max === null ? rows : rows.slice(0, this.max);
  }
}

/** A cursor whose rows load on first `toArray()`, like Mongo's lazy cursor. */
class LazyCursor<T extends object> implements Cursor<T> {
  private sortSpec: Record<string, 1 | -1> = {};
  private max: number | null = null;
  private readonly pending: Promise<Row[]>;

  constructor(pending: Promise<Row[]>) {
    this.pending = pending;
  }

  sort(spec: Record<string, 1 | -1>): Cursor<T> {
    this.sortSpec = { ...spec };
    return this;
  }

  limit(n: number): Cursor<T> {
    this.max = n;
    return this;
  }

  async toArray(): Promise<T[]> {
    const rows = (await this.pending) as unknown as T[];
    const cursor = new CursorImpl<T>(rows);
    cursor.sort(this.sortSpec);
    if (this.max !== null) cursor.limit(this.max);
    return cursor.toArray();
  }
}

function makeCollection<T extends object>(name: string): Collection<T> {
  const table = tableFor(name);
  const client = () => {
    // Keep `serverSupabase` as the single place that reads env / caches.
    serverSupabase();
    return globalScope.__triptribeSupabase!;
  };

  return {
    async findOne(filter = {}) {
      void client();
      const rows = await fetchRows(table, filter);
      return (rows[0] as unknown as T) ?? null;
    },

    find(filter = {}) {
      void client();
      return new LazyCursor<T>(fetchRows(table, filter));
    },

    async insertOne(doc) {
      client();
      const id = typeof (doc as Row)._id === "string" ? String((doc as Row)._id) : randomUUID();
      await insertRow(table, doc as Row);
      return { insertedId: id };
    },

    async updateOne(filter, update, options) {
      client();
      const rows = await fetchRows(table, filter);
      if (rows.length === 0) {
        if (options?.upsert) {
          await upsertRow(table, applyUpdate(seedFromFilter(filter), update, true));
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      }
      await upsertRow(table, applyUpdate(rows[0]!, update, false));
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    },

    async updateMany(filter, update) {
      client();
      const rows = await fetchRows(table, filter);
      for (const row of rows) await upsertRow(table, applyUpdate(row, update, false));
      return { matchedCount: rows.length, modifiedCount: rows.length, upsertedCount: 0 };
    },

    async deleteOne(filter) {
      client();
      const rows = await fetchRows(table, filter);
      if (rows.length === 0) return { deletedCount: 0 };
      const { error } = await globalScope.__triptribeSupabase!
        .from(table)
        .delete()
        .eq("id", String(rows[0]!._id));
      if (error) throw error;
      return { deletedCount: 1 };
    },

    async deleteMany(filter) {
      client();
      return { deletedCount: await deleteRows(table, filter) };
    },

    async findOneAndUpdate(filter, update, options) {
      client();
      const rows = await fetchRows(table, filter);
      const existing = rows[0];
      if (!existing) {
        if (!options?.upsert) return null;
        const created = applyUpdate(seedFromFilter(filter), update, true);
        await upsertRow(table, created);
        return (options?.returnDocument === "before"
          ? seedFromFilter(filter)
          : created) as unknown as T;
      }
      const before = existing;
      const after = applyUpdate(existing, update, false);
      await upsertRow(table, after);
      return (options?.returnDocument === "before" ? before : after) as unknown as T;
    },

    async bulkWrite(ops, _options) {
      client();
      let modified = 0;
      for (const op of ops) {
        if (!op.updateOne) continue;
        const { filter, update, upsert } = op.updateOne;
        const rows = await fetchRows(table, filter);
        if (rows.length === 0) {
          if (upsert) await upsertRow(table, applyUpdate(seedFromFilter(filter), update, true));
          continue;
        }
        for (const row of rows) await upsertRow(table, applyUpdate(row, update, false));
        modified += rows.length;
      }
      return { matchedCount: modified, modifiedCount: modified, upsertedCount: 0 };
    },
  };
}

/** The database handle passed to `withDb`. */
const db: Db = {
  collection<T extends object>(name: string): Collection<T> {
    return makeCollection<T>(name);
  },
};

/**
 * The database, ready on first use (no socket to open — just env + client).
 */
export async function getDb(): Promise<Db> {
  serverSupabase();
  return db;
}

/**
 * Run `fn` with the database. Nothing here logs "connection established":
 * the health route pings the database per request, which is a more useful
 * answer than a line printed once at boot.
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  await getDb();
  return fn(db);
}

export async function collection<T extends object>(
  name: string,
): Promise<Collection<T>> {
  await getDb();
  return makeCollection<T>(name);
}

/**
 * Clear the cached client. Only tests use this — a container holds its client
 * for its whole lifetime; supabase-js itself has no connection to close.
 */
export async function closeDb(): Promise<void> {
  delete globalScope.__triptribeSupabase;
}

/** Whether the Supabase gateway answers. Used by /health; never throws. */
export async function ping(): Promise<boolean> {
  try {
    const { error } = await serverSupabase()
      .from(tableFor(COLLECTIONS.users))
      .select("id")
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}
