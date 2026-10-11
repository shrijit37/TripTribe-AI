import test from "node:test";
import assert from "node:assert/strict";
import {
  haversineMeters,
  bearingDegrees,
  estimateTravelMinutes,
  closeness,
  centroid,
  diameterMeters,
  ROAD_CIRCUITY,
} from "@/server/domain/solver/geo";
import {
  partitionIntoDays,
  byQuality,
} from "@/server/domain/solver/dayPartition";
import {
  sequenceDay,
  nearestNeighbour,
  twoOpt,
  orOpt,
  pathMinutes,
} from "@/server/domain/solver/sequence";
import {
  scheduleDay,
  dwellMinutes,
  parseOpeningHours,
  formatClock,
  weekdayName,
  type ScheduledStop,
} from "@/server/domain/solver/schedule";
import {
  costTrip,
  parseCurrencyCode,
  transportCost,
  lodgingCost,
  occasionCost,
} from "@/server/domain/solver/cost";
import { isMeal, assignMealRoles } from "@/server/domain/solver/pipeline";
import type { GeoPoint } from "@/server/domain/types";

// ── Fixtures ──────────────────────────────────────────────────────────────
// Every test runs on fixed coordinates. No randomness anywhere: the solver's
// claim is that the same request always produces the same plan, and a test that
// used randomness could not assert that.

/**
 * The place shape every solver stage accepts. The port keeps three internal
 * aliases for one thing (`PartitionPlace`, `SequencePlace`, `SchedulePlace`),
 * so this single type stands in for all of them.
 */
type SolverPlace = Parameters<typeof nearestNeighbour>[0][number];

const P = (
  id: string,
  lat: number,
  lng: number,
  extra: Partial<SolverPlace> = {},
): SolverPlace => ({
  id,
  placeId: id,
  name: `Place ${id}`,
  rating: 4.5,
  bayesianRating: 4.5,
  isOperational: true,
  location: { lat, lng },
  ...extra,
});

// Two fixtures below label their places with numbers, because an assertion reads
// the label back: `placeId` has to still be the number 0, not "0". Google place
// ids are always strings, so the port's `placeId?: string` is right and stays
// that way — the deliberate mismatch is confined to this fixture.
const numbered = (label: number, lat: number, lng: number): SolverPlace =>
  ({ ...P(String(label), lat, lng), placeId: label }) as unknown as SolverPlace;

// A place carrying only the fields a test cares about. Several tests probe
// half-built places on purpose — no hours, no rating, no location — so the
// missing fields are the case under test, not an oversight.
const bare = (partial: Partial<SolverPlace>): SolverPlace =>
  partial as SolverPlace;

// Every measurement below answers null for unusable input and every lookup can
// come back empty. The assertions are all about real values, so the narrowing
// lives here once instead of at each call site.
const must = <T>(value: T | null): T => {
  assert.ok(value !== null, "expected a value, got null");
  return value;
};

const nth = <T>(list: readonly T[], index: number): T => {
  const item = list[index];
  assert.ok(item !== undefined, `expected item ${index} to exist`);
  return item;
};

// Two clusters about 6 km apart.
const clusterA = Array.from({ length: 6 }, (_, i) =>
  P(`A${i}`, 26.9124 + i * 0.0005, 75.7873 + i * 0.0005),
);
const clusterB = Array.from({ length: 6 }, (_, i) =>
  P(`B${i}`, 26.97 + i * 0.0005, 75.83 + i * 0.0005),
);
const twoClusters = [...clusterA, ...clusterB];

// Google's period shape: open and close live in ONE object.
const period = (day: number, openHour: number, closeHour: number) => ({
  open: { day, hour: openHour, minute: 0 },
  close: { day, hour: closeHour, minute: 0 },
});
const everyDay = (openHour: number, closeHour: number) =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => period(d, openHour, closeHour));

// ── geo ───────────────────────────────────────────────────────────────────

test("haversine is zero for a point against itself", () => {
  assert.equal(
    haversineMeters({ lat: 26.9, lng: 75.7 }, { lat: 26.9, lng: 75.7 }),
    0,
  );
});

test("haversine matches a known long distance", () => {
  const parisToLondon = must(
    haversineMeters(
      { lat: 48.8566, lng: 2.3522 },
      { lat: 51.5074, lng: -0.1278 },
    ),
  );
  assert.ok(
    parisToLondon > 340_000 && parisToLondon < 348_000,
    `got ${parisToLondon}`,
  );
});

test("haversine returns null for unusable coordinates, never NaN", () => {
  // NaN silently turns every comparison false, which makes an optimiser look
  // like it ran while returning nonsense.
  for (const bad of [
    { lat: "x", lng: 1 },
    { lat: 1 },
    {},
    null,
    undefined,
    { lat: NaN, lng: 1 },
  ] as unknown[]) {
    assert.equal(haversineMeters(bad as GeoPoint, { lat: 1, lng: 1 }), null);
  }
});

test("haversine is symmetric", () => {
  const a = { lat: 48.8566, lng: 2.3522 };
  const b = { lat: 51.5074, lng: -0.1278 };
  assert.ok(
    Math.abs(must(haversineMeters(a, b)) - must(haversineMeters(b, a))) < 1,
  );
});

test("bearing points north from the equator", () => {
  assert.ok(
    Math.abs(must(bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })) - 0) <
      0.01,
  );
});

test("travel time scales inversely with speed", () => {
  const from = { lat: 26.9124, lng: 75.7873 };
  const to = { lat: 26.9224, lng: 75.7873 }; // ~1.1 km
  const walk = must(estimateTravelMinutes(from, to, { mode: "WALK" }));
  const drive = must(estimateTravelMinutes(from, to, { mode: "DRIVE" }));
  assert.ok(walk > drive, `walk ${walk} should exceed drive ${drive}`);
});

test("driving is never slower than walking", () => {
  const from = { lat: 26.9124, lng: 75.7873 };
  for (const offset of [0.002, 0.01, 0.05]) {
    const to = { lat: 26.9124 + offset, lng: 75.7873 };
    assert.ok(
      must(estimateTravelMinutes(from, to, { mode: "DRIVE" })) <=
        must(estimateTravelMinutes(from, to, { mode: "WALK" })),
    );
  }
});

test("a short hop still costs real time, not zero", () => {
  // Under ~150 m the fixed cost of crossing a road dominates.
  const minutes = must(
    estimateTravelMinutes(
      { lat: 26.9124, lng: 75.7873 },
      { lat: 26.913, lng: 75.7878 },
      { mode: "WALK" },
    ),
  );
  assert.ok(minutes > 0, "a 60 m hop must not be free");
});

test("travel time is null for unusable input", () => {
  assert.equal(
    estimateTravelMinutes({ lat: "x", lng: 1 } as unknown as GeoPoint, {
      lat: 1,
      lng: 1,
    }),
    null,
  );
});

test("closeness is monotonically decreasing in distance", () => {
  const near = closeness(500);
  const mid = closeness(3000);
  const far = closeness(10000);
  assert.ok(near > mid && mid > far);
  assert.equal(closeness(null), 0);
});

test("centroid averages real coordinates", () => {
  const c = must(
    centroid([
      { lat: 10, lng: 20 },
      { lat: 20, lng: 40 },
    ]),
  );
  assert.equal(c.lat, 15);
  assert.equal(c.lng, 30);
  assert.equal(centroid([]), null);
});

test("diameter is zero for one point and positive for many", () => {
  assert.equal(diameterMeters([{ lat: 1, lng: 1 }]), 0);
  assert.ok(
    diameterMeters([
      { lat: 1, lng: 1 },
      { lat: 2, lng: 2 },
    ]) > 0,
  );
});

test("the circuity factor is a sane multiplier, not 1", () => {
  assert.ok(ROAD_CIRCUITY > 1.1 && ROAD_CIRCUITY < 1.5);
});

// ── day partitioning ──────────────────────────────────────────────────────

test("byQuality ranks higher ratings first, breaking ties on id", () => {
  const a = P("zzz", 1, 1, { rating: 4.0, bayesianRating: 4.0 });
  const b = P("aaa", 1, 1, { rating: 4.9, bayesianRating: 4.9 });
  assert.ok(byQuality(b, a) < 0, "higher rating sorts first");
});

test("byQuality is a total order — equal scores never swap", () => {
  const a = P("aaa", 1, 1, { rating: 4.0, bayesianRating: 4.0 });
  const b = P("bbb", 1, 1, { rating: 4.0, bayesianRating: 4.0 });
  // Must be exactly one of true/false, never 0 (which would be unstable).
  assert.equal(Math.sign(byQuality(a, b)), -Math.sign(byQuality(b, a)));
  assert.notEqual(byQuality(a, b), 0);
});

test("partitioning returns exactly the requested number of days", () => {
  for (const dayCount of [1, 2, 3, 4, 6]) {
    const { metrics } = partitionIntoDays(twoClusters, {
      dayCount,
      stopsPerDay: 4,
    });
    assert.equal(metrics.actualDays, dayCount, `${dayCount} days requested`);
  }
});

test("no day exceeds the pace stop budget", () => {
  for (const stopsPerDay of [1, 2, 3, 4, 6]) {
    for (const dayCount of [1, 2, 3, 5]) {
      const { metrics } = partitionIntoDays(twoClusters, {
        dayCount,
        stopsPerDay,
      });
      for (const size of metrics.sizes) {
        assert.ok(
          size <= stopsPerDay,
          `day of ${size} exceeds pace ${stopsPerDay}`,
        );
      }
    }
  }
});

test("partitioning ignores places without usable coordinates", () => {
  // 0,0 is a real coordinate (Null Island), so it is deliberately not in this
  // list — only genuinely missing and non-finite coordinates are unusable.
  const withBad = [
    ...twoClusters,
    bare({ placeId: "nodata", name: "no location" }),
    P("nan", NaN, 75.7),
  ];
  const { metrics } = partitionIntoDays(withBad, {
    dayCount: 2,
    stopsPerDay: 6,
  });
  assert.equal(
    metrics.stopsUnlocatable,
    2,
    "missing and NaN coordinates are both unusable",
  );
  assert.equal(metrics.stopsUsed, 12);
});
test("a place never appears on two days", () => {
  // The original implementation removed places with reference equality on
  // cloned objects, which silently removed nothing and duplicated instead.
  const { days, metrics } = partitionIntoDays(twoClusters, {
    dayCount: 3,
    stopsPerDay: 4,
  });
  const all = days.flat().map((p) => p.placeId);
  assert.equal(new Set(all).size, all.length, "duplicate place across days");
  for (let i = 0; i < days.length; i += 1) {
    assert.equal(
      metrics.distinctPerDay[i],
      metrics.sizes[i],
      `day ${i + 1} has duplicates`,
    );
  }
});

test("every used place appears exactly once", () => {
  const { days, metrics } = partitionIntoDays(twoClusters, {
    dayCount: 2,
    stopsPerDay: 6,
  });
  assert.equal(days.flat().length, metrics.stopsUsed);
  assert.equal(
    new Set(days.flat().map((p) => p.placeId)).size,
    metrics.stopsUsed,
  );
});

test("pace caps total stops — a short trip cannot use the whole pool", () => {
  // 2 days at 4 stops/day is 8, even though 12 places are available.
  const { metrics } = partitionIntoDays(twoClusters, {
    dayCount: 2,
    stopsPerDay: 4,
  });
  assert.equal(metrics.stopsUsed, 8);
  assert.ok(metrics.stopsDroppedByPace > 0);
});

test("partitioning is deterministic", () => {
  const run = () =>
    JSON.stringify(
      partitionIntoDays(twoClusters, { dayCount: 3, stopsPerDay: 4 }).days.map(
        (d) => d.map((p) => p.placeId),
      ),
    );
  assert.equal(run(), run());
});

test("each day's stops are geographically close together", () => {
  // The whole point: a day is a route, not a scatter across the whole city.
  const { metrics } = partitionIntoDays(twoClusters, {
    dayCount: 2,
    stopsPerDay: 6,
  });
  for (const diameter of metrics.dayDiameters) {
    assert.ok(diameter < 1000, `day spread ${diameter} m is too wide`);
  }
});

test("partitioning rejects unusable input", () => {
  assert.throws(
    () => partitionIntoDays([], { dayCount: 2, stopsPerDay: 4 }),
    /at least one place/,
  );
  assert.throws(
    () => partitionIntoDays(twoClusters, { dayCount: 0, stopsPerDay: 4 }),
    /positive integer/,
  );
  assert.throws(
    () =>
      partitionIntoDays([bare({ placeId: "x" })], {
        dayCount: 1,
        stopsPerDay: 4,
      }),
    /coordinates/,
  );
});

test("day 1 sits nearest the hotel anchor", () => {
  const anchor = P("hotel", 26.9124, 75.7873);
  const { days } = partitionIntoDays(twoClusters, {
    dayCount: 2,
    stopsPerDay: 6,
    anchor,
  });
  // `centroid([])` is null, so a day that did not exist fails the assertion
  // rather than quietly measuring against nothing. `anchor` is handed over as
  // a place rather than as `anchor.location` because the geo helpers accept the
  // `{ location: { lat, lng } }` shape directly.
  const centreOf = (day: readonly SolverPlace[] | undefined) =>
    must(centroid(day ?? []));
  const d1 = must(haversineMeters(centreOf(days[0]), anchor));
  const d2 = must(haversineMeters(centreOf(days[1]), anchor));
  assert.ok(d1 <= d2, "day 1 should be the one nearest the hotel");
});

// ── sequencing ────────────────────────────────────────────────────────────

const sixPlaces = [
  numbered(0, 26.9124, 75.7873),
  numbered(1, 26.92, 75.7873),
  numbered(2, 26.92, 75.8),
  numbered(3, 26.9124, 75.8),
  numbered(4, 26.916, 75.79),
  numbered(5, 26.908, 75.795),
];

test("2-opt never lengthens a route", () => {
  const seed = nearestNeighbour(sixPlaces, { mode: "WALK" });
  const improved = twoOpt(seed, { mode: "WALK" });
  assert.ok(
    pathMinutes(improved, { mode: "WALK" }) <=
      pathMinutes(seed, { mode: "WALK" }) + 1e-9,
  );
});

test("Or-opt never lengthens a route", () => {
  const two = twoOpt(nearestNeighbour(sixPlaces, { mode: "WALK" }), {
    mode: "WALK",
  });
  const three = orOpt(two, { mode: "WALK" });
  assert.ok(
    pathMinutes(three, { mode: "WALK" }) <=
      pathMinutes(two, { mode: "WALK" }) + 1e-9,
  );
});

test("optimisation preserves every stop exactly once", () => {
  const { order } = sequenceDay(sixPlaces, { mode: "WALK" });
  assert.equal(order.length, sixPlaces.length);
  assert.equal(new Set(order.map((p) => p.placeId)).size, sixPlaces.length);
});

test("sequencing is deterministic", () => {
  const run = () =>
    sequenceDay(sixPlaces, { mode: "WALK" })
      .order.map((p) => p.placeId)
      .join(",");
  assert.equal(run(), run());
});

test("an anchored day opens at the stop nearest the hotel", () => {
  const hotel = P("hotel", 26.9124, 75.7873);
  const { order, travelMinutes } = sequenceDay(sixPlaces, {
    mode: "WALK",
    anchor: hotel,
  });
  assert.equal(nth(order, 0).placeId, 0, "P0 is closest to the hotel");
  assert.ok(travelMinutes > 0);
});

test("sequencing handles degenerate day sizes", () => {
  assert.deepEqual(sequenceDay([]).order, []);
  assert.equal(sequenceDay(sixPlaces.slice(0, 1)).order.length, 1);
  assert.equal(sequenceDay(sixPlaces.slice(0, 2)).order.length, 2);
});

test("twoOpt terminates on a path where every stop is equidistant", () => {
  // The pathological case for strict-improvement loops: no move can improve,
  // so the pass must break rather than spin.
  const ring = [0, 90, 180, 270].map((deg) =>
    numbered(deg, 26.9124, 75.7873 + deg * 0.001),
  );
  const result = twoOpt(nearestNeighbour(ring, { mode: "WALK" }), {
    mode: "WALK",
  });
  assert.equal(result.length, 4);
});

// ── scheduling ────────────────────────────────────────────────────────────

test("dwell time reflects the kind of place", () => {
  assert.ok(
    dwellMinutes(bare({ primaryType: "museum" })) >
      dwellMinutes(bare({ primaryType: "viewpoint" })),
  );
  assert.equal(dwellMinutes(bare({ primaryType: "museum" })), 120);
  assert.equal(
    dwellMinutes(bare({})),
    45,
    "an unknown type still costs real time",
  );
});

test("no hours published means unknown, not closed", () => {
  // Treating unknown as closed would silently delete most places — many
  // listings publish no hours at all.
  assert.equal(parseOpeningHours(bare({})), null);
  assert.equal(
    parseOpeningHours(bare({ regularOpeningHours: { periods: [] } })),
    null,
  );
});

test("hours are parsed into per-weekday windows", () => {
  const windows = must(
    parseOpeningHours(
      bare({ regularOpeningHours: { periods: everyDay(9, 18) } }),
    ),
  );
  assert.deepEqual(windows.get(3), [{ open: 540, close: 1080 }]);
});

test("an open place is scheduled at its arrival time", () => {
  const places = [
    P("M1", 26.9124, 75.7873, {
      regularOpeningHours: { periods: everyDay(9, 18) },
      primaryType: "museum",
    }),
    P("M2", 26.913, 75.788, {
      regularOpeningHours: { periods: everyDay(9, 18) },
      primaryType: "museum",
    }),
  ];
  const result = scheduleDay(places, {
    weekday: 3,
    startMinute: 540,
    mode: "WALK",
  });
  assert.equal(result.stops.length, 2);
  assert.equal(result.dropped.length, 0);
  assert.equal(nth(result.stops, 0).arriveAt, 540);
  assert.ok(
    nth(result.stops, 1).arriveAt > nth(result.stops, 0).departAt,
    "stops must not overlap",
  );
});

test("a place closed on the visited weekday is dropped, and reported", () => {
  const mondayOnly = [
    P("MonM", 26.9124, 75.7873, {
      regularOpeningHours: { periods: [period(1, 9, 13)] },
    }),
  ];
  const result = scheduleDay(mondayOnly, {
    weekday: 0,
    startMinute: 540,
    mode: "WALK",
  });
  assert.equal(result.stops.length, 0);
  assert.equal(result.dropped.length, 1);
  assert.equal(nth(result.dropped, 0).reason, "closed");
});

test("waiting more than two hours is a drop, not a wait", () => {
  // Five days until a Monday-only museum is not a good reason to keep it.
  const result = scheduleDay(
    [
      P("MonM", 26.9124, 75.7873, {
        regularOpeningHours: { periods: [period(1, 9, 13)] },
      }),
    ],
    { weekday: 0, startMinute: 540, mode: "WALK" },
  );
  assert.equal(result.stops.length, 0);
  assert.ok(result.dropped.length === 1);
});

test("a short wait pushes the arrival and is flagged", () => {
  // Opens at 12:00; the traveller arrives at 11:15 and waits 45 minutes,
  // which is inside the 120-minute tolerance.
  const result = scheduleDay(
    [
      P("NoonM", 26.9124, 75.7873, {
        regularOpeningHours: { periods: [period(0, 12, 20)] },
      }),
    ],
    { weekday: 0, startMinute: 11 * 60 + 15, mode: "WALK" },
  );
  assert.equal(result.stops.length, 1, "a 45-minute wait is tolerable");
  assert.equal(
    nth(result.stops, 0).arriveAt,
    12 * 60,
    "arrival is pushed to opening time",
  );
  assert.equal(nth(result.stops, 0).openedAt, true);
  assert.ok(nth(result.stops, 0).waitMinutes > 0);
});

test("a place already open is not treated as a wait", () => {
  const result = scheduleDay(
    [
      P("OpenM", 26.9124, 75.7873, {
        regularOpeningHours: { periods: [period(0, 9, 20)] },
      }),
    ],
    { weekday: 0, startMinute: 11 * 60, mode: "WALK" },
  );
  assert.equal(nth(result.stops, 0).arriveAt, 11 * 60);
  assert.equal(nth(result.stops, 0).waitMinutes, 0);
  assert.equal(nth(result.stops, 0).openedAt, false);
});

test("an arrival after closing time drops the stop", () => {
  const closesAt18 = everyDay(9, 18);
  const far = Array.from({ length: 6 }, (_, i) =>
    P(`S${i}`, 26.9124 + i * 0.05, 75.7873, {
      regularOpeningHours: { periods: closesAt18 },
    }),
  );
  const result = scheduleDay(far, {
    weekday: 3,
    startMinute: 540,
    mode: "WALK",
  });
  // Whatever survives must finish before close, and the rest are reported.
  for (const stop of result.stops) {
    assert.ok(stop.arriveAt <= 18 * 60, "a stop is scheduled after closing");
  }
  assert.equal(result.stops.length + result.dropped.length, 6);
});

test("an unknown-hours place is always scheduled", () => {
  const result = scheduleDay([P("U", 26.9124, 75.7873)], {
    weekday: 3,
    startMinute: 540,
    mode: "WALK",
  });
  assert.equal(result.stops.length, 1);
});

test("the schedule costs each leg the same way the optimiser did", () => {
  // If these diverge, a day optimised to fit will not fit on the clock. The
  // travel is recorded on the *arriving* stop, not the first one.
  const places = [P("A", 26.9124, 75.7873), P("B", 26.916, 75.79)];
  const ordered = nearestNeighbour(places, { mode: "WALK" });
  const estimate = must(
    estimateTravelMinutes(nth(ordered, 0), nth(ordered, 1), { mode: "WALK" }),
  );
  const scheduled = scheduleDay(ordered, {
    weekday: 3,
    startMinute: 540,
    mode: "WALK",
  });
  assert.equal(nth(scheduled.stops, 1).travelMinutes, Math.round(estimate));
  assert.equal(
    nth(scheduled.stops, 0).travelMinutes,
    0,
    "no leg precedes the first stop",
  );
});

test("scheduling is deterministic", () => {
  const places = sixPlaces.map((p) => ({
    ...p,
    regularOpeningHours: { periods: everyDay(9, 18) },
  }));
  const run = () =>
    JSON.stringify(
      scheduleDay(places, { weekday: 3, startMinute: 540, mode: "WALK" }).stops,
    );
  assert.equal(run(), run());
});

test("formatClock renders minutes past midnight", () => {
  assert.equal(formatClock(540), "09:00");
  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(1285), "21:25");
  assert.equal(formatClock(null), null);
});

test("weekday names use Google's 0=Sunday numbering", () => {
  assert.equal(weekdayName(0), "Sunday");
  assert.equal(weekdayName(6), "Saturday");
  assert.equal(weekdayName(9), null);
});

// ── meal classification ───────────────────────────────────────────────────

// The regression: `confectionery` and `tea_house` arrive on a `restaurant` or
// `cafe` query as subtypes. Classified as attractions they were partitioned as
// day activities, so a plan's pace was eaten by sweet shops — real case,
// Laxmi Misthan Bhandar and Masala Chowk on a Jaipur trip.
test("food subtypes that a meal query returns are still meals", () => {
  for (const type of [
    "confectionery",
    "tea_house",
    "restaurant",
    "food_court",
    "cafe",
    "bakery",
  ]) {
    assert.equal(
      isMeal({ types: [type], primaryType: type }),
      true,
      `${type} must be a meal`,
    );
    assert.equal(
      isMeal({ types: ["point_of_interest", type], primaryType: null }),
      true,
      `${type} must be a meal`,
    );
  }
});

test("an attraction is never a meal", () => {
  for (const type of [
    "tourist_attraction",
    "museum",
    "historical_landmark",
    "park",
    "shopping_mall",
    "lodging",
  ]) {
    assert.equal(
      isMeal({ types: [type], primaryType: type }),
      false,
      `${type} must not be a meal`,
    );
    assert.equal(
      isMeal({ types: ["establishment", type], primaryType: null }),
      false,
      `${type} must not be a meal`,
    );
  }
});

// `assignMealRoles` reads only `place` and `arriveAt` off a stop and writes
// `role` back onto it; the rest of the stop is filled in so each fixture is a
// real stop rather than a fragment of one.
const stopAt = (place: SolverPlace, arriveAt: number): ScheduledStop => ({
  place,
  placeId: place.placeId ?? place.name,
  name: place.name,
  arriveAt,
  departAt: arriveAt,
  dwellMinutes: 60,
  travelMinutes: 0,
  waitMinutes: 0,
  openedAt: true,
  role: null,
});

// Only the third stop falls in a meal window, so only it is named. The other
// two are meals regardless — a caller counting pace by `role != null` counts
// them as activities, which is exactly the defect the smoke test guards.
test("a meal outside every clock window is still a meal, it is just unnamed", () => {
  const named = [
    stopAt(
      P("M1", 26.91, 75.78, {
        primaryType: "restaurant",
        types: ["restaurant"],
      }),
      9 * 60,
    ),
    stopAt(
      P("M2", 26.91, 75.79, {
        primaryType: "confectionery",
        types: ["confectionery"],
      }),
      16 * 60,
    ),
    stopAt(
      P("M3", 26.92, 75.79, {
        primaryType: "restaurant",
        types: ["restaurant"],
      }),
      13 * 60,
    ),
  ];
  const meals = assignMealRoles(named);

  assert.equal(
    must(meals.lunch).place.placeId,
    "M3",
    "the stop inside the lunch window is named lunch",
  );
  assert.equal(
    meals.dinner,
    null,
    "16:00 is between the lunch and dinner windows",
  );
  // Named or not, all three are food venues, so none of them takes an
  // activity slot.
  assert.deepEqual(
    named.filter((s) => !isMeal(s.place)).map((s) => s.place.placeId),
    [],
  );
});

test("one stop wins a meal slot; a second stop in the same window does not", () => {
  const stops = [
    stopAt(P("M1", 26.91, 75.78, { primaryType: "cafe" }), 13 * 60),
    stopAt(P("M2", 26.91, 75.79, { primaryType: "cafe" }), 13 * 60 + 30),
  ];
  const meals = assignMealRoles(stops);

  assert.equal(must(meals.lunch).place.placeId, "M1");
  assert.equal(nth(stops, 0).role, "lunch");
  assert.equal(nth(stops, 1).role, null);
});

// ── cost ──────────────────────────────────────────────────────────────────

test("currency codes are parsed from free text", () => {
  assert.equal(parseCurrencyCode("INR (₹)"), "INR");
  assert.equal(parseCurrencyCode("Japanese Yen (JPY)"), "JPY");
  assert.equal(parseCurrencyCode("Euro"), "EUR");
  assert.equal(parseCurrencyCode("Rupee"), "INR");
  assert.equal(parseCurrencyCode("nonsense"), null);
});

test("a higher price tier always costs more", () => {
  const cheap = occasionCost(
    "meal",
    { priceLevel: 0 },
    { headcount: 2, currency: "INR" },
  );
  const dear = occasionCost(
    "meal",
    { priceLevel: 4 },
    { headcount: 2, currency: "INR" },
  );
  assert.ok(dear > cheap);
});

test("headcount scales cost linearly", () => {
  const one = occasionCost(
    "meal",
    { priceLevel: 2 },
    { headcount: 1, currency: "INR" },
  );
  const four = occasionCost(
    "meal",
    { priceLevel: 2 },
    { headcount: 4, currency: "INR" },
  );
  assert.equal(four, one * 4);
});

test("lodging charges nights, not days", () => {
  // A traveller sleeps on days 1..n-1; the last day they leave.
  const three = lodgingCost(
    { priceLevel: 2 },
    { days: 3, headcount: 2, currency: "INR" },
  );
  const four = lodgingCost(
    { priceLevel: 2 },
    { days: 4, headcount: 2, currency: "INR" },
  );
  assert.ok(four > three);
});

test("walking costs nothing to move around", () => {
  assert.equal(
    transportCost(18000, { mode: "WALK", headcount: 2, currency: "INR" }),
    0,
  );
});

test("driving uses the traveller's own fuel figures when given", () => {
  const withFuel = transportCost(380000, {
    mode: "DRIVE",
    headcount: 2,
    currency: "INR",
    fuel: { kmPerLitre: 15, pricePerLitre: 100 },
  });
  const without = transportCost(380000, {
    mode: "DRIVE",
    headcount: 2,
    currency: "INR",
  });
  assert.ok(withFuel > 0 && without > 0);
});

test("transport scales with measured distance", () => {
  const near = transportCost(2000, {
    mode: "TRANSIT",
    headcount: 1,
    currency: "INR",
  });
  const far = transportCost(50000, {
    mode: "TRANSIT",
    headcount: 1,
    currency: "INR",
  });
  assert.ok(far > near);
});

test("a costed trip is always labelled an estimate", () => {
  const result = costTrip({
    days: 3,
    budget: 100000,
    currency: "INR",
    headcount: 2,
    totalMeters: 12000,
  });
  assert.equal(result.isEstimate, true);
});

test("the budget verdict is computed, not asserted", () => {
  const rich = costTrip({
    days: 3,
    budget: 10_000_000,
    currency: "INR",
    headcount: 2,
    hotel: { priceLevel: 2 },
    totalMeters: 12000,
  });
  assert.equal(rich.feasible, true);
  assert.equal(rich.shortfall, 0);

  const poor = costTrip({
    days: 10,
    budget: 5000,
    currency: "INR",
    headcount: 6,
    hotel: { priceLevel: 4 },
    activities: [{ priceLevel: 4 }],
    meals: { dinner: [{ priceLevel: 4 }] },
    totalMeters: 60000,
  });
  assert.equal(poor.feasible, false);
  assert.ok(poor.shortfall > 0);
  assert.ok(
    poor.suggestions.length > 0,
    "an over-budget trip must say how to fix it",
  );
});

test("the breakdown always sums to the total", () => {
  const result = costTrip({
    days: 4,
    budget: 100000,
    currency: "INR",
    headcount: 2,
    hotel: { priceLevel: 2 },
    activities: [{ priceLevel: 2 }, { priceLevel: 1 }],
    meals: { lunch: [{ priceLevel: 2 }], dinner: [{ priceLevel: 3 }] },
    totalMeters: 18000,
  });
  const summed = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
  // Rounding means they agree to within a rupee per line, not exactly.
  assert.ok(
    Math.abs(summed - result.total) <= 4,
    `summed ${summed} vs total ${result.total}`,
  );
});

test("cost is stable across runs", () => {
  const run = () =>
    JSON.stringify(
      costTrip({
        days: 4,
        budget: 48000,
        currency: "INR",
        headcount: 2,
        hotel: { priceLevel: 2 },
        totalMeters: 18000,
      }),
    );
  assert.equal(run(), run());
});

test("zero distance costs zero rather than a phantom fare", () => {
  assert.equal(
    transportCost(0, { mode: "TRANSIT", headcount: 2, currency: "INR" }),
    0,
  );
});

// ── End-to-end determinism ────────────────────────────────────────────────

test("partition → sequence → schedule is reproducible end to end", () => {
  const run = () => {
    const { days } = partitionIntoDays(twoClusters, {
      dayCount: 3,
      stopsPerDay: 4,
    });
    return days.map((day) => {
      const { order } = sequenceDay(day, { mode: "WALK" });
      const { stops, dropped } = scheduleDay(order, {
        weekday: 2,
        startMinute: 540,
        mode: "WALK",
      });
      return {
        order: order.map((p) => p.placeId),
        times: stops.map((s) => `${s.placeId}@${s.arriveAt}`),
        dropped: dropped.map((d) => d.placeId),
      };
    });
  };

  assert.deepEqual(run(), run());
});

test("every stop in the final plan sits within the day's window", () => {
  const { days } = partitionIntoDays(twoClusters, {
    dayCount: 2,
    stopsPerDay: 6,
  });
  for (const day of days) {
    const { order } = sequenceDay(day, { mode: "WALK" });
    const { stops } = scheduleDay(order, {
      weekday: 2,
      startMinute: 540,
      mode: "WALK",
    });
    for (const stop of stops) {
      assert.ok(stop.arriveAt >= 540, "a stop starts before the day does");
      assert.ok(stop.departAt > stop.arriveAt, "a stop has no duration");
    }
  }
});
