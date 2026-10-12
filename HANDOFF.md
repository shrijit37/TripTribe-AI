# HANDOFF — Maps fallback (429 → prewarm snapshot)

Date: 2026-10-12 · Branch state: **uncommitted working tree** (conservative git
profile — nothing was committed or pushed) · Verification: `npm run typecheck`
clean, `npm run lint` clean (1 pre-existing warning), **161/161 tests pass**.

Plan of record: [`MAPS-FALLBACK-PLAN.md`](MAPS-FALLBACK-PLAN.md).
All six plan phases are implemented; every phase bead is closed.

## Why

Google Places (New) caps this project at **100 `searchNearby` + 100 `getPlace`
per day** (measured 2026-10-12, project 1024136789335) — ~5–10 plans/day, not
the 1,000/month the old model assumed. Production symptom:
`POST /api/plan` → `500 {"error":"Places places:searchNearby failed: 429"}`.

## What shipped

**1. Honest 429s (bead 9ve, P0 closed).**
`domain/places/client.ts` now has `requestError(what, status, detail)`: status
429 → `PlanError("QUOTA_EXHAUSTED")`, anything else stays `PlacesRequestError`.
Both `get()` and `post()` go through it, and `enrichPlaces` **rethrows** a quota
failure instead of silently degrading a half-built plan. Consumers already map
`QUOTA_EXHAUSTED` → 503 (`http/errors.ts failFrom`), including the previously
blanket-`catch`ing SEO route (`app/api/seo/city-catalogue/route.ts`).

**2. Daily quota model (bead 5uz, P0 closed).**
`domain/places/quota.ts`: `DAILY_DISCOVERY_ALLOWANCE = 100` /
`DAILY_ENRICHMENT_ALLOWANCE = 100`, `PlanCost {discovery: 4, enrichment:
days*stopsPerDay*2+20}`, `quotaShortfall` checks **both axes**.
`db/repositories/usage.ts` gained `dayKey()` (UTC `YYYY-MM-DD` buckets:
`places-discovery:<day>`, `places-enrichment:<day>`). Copy in `generate.ts` and
`errors.ts` now says "today … reopens tomorrow".

**3. Scraper adapter (bead qo4, P1 closed).**
`domain/places/scraper.ts` — feature-off unless `SCRAPER_BASE_URL` is set:
- `parseCsv` (RFC4180, no dependency), `csvIndex`, `csvRowToEnriched`
  (same `EnrichedPlace` shape as the Google path, bayesian parity).
- Mapping notes that matter: gosom's **`status` column is NOT business status**
  (it holds a nightly rate for hotels, an editorial blurb for restaurants) —
  deliberately unmapped. `open_hours` JSON → Google `{periods:[…]}` (open
  inherits closer's meridiem: "4–11 pm" → 16:00–23:00, "Closed" dropped).
  `price_range` "$20–30" → band 1–4, absent → null (`clampBand` → moderate).
  `timezone` IANA → `utcOffsetMinutes` via `Intl`.
- `submitScrape` / `waitForScrape` (3 s poll) / `downloadScrape`.
- `type FetchInit = NonNullable<Parameters<typeof globalThis.fetch>[1]>` —
  naming `RequestInit` trips eslint `no-undef` (same as `auth/session.ts:28`).

**4. Fallback + prewarm (bead gr1, P1 closed).**
- `domain/places/fallback.ts`: snapshot docs `prewarm:<citySlug>` in
  `placecaches`, `{at, sights[], meals[], lodging[]}` (ordered ids), **7-day
  TTL**; `readPrewarmPlaces` hydrates via existing `readMany`; `isQuotaError`
  duck-types `.code`.
- `solver/pipeline.ts`: discovery+enrich wrapped in try/catch — on quota error,
  serve `snapshot.sights ∪ meals ∪ lodging` (hydrated, already enriched) with a
  visible warning; no snapshot → honest refusal. (`resolveCity` is **not**
  wrapped: cold cities fail honestly — deliberate.)
- `domain/catalogue.ts`: same pattern for the SEO city pages, falling back to
  `snapshot.sights`.
- `app/api/internal/prewarm/route.ts`: `POST`, bearer `INTERNAL_PREWARM_TOKEN`
  (**refuses everything if the token is unset**), one Google `resolveCity` per
  city, three scrape pools (sights/meals/lodging keywords, zoom 15, radius
  5 km, depth 5), `writeMany` + `writePrewarm`. Per-city try/catch; partial
  results are reported, not fatal.
- `.github/workflows/prewarm.yml`: weekly Sun 03:15 UTC + `workflow_dispatch`
  with optional `cities` JSON; fails only on non-2xx (config error), never on
  per-city `ok:false`.

**5. Deploy config (bead 0fm, P2 closed).**
- `google-maps-scraper-kit/docker-compose.yml`: image **digest-pinned**
  `gosom/google-maps-scraper@sha256:e205c029…` (v1.18.1) — the adapter parses a
  payload shape, so `latest` is a silent-breakage vector. Local map 18080→8080.
- `DEPLOY.md`: dependency-table row for the sidecar — **internal only, no
  public ingress**, plus the `SCRAPER_BASE_URL`/`INTERNAL_PREWARM_TOKEN` pair.
- `STATE.md`: budget section rewritten from the stale "1,000-call monthly
  allowance" to the measured dual-100/day model + fallback description.

**6. Tests (bead gf3, P2 closed).** `scraper.test.ts` (6: CSV quoting, price
bands incl. the =30 boundary, periods/mask, tz→−360, fixture hotel row parity,
key completeness) + `quota-translation.test.ts` (3: 429→`QUOTA_EXHAUSTED`,
500→`PlacesRequestError` contrast, `isQuotaError` duck-typing). Fixture:
`frontend/test/fixtures/gosom-run1.csv` (real 22-row capture).

Env keys added (`env.ts` union + spec): `SCRAPER_BASE_URL`,
`SCRAPER_TIMEOUT_MS` (120000), `INTERNAL_PREWARM_TOKEN`.

## Do not miss — manual operator steps (NOT done)

1. **Create the Dokploy sidecar app** from `google-maps-scraper-kit/` —
   nothing in this repo provisions it. Internal network only.
2. **Set secrets**: web app `SCRAPER_BASE_URL` (internal sidecar URL) and
   `INTERNAL_PREWARM_TOKEN` (same value as the GH Actions secret). Until both
   exist: fallback is inert (safe), prewarm cron fails its config check.
3. **Seed the first snapshot** before relying on the fallback:
   `curl -X POST $WEB_URL/api/internal/prewarm -H "Authorization: Bearer $TOKEN"`
   (or run the workflow manually).
4. Optional, cheaper than all of this: **raise the two quotas in the GCP
   console** — the council's verdict was that this is a config ceiling, not a
   cost ceiling.

## Verification commands

```bash
cd frontend && npm run typecheck && npm run lint && npm test   # expect 161/161
# spike/sidecar locally:
cd google-maps-scraper-kit && docker compose up -d   # see kit README notes in DEPLOY.md
SCRAPER_BASE_URL=http://localhost:18080 python3 scripts/spike-maps-scraper.py \
  --lat 30.2672 --lon -97.7431 --keyword lodging --depth 10
```

## Open beads

| Bead | What it is |
|---|---|
| `TripTribe-AI-4a1` (new) | ToS exposure: scraping Google Maps likely violates their terms — **accepted knowingly**, fires only on 429 + weekly prewarm. Decide whether that exposure is OK long-term. |
| `TripTribe-AI-e88` (P1) | Original Places 90-day-cache vs 30-day-terms question — **still open**, comment added clarifying scraper rows are outside Places terms and snapshots have a 7-day TTL. |
| `TripTribe-AI-6if` (P2) | Discovery burns `searchNearby` (capped) while uncapped `searchText` path exists unused — deliberately untouched. |

## Known risks / cuts made

- **E2E against live Google (plan Phase 5's blank-key scenario) was not run** —
  it needs a deployed sidecar + prewarm + a forced 429. Unit coverage is in
  place; the end-to-end story depends on the manual steps above.
- The prewarm route's `PrewarmBody` carries an extra `city` field past
  `writePrewarm`'s type (structural, harmless) — if you tighten that type,
  strip `city` at the call site.
- Snapshot serving trusts `placecaches` freshness within 7 days; a bad prewarm
  run writes bad-but-fresh data (no schema validation of scraper rows beyond
  `placeId`+`name` presence).
- `waitForScrape` polls forever until `SCRAPER_TIMEOUT_MS` aborts the fetch —
  a wedged sidecar holds a prewarm step, not a user request (never inline).
- Nothing in this tree is committed. Proposed: one commit for the fallback,
  then `bd dolt push`. Ask before running either.
