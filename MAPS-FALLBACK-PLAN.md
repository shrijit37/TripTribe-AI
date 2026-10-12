# Maps fallback plan — gosom/google-maps-scraper as 429 fallback

Status: **decided, not started** — 2026-10-12. Spike evidence: bead `TripTribe-AI-mzt`
(conditional GO: all 11 `EnrichedPlace` columns present, `place_id` set byte-stable
across two runs, but `open_hours`/`price_range` empty on every row and 45–55s/job).

## Decisions (confirmed)

1. **Role: fallback on 429.** Google Places stays the only online path. The
   scraper feeds a prewarm cache; when Google answers 429, we serve from that
   cache and answer honestly when it is cold.
2. **Scope includes the P0 beads** — `9ve` (429→500) and `5uz` (monthly→daily
   quota model). The fallback hangs off exactly these code paths.
3. **Empty `open_hours`/`price_range` are a blocker** — Phase 0 resolves them
   before any migration code lands.
4. **Production shape: Dokploy sidecar.** A second Dokploy app runs the scraper;
   the web app talks to it over the internal network.

## Non-goals

- No inline scraping anywhere: every scraper call is prewarm/background
  (`PLACES_TIMEOUT_MS=15s` budget makes 45–55s jobs impossible inline).
- No arbitrary-city geocoding fallback in v1: `resolveCity` stays Google-only.
  A plan for a city with no prewarm snapshot gets the honest
  `QUOTA_EXHAUSTED` 503 (same as today post-9ve).
- No queue/broker infrastructure: cron-driven prewarm endpoint, that's all.
- `priceLevel` stays null-tolerant (`cost.ts:101` and `regenerate.ts:237`
  already clamp/handle null).

---

## Phase 0 — unblock the two empty columns (spike, no product code)

Probe why `open_hours` (`{}` on 22/22) and `price_range` (0/22) are empty:

1. Read gosom v1.18.1's job schema + OpenAPI (`http://localhost:18080/api/docs`,
   local kit on :18080) for params that force detail fetching (zoom levels,
   `fast_mode` already false).
2. Re-run the spike probe (`scripts/spike-maps-scraper.py`) with each candidate
   param; inspect raw CSV.

**Acceptance:** `open_hours` populated on ≥80% of lodging rows and convertible
to the Google `periods` shape (`schedule.ts:88` reads
`{periods: [{open: {day,hour,minute}, close: {hour,minute}}]}`).
`price_range`: record what Google itself returns for lodging — if Google is
equally sparse, accept null and say so.

**If hours are unpopulatable:** stop and re-open the decision with the user
(scheduling quality degrades: `parseOpeningHours` → null windows).

## Phase 1 — the two P0 fixes (land first, independently green)

### 1a. Bead `9ve`: upstream 429 must become `QUOTA_EXHAUSTED` 503

- `domain/places/client.ts` already throws `PlacesRequestError` with
  `status`. Add one exported translator
  `translatePlacesError(err): PipelineError | null` that maps `status === 429`
  → `PipelineError("QUOTA_EXHAUSTED", …honest daily copy…)`.
- Apply at every consumer: `domain/solver/pipeline.ts` (searchNearby ×3
  around 329–352, enrichPlaces 367, resolveCity 323) and
  `domain/catalogue.ts:149–177`.
- `http/errors.ts:32` already maps `QUOTA_EXHAUSTED` → 503; nothing else moves.

### 1b. Bead `5uz`: daily quota model matching the measured caps

Measured: `SearchNearbyRequestPerDayPerProject` = 100/day and
`GetPlaceRequestPerDayPerProject` = 100/day (project 1024136789335).

- `db/repositories/usage.ts`: add `dayKey(kind, at)` beside `monthKey`.
- `domain/places/quota.ts`: replace `MONTHLY_PLACES_ALLOWANCE` with two daily
  budgets — `DAILY_DISCOVERY_ALLOWANCE = 100`, `DAILY_ENRICHMENT_ALLOWANCE =
  100`. Split `projectPlanCost` into its discovery part (3–4 calls) and
  enrichment part (`days × stopsPerDay`); projection stays conservative.
- `domain/plan/generate.ts:110` keeps its shape — quota check before spend.
- Copy changes from "this month" to "today" (resets midnight UTC).

Tests: `quota.test.ts` — dual counters, day rollover, projection shortfall.
`errors.test.ts` — 429 → `QUOTA_EXHAUSTED`.

## Phase 2 — the scraper adapter (code, feature-flagged off)

**New file `frontend/src/server/domain/places/scraper.ts`** (~150 lines):

- Env: `SCRAPER_BASE_URL` (optional — unset means the whole feature is off,
  registered in `env.ts`), `SCRAPER_TIMEOUT_MS` (default `120000`, prewarm
  only).
- `submitJob({lat, lon, keyword, depth, radius})` → `jobId`, `pollJob(jobId)`,
  `downloadCsv(jobId)` — same HTTP contract the spike already proved
  (`POST /api/v1/jobs`, `GET /api/v1/jobs/{id}`, `/download`).
- Tiny RFC4180 CSV parser (quoted commas/escapes) — gosom's CSV is simple, no
  dependency added; unit-tested against a captured real download
  (fixture from the spike: `/tmp/run1.csv` → `frontend/test/fixtures/`).
- `csvRowToEnriched(row): EnrichedPlace` — the proven column mapping:
  - `place_id` → `placeId`/`id`; `title` → `name`; `category` →
    `primaryTypeName` (primaryType stays null — no Google type slug);
    `latitude`/`longitude` → `location`;
    `review_rating` → `rating`; `review_count` → `reviewCount`; compute
    `bayesianRating` with the same formula as `client.ts:226`;
    `address` → `address`; `thumbnail` → `photoName` (bonus, null-tolerant).
  - `timezone` (IANA, e.g. `America/Chicago`) → `utcOffsetMinutes` via
    `Intl.DateTimeFormat` offset resolution.
  - `open_hours` → Google `periods` shape expected by
    `schedule.ts:88` (Phase 0 must confirm the raw format first).
  - `price_range` (`"$"`) → `priceLevel` enum when present, else null.
- Rows are de-duplicated with the existing `dedupe` semantics (set-based —
  order is not stable across runs, proven by the spike).

**No changes to `db/repositories/placeCache.ts`** — it already stores any
`EnrichedPlace`.

## Phase 3 — fallback path + prewarm

**New `domain/places/fallback.ts`:** snapshot read/write in the existing
`placeCache` collection, `_id: prewarm:<citySlug>`, shape
`{ placeIds: string[], at: string }`, TTL 7 days (scraper freshness, not the
Places 90-day rule).

**Call sites** (the only two that exist):

- `domain/catalogue.ts:buildCityCatalogue` — wrap discovery+enrich; on
  translated `QUOTA_EXHAUSTED`: serve the prewarm snapshot's cached
  `EnrichedPlace`s when present, else rethrow the honest 503.
- `domain/solver/pipeline.ts` plan path — same wrap for the catalogue-driven
  discovery; `resolveCity` is NOT wrapped (non-goal).

**Prewarm: guarded internal route** `POST /api/internal/prewarm` (token:
  `INTERNAL_PREWARM_TOKEN` env), which:

1. Takes `{ city, slug, lat, lon }` (or a built-in list for SEO cities).
2. Runs one scraper job per keyword (map `CATALOGUE_TYPES` groups → keywords
   `lodging`, `restaurants`, `attractions` …).
3. `csvRowToEnriched` → `writeMany` + writes the `prewarm:<slug>` snapshot.

Triggered by a weekly GitHub Action cron (`.github/workflows/`), not by user
traffic. Server code has the DB and env; no new runtime.

## Phase 4 — sidecar deployment

- `google-maps-scraper-kit/docker-compose.yml` becomes the reference; pin the
  image to **`gosom/google-maps-scraper:v1.18.1`** (kit currently floats
  `latest`).
- New Dokploy app `triptribe-scraper`: that image, `/gmapsdata` volume,
  healthcheck `GET /api/v1/jobs`, **no public ingress** — internal network
  only.
- Web app secret: `SCRAPER_BASE_URL` → internal sidecar URL. Absent → feature
  off, zero behaviour change.
- Document both in `DEPLOY.md` + `STATE.md` (topology table gains a row, env
  table gains two keys).

## Phase 5 — verification & bookkeeping

- Unit: CSV parser fixtures, `csvRowToEnriched` (tz conversion, hours shape,
  price mapping, bayesian parity with `normalisePlace`), quota rollover,
  429 translation, snapshot fallback.
- Contract (skips when `SCRAPER_BASE_URL` unset): reuse
  `scripts/spike-maps-scraper.py` against the sidecar.
- End-to-end: blank `GOOGLE_PLACES_API_KEY`, prewarm a test city, generate a
  plan → served from snapshot; delete the snapshot → honest 503.
- Beads: close `9ve`, `5uz`, `mzt` (after Phase 0 acceptance); open one bead
  per phase 2–4 unit; extend `e88` with a note that scraper-sourced cache is
  outside the Places 30-day rule but keeps the 7-day snapshot TTL; add a
  standing bead for the ToS exposure (scraping Google Maps likely violates
  their terms — accepted knowingly in the fallback role: only fires on 429 +
  weekly prewarm).

## Order

`0 → 1 (a∥b) → 2 → 3 → 4 → 5`. Phase 0 is the only phase that can stop the
whole plan. Phase 1 ships value alone (honest errors + correct quota) even if
the scraper never ships.
