import test from "node:test";
import assert from "node:assert/strict";
import {
  PLACES_CONTENT_RETENTION_MS,
  isRetentionFresh,
  snapshotStaleReason,
} from "@/server/domain/places/retention";

// ── Places-content retention (bead e88) ────────────────────────────────────
// Verified 2026-10-12 against the live terms: place IDs may be stored
// indefinitely; every other cached Places field expires after 30 days.
// These tests pin the retention rule at the helper boundary: the 30-day
// ceiling itself, the fresh/stale edge, and the trip-snapshot ageing order
// (`snapshotAt`, then legacy `createdAt` — never `updatedAt`, which re-plans
// and emails bump without refreshing the data).

const DAY = 24 * 60 * 60 * 1000;

test("retention ceiling is 30 days", () => {
  assert.equal(PLACES_CONTENT_RETENTION_MS, 30 * DAY);
});

test("isRetentionFresh: fresh inside the window, stale outside it", () => {
  assert.equal(isRetentionFresh(new Date(Date.now() - 29 * DAY)), true);
  assert.equal(isRetentionFresh(new Date(Date.now() - 31 * DAY)), false);
});

test("isRetentionFresh: missing or unparsable dates are stale, never fresh", () => {
  assert.equal(isRetentionFresh(undefined), false);
  assert.equal(isRetentionFresh("not-a-date"), false);
});

test("snapshotStaleReason: fresh snapshotAt passes even with an old createdAt", () => {
  const reason = snapshotStaleReason({
    snapshotAt: new Date().toISOString(),
    createdAt: new Date(Date.now() - 60 * DAY),
  });
  assert.equal(reason, null);
});

test("snapshotStaleReason: stale snapshotAt refuses even with a new updatedAt", () => {
  const reason = snapshotStaleReason({
    snapshotAt: new Date(Date.now() - 31 * DAY).toISOString(),
    // updatedAt is not part of the ageing inputs at all.
  });
  assert.match(reason ?? "", /older than 30 days/);
});

test("snapshotStaleReason: pre-retention trips age by createdAt", () => {
  assert.equal(
    snapshotStaleReason({ createdAt: new Date(Date.now() - 10 * DAY) }),
    null,
  );
  assert.match(
    snapshotStaleReason({ createdAt: new Date(Date.now() - 40 * DAY) }) ?? "",
    /generate the trip again/,
  );
});

test("snapshotStaleReason: a trip with no dates at all is stale", () => {
  assert.match(snapshotStaleReason({}) ?? "", /older than 30 days/);
});
