import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePlanRequest,
  normaliseStartDate,
  PACES,
  TRAVEL_MODES,
  REQUEST_LIMITS,
  type ParsedPlanRequest,
  type StartDateFailure,
} from "@/server/domain/plan/schema";

// A fixed "today" so date assertions never rot as the calendar moves.
const NOW = new Date("2026-10-11T00:00:00Z");
const at = { now: NOW };

const valid = (over = {}) => ({
  cityName: "Jaipur",
  days: 4,
  budget: 48000,
  ...over,
});

// Both entry points answer with a discriminated union, and every assertion
// below wants one arm or the other. The narrowing lives here, once: the
// `assert.ok` / `assert.equal` inside each helper is the "accepted" / "refused"
// check that the backend tests read straight off the raw result.
const accepted = (body: unknown): ParsedPlanRequest => {
  const result = parsePlanRequest(body, at);
  assert.ok(result.ok, `expected acceptance, got ${JSON.stringify(result)}`);
  return result.value;
};

const acceptedDate = (value: unknown): string => {
  const result = normaliseStartDate(value, at);
  assert.ok(
    result.ok,
    `expected ${JSON.stringify(value)} to resolve to a start date`,
  );
  return result.value;
};

const rejectedDate = (value: unknown): StartDateFailure => {
  const result = normaliseStartDate(value, at);
  assert.equal(
    result.ok,
    false,
    `expected ${JSON.stringify(value)} to be refused`,
  );
  return result.ok ? "empty" : result.reason;
};

// ── Request contract ──────────────────────────────────────────────────────

test("accepts a well-formed request and normalises it", () => {
  const value = accepted({
    cityName: "  Jaipur  ",
    days: "4",
    budget: "48000",
    email: " a@b.co ",
  });
  assert.equal(value.cityName, "Jaipur");
  assert.equal(value.days, 4);
  assert.equal(value.budget, 48000);
  assert.equal(value.email, "a@b.co");
});

test("absent planning inputs take documented defaults", () => {
  const value = accepted(valid());
  assert.equal(
    value.travellers,
    2,
    "product audience is a couple or group, not a solo traveller",
  );
  assert.equal(value.pace, "BALANCED");
  assert.equal(value.travelMode, "TRANSIT");
  assert.equal(value.startDate, null);
  assert.deepEqual(value.interests, []);
  assert.equal(value.originCity, "");
  assert.equal(value.isLocalTrip, false);
  assert.deepEqual(value.paceSettings, PACES.BALANCED);
});

test("a local trip is recognised rather than rejected", () => {
  assert.equal(accepted(valid({ originCity: "jaipur" })).isLocalTrip, true);
  assert.equal(accepted(valid({ originCity: "Delhi" })).isLocalTrip, false);
});

test("an unknown pace or travel mode falls back instead of failing the request", () => {
  const value = accepted(valid({ pace: "turbo", travelMode: "teleport" }));
  assert.equal(value.pace, "BALANCED");
  assert.equal(value.travelMode, "TRANSIT");
  assert.ok(
    Object.keys(TRAVEL_MODES).includes(value.travelMode),
    `the fallback "${value.travelMode}" must still be a mode the solver knows`,
  );
});

test("pace is case-insensitive", () => {
  assert.equal(accepted(valid({ pace: "packed" })).pace, "PACKED");
  assert.deepEqual(
    accepted(valid({ pace: "packed" })).paceSettings,
    PACES.PACKED,
  );
});

test("pace sets a genuinely different stop budget", () => {
  assert.ok(PACES.RELAXED.stopsPerDay < PACES.BALANCED.stopsPerDay);
  assert.ok(PACES.BALANCED.stopsPerDay < PACES.PACKED.stopsPerDay);
});

// ── Travellers ────────────────────────────────────────────────────────────

for (const [label, travellers] of [
  ["zero", 0],
  ["negative", -3],
  ["fractional", 2.5],
  ["non-numeric", "four"],
  ["above maximum", REQUEST_LIMITS.MAX_TRAVELLERS + 1],
]) {
  test(`rejects ${label} travellers`, () => {
    const result = parsePlanRequest(valid({ travellers }), at);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.path === "travellers"));
  });
}

test("accepts the traveller boundaries exactly", () => {
  assert.equal(
    accepted(valid({ travellers: REQUEST_LIMITS.MIN_TRAVELLERS })).travellers,
    1,
  );
  assert.equal(
    accepted(valid({ travellers: REQUEST_LIMITS.MAX_TRAVELLERS })).travellers,
    40,
  );
});

// ── Interests ─────────────────────────────────────────────────────────────

test("interests are trimmed, case-insensitively deduplicated and order-preserved", () => {
  const value = accepted(
    valid({ interests: [" History ", "history", "HISTORY", "Food"] }),
  );
  assert.deepEqual(value.interests, ["History", "Food"]);
});

test("a single interest string is accepted, not just an array", () => {
  assert.deepEqual(accepted(valid({ interests: "History" })).interests, [
    "History",
  ]);
});

test("non-string interests are dropped rather than crashing", () => {
  const value = accepted(valid({ interests: ["History", null, 42, {}, ""] }));
  assert.deepEqual(value.interests, ["History"]);
});

test("rejects too many interests", () => {
  const many = Array.from(
    { length: REQUEST_LIMITS.MAX_INTERESTS + 1 },
    (_, i) => `I${i}`,
  );
  assert.equal(parsePlanRequest(valid({ interests: many }), at).ok, false);
});

test("rejects an overlong interest", () => {
  const long = "x".repeat(REQUEST_LIMITS.MAX_INTEREST_LENGTH + 1);
  assert.equal(parsePlanRequest(valid({ interests: [long] }), at).ok, false);
});

test("blank email is allowed — generation works signed-out", () => {
  const value = accepted({
    cityName: "Kyoto",
    days: 3,
    budget: 60000,
    email: "",
  });
  assert.equal(value.email, "");
});

// ── Start date ────────────────────────────────────────────────────────────

test("accepts ISO dates", () => {
  assert.equal(acceptedDate("2026-12-01"), "2026-12-01");
});

test("accepts day-first slashed dates", () => {
  assert.equal(acceptedDate("25/12/2026"), "2026-12-25");
});

test("accepts a US-style date where the month cannot be a day", () => {
  // 25 cannot be a month, so 12/25/2026 can only mean 12 December.
  assert.equal(acceptedDate("12/25/2026"), "2026-12-25");
});

test("resolves a slashed date only when one reading is legal", () => {
  // 03 and 14 cannot be months, so these can only be day-first.
  assert.equal(acceptedDate("14/04/2026"), "2026-04-14");
  assert.equal(
    rejectedDate("03/04/2026"),
    "ambiguous",
    "03 and 04 are both valid months and days",
  );
});

test("refuses an ambiguous date rather than guessing a month", () => {
  // Both readings are legal. Guessing wrong shifts every weekday, season and
  // opening-hour decision downstream, so this is an error, not a coin toss.
  for (const date of ["03/04/2026", "04/05/2026", "07/08/2026"]) {
    const reason = rejectedDate(date);
    assert.equal(reason, "ambiguous");
    assert.equal(parsePlanRequest(valid({ startDate: date }), at).ok, false);
  }
});

test("rejects dates that do not exist", () => {
  assert.equal(rejectedDate("2026-04-31"), "not_a_real_date");
  assert.equal(rejectedDate("2026-13-01"), "not_a_real_date");
  assert.equal(rejectedDate("31/04/2026"), "not_a_real_date");
  assert.equal(rejectedDate("2026-00-10"), "not_a_real_date");
});

// 2028 and 2032 are leap years; 2026, 2027 and 2100 are not.
test("handles leap days correctly", () => {
  assert.equal(
    normaliseStartDate("2028-02-29", at).ok,
    true,
    "2028 is a leap year",
  );
  assert.equal(rejectedDate("2026-02-29"), "not_a_real_date");
  assert.equal(rejectedDate("2027-02-29"), "not_a_real_date");
  assert.equal(
    rejectedDate("2100-02-29"),
    "not_a_real_date",
    "century years are not leap years unless divisible by 400",
  );
});

test("rejects a date in the past", () => {
  assert.equal(rejectedDate("2020-01-01"), "too_far_past");
});

test("rejects a date too far ahead to plan", () => {
  assert.equal(rejectedDate("2040-01-01"), "too_far_future");
});

test("rejects an unparseable date", () => {
  assert.equal(rejectedDate("next tuesday"), "unparseable");
  // 2026/13/45 matches no accepted pattern: the slash form is day-first and
  // neither 13 nor 45 is a legal day.
  assert.equal(rejectedDate("2026/13/45"), "unparseable");
  assert.equal(
    parsePlanRequest(valid({ startDate: "next tuesday" }), at).ok,
    false,
  );
});

test("a blank date is absent, not an error", () => {
  assert.equal(accepted(valid({ startDate: "" })).startDate, null);
  assert.equal(accepted(valid({ startDate: null })).startDate, null);
  assert.equal(accepted(valid()).startDate, null);
});

test("a present but invalid date is an error, not silently dropped", () => {
  // Dropping it would quietly discard every season and weekday decision.
  const result = parsePlanRequest(valid({ startDate: "31/02/2027" }), at);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "startDate"));
});

test("a valid start date yields the offset the solver needs", () => {
  const value = accepted(valid({ startDate: "2026-10-11" }));
  assert.equal(value.startDateOffset, 0);
});

test("rejects a present but malformed email", () => {
  const result = parsePlanRequest({
    cityName: "Kyoto",
    days: 3,
    budget: 60000,
    email: "not-an-email",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "email"));
});

// Bounds are the product rule, not an implementation detail: these are the
// exact values the frontend form and the seed pipeline both rely on.
const bounds: [string, Record<string, unknown>][] = [
  ["days below minimum", { days: 0 }],
  ["days above maximum", { days: REQUEST_LIMITS.MAX_DAYS + 1 }],
  ["fractional days", { days: 2.5 }],
  ["non-numeric days", { days: "four" }],
  ["NaN days", { days: "abc" }],
];

for (const [label, patch] of bounds) {
  test(`rejects ${label}`, () => {
    const result = parsePlanRequest({
      cityName: "Rome",
      days: 3,
      budget: 50000,
      ...patch,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.path === "days"),
      `expected a days error for ${label}`,
    );
  });
}

test("accepts the boundary values exactly", () => {
  for (const days of [REQUEST_LIMITS.MIN_DAYS, REQUEST_LIMITS.MAX_DAYS]) {
    assert.equal(
      parsePlanRequest({ cityName: "Rome", days, budget: 50000 }).ok,
      true,
    );
  }
  assert.equal(
    parsePlanRequest({
      cityName: "Rome",
      days: 3,
      budget: REQUEST_LIMITS.MIN_BUDGET,
    }).ok,
    true,
  );
});

test("rejects an under-minimum budget", () => {
  const result = parsePlanRequest({ cityName: "Rome", days: 3, budget: 999 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.path === "budget"));
});

test("rejects a negative budget", () => {
  assert.equal(
    parsePlanRequest({ cityName: "Rome", days: 3, budget: -5000 }).ok,
    false,
  );
});

test("rejects a missing or overlong city", () => {
  assert.equal(parsePlanRequest({ days: 3, budget: 50000 }).ok, false);
  assert.equal(
    parsePlanRequest({
      cityName: "x".repeat(REQUEST_LIMITS.MAX_CITY_LENGTH + 1),
      days: 3,
      budget: 50000,
    }).ok,
    false,
  );
});

test("reports every bad field at once, not just the first", () => {
  const result = parsePlanRequest({ cityName: "", days: 999, budget: 1 });
  assert.equal(result.ok, false);
  const paths = result.errors.map((e) => e.path);
  assert.ok(paths.includes("cityName"));
  assert.ok(paths.includes("days"));
  assert.ok(paths.includes("budget"));
});

test("a non-object body is rejected rather than throwing", () => {
  assert.equal(parsePlanRequest(null).ok, false);
  assert.equal(parsePlanRequest(undefined).ok, false);
  assert.equal(parsePlanRequest("nope").ok, false);
});
