# STATE.md — TripTribe-AI (AI trip planner, Next.js 16)

Last verified: 2026-10-11. **The backend has been merged into the frontend.**
There is now one service: a Next.js 16 App Router application with strict
TypeScript that serves the pages, the API and the city pages from a single
process and a single image. The Express service, the Mongoose layer and the
second container are gone.

## What it is
`frontend/` — Next.js 16 App Router, strict TypeScript, `output: standalone`,
listening on :80. Route handlers under `src/app/api/` replace every Express
route. Planning is deterministic (`src/server/domain/solver`), narration is
optional (`src/server/domain/narrate.ts`), places and routing come from Google
Places/Routes, signup and session from the shared Better Auth service on
`auth.shrijit.tech`.

## The one-image topology
| Service | App | Public URL | Health |
|---|---|---|---|
| web | `triptribe-web-acbq9o` | https://triptribe.shrijit.tech | `GET /api/health` |

Image: `ghcr.io/shrijit37/triptribe-ai-web:<sha>`, multi-arch, built on GH
Actions. Secrets from Infisical: `shrijit-esdk` prod (`1a39a192-…`) for the
app's own keys (`TRIPTRIBE_MONGO_URI`, `TRIPTRIBE_OPENAI_*`,
`TRIPTRIBE_GOOGLE_*`), the frontend project for the build-time
`VITE_GOOGLE_PLACES_API_KEY`. The deploy job reads the vault and posts
**values**; `${{vault.infisical-prod.…}}` references do not reach the container
and a reference Dokploy cannot resolve aborts the deployment at
`Initializing deployment` while every API call still reports success
(`TripTribe-AI-usl`).

The app's own keys are fetched with a read-only `shrijit-esdk` prod service
token (`INFISICAL_ESDK_TOKEN`), not with the build job's `INFISICAL_CLIENT_ID`,
which is deliberately not a member of that project — see `DEPLOY.md`.

Two services used to exist, and having two is what caused most of the
operational defects this change set out to fix:

- **The API Dockerfile was unbootable.** `backend/Dockerfile` copied
  `index.js`, `config/`, `controllers/`, `models/`, `routes/` and
  `middleware/` — and silently omitted `services/` and `solver/`, which
  `index.js` imports at startup. The container started, died on its first
  import, and served nothing. The compose healthcheck probed the *frontend's*
  `/`, so the stack read as healthy while the API was gone.
- **The two env contracts disagreed.** The image baked
  `BACKEND_URL=http://triptribe-api-y59lny:8080`; the deploy step set
  `AUTH_URL=http://app-copy-mobile-transmitter-zblo2d:8080`. The session lookup
  resolved to a scratch application that did not exist, so no authenticated
  request could find a session.

Both are now structurally impossible: one image, one environment block, one
origin.

## Addressing: there is none
`NEXT_PUBLIC_ITENARY_API_URL`, `BACKEND_URL` and `CATALOGUE_API_URL` are all
gone, along with the `rewrites()` rule that used to forward `/api/*` to
`BACKEND_URL`. The browser calls this same origin, and the SEO city pages call
`buildCityCatalogue` in-process (`src/lib/catalogue.ts`) rather than over HTTP.

What remains in `NEXT_PUBLIC_*` is only what the *browser* genuinely needs and
what is genuinely public: the Better Auth URL and the Places autocomplete key.

## Needs owner keys (the app boots degraded without them)
| Key | Missing means |
|---|---|
| `MONGO_URI` | `/api/health` returns 503. Nothing else works. |
| `TRIPTRIBE_GOOGLE_PLACES_API_KEY` | Planning returns `PLACES_NOT_CONFIGURED` (503); SEO city pages fall back to their no-data state |
| `TRIPTRIBE_GOOGLE_PLACES_API_KEY` (as routes) | Travel times are estimated by distance instead of computed |
| `TRIPTRIBE_OPENAI_KEY` | Narration is skipped. The plan is complete; it just has no written descriptions |
| `TRIPTRIBE_GOOGLE_SEARCH_KEY` | City hero images fall back to a placeholder |
| `TRIPTRIBE_RESEND_API_KEY` | The email hand-off answers "not available right now" |

"Degraded" is a legitimate healthy state for this app, and `/api/health`
distinguishes it from "down" by returning 200 either way and naming every
capability in `checks`. The app never calls `process.exit(1)` — a request that
cannot reach the database returns 503 and says so, and the container stays up
so health can report the failure instead of the orchestrator reporting a
crash-loop.

## Budget: two daily Places caps, with a scraper fallback
Google's real ceiling (measured 2026-10-12, project 1024136789335) is per-day
and per-metric: `SearchNearbyRequestPerDayPerProject` = 100/day and
`GetPlaceRequestPerDayPerProject` = 100/day. A plan costs 4 discovery calls
+ `days × stopsPerDay × 2 + 20` enrichment calls.

- **`src/server/domain/places/quota.ts` refuses before it spends.** Two
  counters (`places-discovery:<UTC day>`, `places-enrichment:<UTC day>` in the
  `usage` collection) are checked against the 100/day budget on each axis;
  a shortfall is answered `QUOTA_EXHAUSTED` (503) with honest copy that says
  the allowance reopens tomorrow — instead of serving a plan scheduled without
  real opening hours.
- **An upstream 429 is also `QUOTA_EXHAUSTED`, never an opaque 500.**
  `domain/places/client.ts` maps the Google 429 to the same code, and
  `enrichPlaces` rethrows instead of silently degrading a half-built plan.
- **Fallback: the scraper snapshot.** `POST /api/internal/prewarm` (weekly
  GitHub Action, bearer `INTERNAL_PREWARM_TOKEN`) scrapes each curated city
  through the self-hosted `gosom/google-maps-scraper` sidecar
  (`SCRAPER_BASE_URL`), writes places to `placecaches` and records ordered ids
  under `prewarm:<city slug>` (7-day TTL). On a quota hit the solver and the
  city-catalogue route serve that snapshot instead of failing; with no fresh
  snapshot they still refuse honestly. Never inline: a scrape takes 45–55 s.
- **`src/server/domain/plan/generate.ts` caches the composed plan for 24 h**,
  keyed on a hash of the whole request. A repeat costs nothing.
- **Rate limits** (`src/server/http/rateLimit.ts`): 5 plans/hour signed out,
  20/hour signed in; 1 email/hour signed out. The old API had none, so one
  client could burn the day's budget for everyone.

**Collection names — verified, not assumed** (was
[TripTribe-AI-0gt](bd:TripTribe-AI-0gt)). `src/server/db/mongo.ts` pins
`users`, `itenaries`, `placecaches`, `usage` and `planCache`. Those are the old
Mongoose defaults, which is what created the first three. Four of the five are
proven against production by their traffic, not by a name listing:

| Evidence | Collection |
|---|---|
| `POST /api/plan` returned `tripUuid`, and `POST /api/trips/<uuid>/regenerate` read the same document back signed out | `itenaries` |
| `GET /api/seo/city-catalogue` returned byte-identical payloads on the second call, and a fresh city returned 18 entries | `placecaches` |
| `GET /api/plan/image` counted 30 of 40 concurrent callers and refused the rest; the next call was still refused | `usage` |
| A repeat plan returned `cached: true` | `planCache` |

`users` is the one name no anonymous request touches: it is written only by
`getOrCreate` behind a member session, so it is verified by the Mongoose model
name that created it, not by live traffic.

`db.getCollectionNames()` was **not** run. There is no mongo client on the
workstation, no exec into the Dokploy swarm, and the managed mongo resource
`FmuJZjdpAy5J5QqJoqN06` publishes no external port — opening one to the public
internet to satisfy a curiosity was declined. If production ever does report a
different name, the app will appear to work while saving nothing, so the check
is worth doing from a host that can reach the port.

## SEO: the city pages
`/best-places-to-visit-in-<city>` for the 81 cities in `src/lib/seo.ts`
(`INDEXED_CITIES`), plus `/cities` as the internal-link hub, `/sitemap.xml` and
`/robots.txt`. Each city page emits `ItemList` + `TouristAttraction` (real
ratings only — an invented `aggregateRating` is a fabricated review count, which
is exactly what structured data policies exist to prevent), `FAQPage` and
`BreadcrumbList` JSON-LD, and an `alternates.canonical` pointing at the flat
keyword URL. `/result`, `/search`, `/auth` and `/api/` are noindex.

Data comes from `buildCityCatalogue`, which enriches **only** the places missing
from `placecaches` (Mongo, 30-day retention per the Places terms — bead e88). That cache is load-bearing, not an
optimisation: a crawler hitting these pages repeatedly would otherwise exhaust
the monthly Enterprise allowance.

## Things that will bite anyone changing this
- **`src/pages/` is reserved** by Next as the Pages Router. Ported screens live
  in `src/screens/`. A component dropped into `src/pages/` becomes a route.
- **`/best-places-to-visit-in-jaipur` is a rewrite** onto
  `app/best-places-to-visit-in/[city]`. Next only treats a segment as dynamic
  when the *whole* segment is bracketed.
- **`output: standalone` does not copy `.next/static` or `public/`.** The
  Dockerfile copies both. Without those two lines every stylesheet 404s and the
  site renders unstyled — no error, just a broken-looking page.
- **`react-router`'s `location.state` has no App Router equivalent.**
  `src/lib/nav.ts` parks the plan in a one-shot `sessionStorage` key. Two
  components calling the consuming reader both get nothing — `Result` claims the
  plan once and passes it down. `reactStrictMode` invokes the claiming effect
  twice, which is why the claim is latched.
- **Identity comes from the Better Auth session only.** `POST /api/plan` used
  to save a trip under whatever email the request body carried, so anyone could
  write into any account by typing its address. The body's `email` is delivery
  address and nothing else.
- **A valid session is not membership.** TripTribe is an org on a *shared* auth
  service, so `ensureMember()` in `src/server/auth/session.ts` is what turns
  "has a session on auth.shrijit.tech" into "may use TripTribe". It checks
  `/api/orgs/triptribe/member` and self-joins on first visit. It returns false
  when the auth hub is unreachable or the org is unseeded, so an outage locks
  people out rather than letting anyone in — the right direction to fail for an
  access check. Watch for this when touching auth: it was added to the Express
  middleware only, and the merge would have dropped it silently.

## Data model
Collections keep their old names so existing rows still read; no migration was
performed.

| Collection | Was | Notes |
|---|---|---|
| `users` | `users` | `recentSearch` is now a capped list of pointers (`{tripId, cityName, at}`), not embedded itineraries |
| `itenaries` | `itenaries` | One document per plan: `uuid`, `city`, `itenary`, plus `userId`, `days`, `budget`, `currency`, `travellers`, `pace`, `placesSnapshot` + `snapshotAt` (30-day re-plan window, bead e88) |
| `placecaches` | `placecaches` | 30-day retention, stale rows deleted on read |
| `usage` | new | Monthly and hourly counters for the Places allowance and the rate limits |
| `planCache` | new | 24 h composed plans by request hash |

## Deliberately kept
- MongoDB, not Postgres. Renaming the misspelled `itenaries` collection is a
  data migration with a backfill, and it does not belong in a cutover.
- The solver algorithms ported verbatim. Nothing about sequencing, partitioning,
  scheduling or costing was redesigned; only the bugs were fixed.

## Fixed along the way
Every one of these was a live defect, not a hypothetical:
- `enrichPlaces([])` returned `[]` instead of `{places, failures}`, so a city
  with no meal shortlist threw a `TypeError` and answered 500.
- The cost was hardcoded to `en-IN` and `INR` regardless of the request.
- `gptResponse.js` read `travellers`, `pace`, `interests`, `originCity`,
  `startDate` and `travelMode` off the request body and then forwarded
  `headcount=2`, `stopsPerDay=4` and `WALK`. The form collected all six; the
  solver received none.
- `lib/api.ts` read `body.message`; every endpoint returns `{error, details}`.
  Every failure rendered as "Itinerary request failed".
- `GET /api/itenary/proxy-image?url=` fetched any URL with no checks — an open
  SSRF proxy. It is now https-only, host-allowlisted, and rejects resolved
  private-range IPs.
- `mealsCost` read `list[0]` — one venue's price for every meal in the plan.
- `lodgingCost` read `lodgingFound[0]`.
- `compose.js` imported from `pipeline.js`, so the orchestrator could not be
  imported without the composer.
- Two divergent copies of `haversineMeters`, one of which threw on null input.
- `CORS origin:true` with `credentials:true` reflected any origin.
- `docker-compose.yaml` was missing `GOOGLE_PLACES_API_KEY` entirely.