import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  parseCsv,
  csvIndex,
  csvRowToEnriched,
  priceBand,
  parseOpenHours,
  tzToUtcOffset,
} from "@/server/domain/places/scraper";

// ── The scrape adapter's CSV mappers ────────────────────────────────────────
// The fallback only works if a scraped row is indistinguishable from a Places
// row: same EnrichedPlace keys, same periods shape the scheduler parses, same
// bayesian shrinkage the ranking uses. These tests hold the mapper to that.

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(
  resolve(here, "../../../test/fixtures/gosom-run1.csv"),
  "utf8",
);

test("a quoted field with commas and doubled quotes survives the parser", () => {
  const rows = parseCsv('a,b\n"x, ""y""",z\n');
  assert.deepEqual(rows[0], ["a", "b"]);
  assert.deepEqual(rows[1], ['x, "y"', "z"]);
});

test("price bands follow Google's 0–4 scale, and absent stays null", () => {
  assert.equal(priceBand("$8"), 1);
  assert.equal(priceBand("$20–30"), 2);
  assert.equal(priceBand("$30–80"), 3);
  assert.equal(priceBand("$100+"), 4);
  assert.equal(priceBand(""), null);
});

test("open hours become Google periods, Closed days are dropped", () => {
  const hours = parseOpenHours(
    JSON.stringify({
      Monday: ["9 am–5 pm"],
      Friday: ["4–11 pm"],
      Sunday: ["Closed"],
    }),
  ) as { periods: { open: { day: number; hour: number }; close: { hour: number } }[] };
  assert.equal(hours.periods.length, 2);
  const monday = hours.periods.find((p) => p.open.day === 1);
  const friday = hours.periods.find((p) => p.open.day === 5);
  assert.equal(monday?.open.hour, 9);
  assert.equal(monday?.close.hour, 17);
  // "4–11 pm" lets the open inherit the closer's pm.
  assert.equal(friday?.open.hour, 16);
  assert.equal(friday?.close.hour, 23);
  assert.equal(hours.periods.find((p) => p.open.day === 0), undefined);
});

test("a timezone name resolves to UTC offset minutes", () => {
  const offset = tzToUtcOffset("America/Chicago", new Date("2026-01-15T12:00:00Z"));
  // Chicago in January is CST = UTC−6.
  assert.equal(offset, -360);
  assert.equal(tzToUtcOffset(""), null);
});

test("the fixture's hotel row maps to a full EnrichedPlace", () => {
  const rows = parseCsv(fixture);
  const index = csvIndex(rows[0] as string[]);
  const hotel = csvRowToEnriched(rows[1] as string[], index);
  assert.ok(hotel, "first fixture row should map");
  assert.equal(hotel.placeId, "ChIJgx5unqa1RIYR2CPkHBbUaGk");
  assert.equal(hotel.name, "Hotel Indigo Austin Downtown - University by IHG");
  // The category drives primaryType, so isMeal sees it as non-food.
  assert.equal(hotel.primaryType, "hotel");
  assert.equal(hotel.rating, 4.0);
  assert.equal(hotel.reviewCount, 1589);
  assert.equal(hotel.location?.lat, 30.269131);
  // Lodging has no weekly hours on Google; an empty {} must stay null, not a
  // fabricated schedule (the scheduler treats null as always-open).
  assert.equal(hotel.regularOpeningHours, null);
  // No price_range for lodging → null, which clampBand later treats as moderate.
  assert.equal(hotel.priceLevel, null);
  assert.equal(hotel.isOperational, true);
  // 1589 reviews shrink 4.0 toward the 4.0 prior by only a little.
  assert.ok(hotel.bayesianRating > 3.9 && hotel.bayesianRating <= 4.0);
});

test("every mapped row carries the keys the pipeline reads", () => {
  const rows = parseCsv(fixture);
  const index = csvIndex(rows[0] as string[]);
  const expected = [
    "id", "placeId", "name", "location", "primaryType", "primaryTypeName",
    "types", "address", "utcOffsetMinutes", "rating", "reviewCount",
    "bayesianRating", "priceLevel", "regularOpeningHours", "photoName",
    "businessStatus", "isOperational", "vicinity", "editorialSummary",
  ];
  for (const row of rows.slice(1)) {
    const place = csvRowToEnriched(row, index);
    if (!place) continue;
    for (const key of expected) assert.ok(key in place, `missing ${key}`);
  }
});
