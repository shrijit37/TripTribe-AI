import test from "node:test";
import assert from "node:assert/strict";
import { searchNearby, PlacesRequestError } from "@/server/domain/places/client";
import { isQuotaError } from "@/server/domain/places/fallback";

// ── Upstream 429 → honest QUOTA_EXHAUSTED (bead 9ve) ───────────────────────
// A Google 429 means the per-project daily cap is dry. Before this, the client
// threw a bare PlacesRequestError that surfaced as an opaque 500. Now it
// carries QUOTA_EXHAUSTED so the route answers 503 with copy the user can act
// on, and the pipeline can fall back to a prewarm snapshot. These tests hold
// that translation at the client boundary, and pin the non-429 contrast so a
// genuine upstream failure does not masquerade as "allowance spent".

// Derived from `fetch` itself so the stub signature cannot drift from the global
// it replaces, and so the name resolves under eslint (no `RequestInit`).
type FetchInit = Parameters<typeof globalThis.fetch>[1];
const stubFetch = (
  handler: (url: string, init?: FetchInit) => Promise<unknown>,
): typeof globalThis.fetch => handler as unknown as typeof globalThis.fetch;

/** Run `fn` against a Places API that answers `status`, then restore globals. */
const withPlacesStatus = async (
  status: number,
  fn: () => Promise<unknown>,
): Promise<unknown> => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-stub-key";
  globalThis.fetch = stubFetch(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => `upstream ${status}`,
  }));
  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
};

const nearby = () =>
  searchNearby({ latitude: 30.2672, longitude: -97.7431, radius: 9000 });

test("an upstream 429 becomes a QUOTA_EXHAUSTED PlanError", async () => {
  const error = await withPlacesStatus(429, () =>
    nearby().then(
      () => null,
      (thrown: unknown) => thrown,
    ),
  );
  assert.ok(error instanceof Error, `expected an Error, got ${String(error)}`);
  assert.equal((error as { code?: string }).code, "QUOTA_EXHAUSTED");
  // isQuotaError is the exact predicate the pipeline and catalogue use to
  // decide "fall back to the snapshot" vs "fail honestly".
  assert.equal(isQuotaError(error), true);
});

test("a non-429 upstream failure stays a PlacesRequestError, not a quota signal", async () => {
  const error = await withPlacesStatus(500, () =>
    nearby().then(
      () => null,
      (thrown: unknown) => thrown,
    ),
  );
  assert.ok(error instanceof PlacesRequestError, "500 must not read as quota");
  assert.equal((error as PlacesRequestError).status, 500);
  assert.equal((error as { code?: string }).code, undefined);
  assert.equal(isQuotaError(error), false);
});

test("isQuotaError duck-types only our quota code", () => {
  assert.equal(isQuotaError({ code: "QUOTA_EXHAUSTED" }), true);
  assert.equal(isQuotaError({ code: "EMPTY_POOL" }), false);
  assert.equal(isQuotaError(new Error("boom")), false);
  assert.equal(isQuotaError(null), false);
  assert.equal(isQuotaError(undefined), false);
});
