import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDurationSeconds,
  haversineMeters,
  MAX_MATRIX_ELEMENTS,
  toLatLng,
  computeRoutesOptimized,
  computeRouteMatrix,
} from "@/server/domain/places/routes";
import {
  assertMaskIsSafe,
  bareId,
  DISCOVERY_MASK,
  ENRICHMENT_MASK,
  enrichPlaces,
  searchNearby,
} from "@/server/domain/places/client";

// ── Wire-format helpers ───────────────────────────────────────────────────
// These tests assert on what the clients actually put on the wire, so each stub
// captures the request instead of returning a canned answer. `fetch` is a
// heavily overloaded global that none of these plain handlers satisfy, so they
// are installed through one cast rather than one cast per call site.

/** A waypoint as the clients post it: the nested Google shape plus a `via` flag. */
type SentWaypoint = {
  via?: unknown;
  location: { latLng: { latitude: number; longitude: number } };
};

// `intermediates` is a two-tuple because this suite always sends exactly two,
// so `intermediates[0]` is known to exist without a runtime check.
interface RouteBody {
  language?: unknown;
  languageCode?: unknown;
  departureTime?: unknown;
  optimizeWaypointOrder?: unknown;
  intermediates: [SentWaypoint, SentWaypoint];
}

interface SearchBody {
  language?: unknown;
  languageCode?: unknown;
}
// Derived from `fetch` itself so the stub signature cannot drift from the global
// it replaces, and so the name resolves under eslint, which does not know the
// `RequestInit` type.
type FetchInit = Parameters<typeof globalThis.fetch>[1];
const stubFetch = (
  handler: (url: string, init?: FetchInit) => Promise<unknown>,
): typeof globalThis.fetch => handler as unknown as typeof globalThis.fetch;

// Both of these answer "unusable input" with null. The assertions below are
// about real numbers, so the narrowing lives here instead of at every call site.
const duration = (value: unknown): number => {
  const seconds = parseDurationSeconds(value);
  assert.ok(
    seconds !== null,
    `expected ${JSON.stringify(value)} to parse to seconds`,
  );
  return seconds;
};

const distance = (
  from: Parameters<typeof haversineMeters>[0],
  to: Parameters<typeof haversineMeters>[1],
): number => {
  const meters = haversineMeters(from, to);
  assert.ok(
    meters !== null,
    "expected the two points to be far enough apart to measure",
  );
  return meters;
};

// ── Regression: request body shape ────────────────────────────────────────
// `language` (legacy) and `languageCode` both being present, or `intermediates`
// going missing, both produce a 400 or a waypoint-less route at the API. These
// assert the exact body sent.

test("computeRoutesOptimized sends languageCode and every stop as a waypoint", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-stub-key";
  // Declared, never initialised: the stub below is what fills it in, and an
  // initial `null` would make `assert.ok(body)` narrow to `never` instead of
  // proving a request was actually made.
  let body: RouteBody | null | undefined;
  globalThis.fetch = stubFetch(async (_url, init) => {
    body = JSON.parse(String(init?.body)) as RouteBody;
    return {
      ok: true,
      json: async () => ({
        routes: [
          {
            optimizedIntermediateWaypointIndex: [1, 0],
            duration: "600s",
            distanceMeters: 4200,
            legs: [
              { duration: "300s", distanceMeters: 2100 },
              { duration: "300s", distanceMeters: 2100 },
            ],
          },
        ],
      }),
    };
  });
  try {
    await computeRoutesOptimized({
      origin: { lat: 26.9124, lng: 75.7873 },
      intermediates: [
        { location: { lat: 26.916, lng: 75.79 } },
        { location: { lat: 26.9145, lng: 75.788 } },
      ],
      travelMode: "DRIVE",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }

  assert.ok(body, "no request was made");
  assert.equal(body.languageCode, "en");
  assert.ok(
    !("language" in body),
    `legacy "language" is rejected by the API; sent ${JSON.stringify(body)}`,
  );
  assert.equal(
    body.intermediates.length,
    2,
    "every stop must be sent as a waypoint",
  );
  assert.ok(
    body.intermediates.every((w) => w.via === false),
    "no waypoint may be a via waypoint when optimising",
  );
  assert.ok(
    body.intermediates[0].location.latLng.latitude === 26.916,
    "nested place shape must map through toLatLng",
  );
  assert.equal(body.optimizeWaypointOrder, true);
  assert.ok(
    !("departureTime" in body),
    "omitting a departure time keeps the request off the traffic-billed SKU",
  );
});

test("resolveCity sends languageCode, not the legacy language field", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-stub-key";
  let body: SearchBody = {};
  globalThis.fetch = stubFetch(async (_url, init) => {
    body = JSON.parse(String(init?.body)) as SearchBody;
    return { ok: true, json: async () => ({ places: [] }) };
  });
  try {
    const { resolveCity } = await import("@/server/domain/places/client");
    await resolveCity("Jaipur");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }

  assert.equal(body.languageCode, "en");
  assert.ok(!("language" in body), `legacy "language" is rejected by the API`);
});

test("searchNearby sends languageCode, not the legacy language field", async () => {
  let body: SearchBody = {};
  await withStubbedFetch(
    async (_url, init) => {
      body = JSON.parse(String(init?.body)) as SearchBody;
      return { ok: true, json: async () => ({ places: [] }) };
    },
    () => searchNearby({ latitude: 26.9124, longitude: 75.7873, radius: 5000 }),
  );

  assert.equal(body.languageCode, "en");
  assert.ok(!("language" in body), `legacy "language" is rejected by the API`);
});

// ── Regression: toLatLng ──────────────────────────────────────────────────
// This helper is called by every route function. It once existed only as an
// internal definition that a later edit removed while the call sites survived —
// the module still imported and all 96 tests still passed, because nothing
// exercised the network path. These tests fail on a missing export.

test("toLatLng is exported, not merely referenced", () => {
  assert.equal(typeof toLatLng, "function");
});

test("toLatLng accepts the flat { lat, lng } shape", () => {
  assert.deepEqual(toLatLng({ lat: 26.9124, lng: 75.7873 }), {
    location: { latLng: { latitude: 26.9124, longitude: 75.7873 } },
  });
});

test("toLatLng accepts the nested shape normalisePlace produces", () => {
  // This is the shape the solver will actually pass: places.js returns
  // `{ location: { lat, lng } }`, not a flat pair.
  assert.deepEqual(toLatLng({ location: { lat: 26.9124, lng: 75.7873 } }), {
    location: { latLng: { latitude: 26.9124, longitude: 75.7873 } },
  });
});

test("toLatLng prefers flat coordinates when both are present", () => {
  assert.deepEqual(toLatLng({ lat: 1, lng: 2, location: { lat: 9, lng: 9 } }), {
    location: { latLng: { latitude: 1, longitude: 2 } },
  });
});

// `null`, `undefined` and string coordinates are in this list on purpose: the
// guard has to catch them, so the fixture is deliberately wider than the type.
const badWaypoints: [string, unknown][] = [
  ["missing coordinates", {}],
  ["only lat", { lat: 26.9 }],
  ["only lng", { lng: 75.7 }],
  ["null", null],
  ["undefined", undefined],
  ["string coordinates", { lat: "26.9", lng: "75.7" }],
  ["NaN coordinates", { lat: NaN, lng: 75.7 }],
  ["nested but empty", { location: {} }],
];

for (const [label, bad] of badWaypoints) {
  test(`toLatLng rejects ${label} rather than sending undefined to Google`, () => {
    // Silently producing {latitude: undefined} would query the ocean and
    // return an empty route that looks like "no places nearby".
    assert.throws(
      () => toLatLng(bad as Parameters<typeof toLatLng>[0]),
      /numeric coordinates/,
    );
  });
}

// ── Regression: argument defaults ─────────────────────────────────────────

test("computeRoutesOptimized with no intermediates returns an empty route", async () => {
  // Omitting the argument entirely must not throw — `intermediates.filter`
  // on undefined is a TypeError, not an empty route.
  const result = await computeRoutesOptimized({
    origin: { lat: 26.9124, lng: 75.7873 },
  });
  assert.deepEqual(result.order, []);
  assert.equal(result.totalSeconds, 0);
  assert.equal(result.totalMeters, 0);
});

test("computeRoutesOptimized with an explicit empty array returns an empty route", async () => {
  const result = await computeRoutesOptimized({
    origin: { lat: 26.9124, lng: 75.7873 },
    intermediates: [],
  });
  assert.deepEqual(result.order, []);
});

test("computeRoutesOptimized rejects a missing origin", async () => {
  await assert.rejects(
    () =>
      computeRoutesOptimized({
        intermediates: [{ lat: 1, lng: 2 }],
      } as unknown as Parameters<typeof computeRoutesOptimized>[0]),
    /requires an origin/,
  );
});

test("computeRoutesOptimized rejects more than 25 stops", async () => {
  const stops = Array.from({ length: 26 }, (_, i) => ({
    lat: 26 + i * 0.001,
    lng: 75 + i * 0.001,
  }));
  await assert.rejects(
    () =>
      computeRoutesOptimized({
        origin: { lat: 26.9, lng: 75.7 },
        intermediates: stops,
      }),
    /at most 25 stops/,
  );
});

test("computeRouteMatrix rejects an oversized matrix before calling the API", async () => {
  // 30x30 = 900 elements, over the documented 625. Must fail locally rather
  // than spend a request discovering that.
  const pts = Array.from({ length: 30 }, (_, i) => ({
    lat: 26 + i * 0.001,
    lng: 75 + i * 0.001,
  }));
  await assert.rejects(
    () => computeRouteMatrix({ origins: pts, destinations: pts }),
    /exceeds the 625/,
  );
});

test("computeRouteMatrix rejects an empty origin or destination list", async () => {
  await assert.rejects(
    () =>
      computeRouteMatrix({ origins: [], destinations: [{ lat: 1, lng: 2 }] }),
    /at least one origin/,
  );
});

// ── Regression: Place Details field mask ──────────────────────────────────
// Place Details (New) documents its mask as bare `id,displayName,…`, while the
// search endpoints require the `places.`-prefixed form. Sending the prefixed
// form to Details is rejected by the API.

test("enrichPlaces sends an unprefixed mask to Place Details", async () => {
  let seenMask: string | null | undefined;
  await withStubbedFetch(
    async (_url, init) => {
      seenMask = new Headers(init?.headers).get("X-Goog-FieldMask");
      return {
        ok: true,
        json: async () => ({
          id: "places/ChIJtest",
          displayName: { text: "Test Place" },
          location: { latitude: 26.9, longitude: 75.7 },
        }),
      };
    },
    () => enrichPlaces(["ChIJtest"]),
  );

  assert.ok(seenMask, "no request was made");
  assert.ok(
    !seenMask.includes("places."),
    `mask must be bare, received ${seenMask}`,
  );
  assert.ok(
    seenMask.includes("rating"),
    `mask must still request rating, received ${seenMask}`,
  );
  assert.ok(
    seenMask.includes("regularOpeningHours"),
    `mask must request hours, received ${seenMask}`,
  );
});

test("searchNearby keeps the places. prefix on its mask", async () => {
  let seenMask: string | null | undefined;
  await withStubbedFetch(
    async (_url, init) => {
      seenMask = new Headers(init?.headers).get("X-Goog-FieldMask");
      return { ok: true, json: async () => ({ places: [] }) };
    },
    () => searchNearby({ latitude: 26.9124, longitude: 75.7873, radius: 5000 }),
  );

  assert.ok(
    seenMask?.includes("places."),
    `search masks stay prefixed, received ${seenMask}`,
  );
});

test("searchNearby validates its radius before spending a request", async () => {
  await assert.rejects(
    () =>
      searchNearby({ latitude: 26.9124, longitude: 75.7873, radius: 60_000 }),
    /radius/,
  );
  await assert.rejects(
    () =>
      searchNearby({
        latitude: "26.9",
        longitude: "75.7",
      } as unknown as Parameters<typeof searchNearby>[0]),
    /numeric latitude and longitude/,
  );
});

// The clients refuse to call out without a key, which is correct in production
// but would short-circuit these wire-format assertions before any request is
// made. A dummy satisfies the guard; fetch is stubbed, so nothing is sent.
const withStubbedFetch = async (
  stub: (url: string, init?: FetchInit) => Promise<unknown>,
  run: () => Promise<unknown>,
): Promise<unknown> => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  process.env.GOOGLE_PLACES_API_KEY = "test-stub-key";
  globalThis.fetch = stubFetch(stub);
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
  }
};

// These need no API key. Everything that would spend quota is tested against a
// stub in grounding.smoke.mjs instead, which is run deliberately.

// ── Duration parsing ──────────────────────────────────────────────────────
// Routes returns durations as strings. Parsing them wrong turns a 20-minute
// hop into 20 seconds or 20 hours, which corrupts every downstream schedule.

test('parses the documented "160s" form', () => {
  assert.equal(parseDurationSeconds("160s"), 160);
  assert.equal(parseDurationSeconds("3600s"), 3600);
  assert.equal(parseDurationSeconds("1s"), 1);
});

test("parses the compound 1h20m form", () => {
  assert.equal(parseDurationSeconds("1h20m"), 4800);
  assert.equal(parseDurationSeconds("2h"), 7200);
  assert.equal(parseDurationSeconds("45m"), 2700);
});

test("accepts a numeric duration unchanged", () => {
  assert.equal(parseDurationSeconds(90), 90);
});

test("returns null for unusable input rather than NaN or 0", () => {
  // NaN would silently propagate into every time sum; 0 would claim a place
  // is instantly reachable. Both are worse than "unknown".
  for (const bad of ["", null, undefined, "abc", {}, NaN, "s"]) {
    assert.equal(
      parseDurationSeconds(bad),
      null,
      `expected null for ${JSON.stringify(bad)}`,
    );
  }
});

test("is monotonic — a longer duration never parses lower", () => {
  assert.ok(duration("1h") > duration("59m"));
  assert.ok(duration("3600s") > duration("3599s"));
});

// ── Haversine ─────────────────────────────────────────────────────────────

test("returns zero for identical points", () => {
  assert.equal(
    haversineMeters(
      { lat: 26.9124, lng: 75.7873 },
      { lat: 26.9124, lng: 75.7873 },
    ),
    0,
  );
});

test("matches a known short distance", () => {
  // Two points ~482 m apart in Jaipur, from the haversine formula.
  const d = distance(
    { lat: 26.9124, lng: 75.7873 },
    { lat: 26.916, lng: 75.79 },
  );
  assert.ok(d > 470 && d < 495, `got ${d}`);
});

test("is symmetric", () => {
  const a = { lat: 48.8566, lng: 2.3522 };
  const b = { lat: 51.5074, lng: -0.1278 };
  assert.ok(Math.abs(distance(a, b) - distance(b, a)) < 1);
});

test("approximates a known long distance", () => {
  // Paris to London is ~344 km.
  const d = distance(
    { lat: 48.8566, lng: 2.3522 },
    { lat: 51.5074, lng: -0.1278 },
  );
  assert.ok(d > 340_000 && d < 348_000, `got ${d}`);
});

test("handles crossing the equator and the antimeridian without NaN", () => {
  const d = distance({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 });
  assert.ok(Number.isFinite(d));
  assert.ok(d > 0 && d < 50_000, `got ${d}`);
});

// ── SKU mask guard ────────────────────────────────────────────────────────
// A field mask is a price tag. Adding a field silently moves a whole request
// to a more expensive SKU, for every result returned.

test("rejects Enterprise fields on a Pro-budgeted call", () => {
  for (const field of [
    "places.rating",
    "places.priceLevel",
    "places.regularOpeningHours",
    "places.userRatingCount",
  ]) {
    assert.throws(
      () => assertMaskIsSafe([field]),
      /Enterprise/,
      `expected ${field} to be refused`,
    );
  }
});

test("rejects Atmosphere fields at any budget", () => {
  // Atmosphere is a separate, more expensive SKU and is never requested.
  for (const field of [
    "places.editorialSummary",
    "places.servesBreakfast",
    "places.reviews",
    "places.goodForChildren",
  ]) {
    assert.throws(() => assertMaskIsSafe([field]), /Atmosphere/);
    assert.throws(
      () => assertMaskIsSafe([field], { allowEnterprise: true }),
      /Atmosphere/,
    );
  }
});

test("permits Enterprise fields when the call has budgeted for them", () => {
  assert.deepEqual(
    assertMaskIsSafe(ENRICHMENT_MASK, { allowEnterprise: true }),
    ENRICHMENT_MASK,
  );
});

test("the discovery mask contains no Enterprise field", () => {
  const enterprise = new Set([
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.regularOpeningHours",
  ]);
  for (const field of DISCOVERY_MASK) {
    assert.ok(
      !enterprise.has(field),
      `${field} would escalate discovery to Enterprise`,
    );
  }
});

test("the discovery mask carries the fields the solver needs", () => {
  // Without location there is nothing to solve over; without id there is
  // nothing to enrich later.
  for (const required of [
    "places.id",
    "places.location",
    "places.displayName",
    "places.primaryType",
  ]) {
    assert.ok(
      DISCOVERY_MASK.includes(required),
      `discovery mask is missing ${required}`,
    );
  }
});

test("the enrichment mask carries exactly the scarce fields", () => {
  for (const required of [
    "places.rating",
    "places.userRatingCount",
    "places.priceLevel",
    "places.regularOpeningHours",
  ]) {
    assert.ok(
      ENRICHMENT_MASK.includes(required),
      `enrichment mask is missing ${required}`,
    );
  }
});

// ── Place id handling ─────────────────────────────────────────────────────

test("strips the places/ resource prefix", () => {
  assert.equal(bareId("places/ChIJ123"), "ChIJ123");
});

test("leaves a bare id untouched", () => {
  assert.equal(bareId("ChIJ123"), "ChIJ123");
});

test("tolerates a missing id rather than returning the string undefined", () => {
  assert.equal(bareId(undefined), "");
  assert.equal(bareId(null), "");
});

// ── Matrix ceiling ────────────────────────────────────────────────────────

test("the matrix ceiling is Google's documented 625", () => {
  // This is a per-request limit and, at Essentials, effectively the monthly
  // allowance too — so the solver's design depends on it being accurate.
  assert.equal(MAX_MATRIX_ELEMENTS, 625);
});

test("625 is exactly 25x25", () => {
  assert.equal(25 * 25, MAX_MATRIX_ELEMENTS);
});
