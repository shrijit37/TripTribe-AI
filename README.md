# TripTribe

TripTribe is a travel itinerary generator web application. Users can enter their destination, budget, and trip duration to receive a personalized travel plan.

## Features

- User authentication (signup, login, logout) via the shared Better Auth service
- Personalized itinerary generation based on city, budget, and days
- One Next.js 16 application (App Router) serving the pages, the API and the
  SEO city pages from a single process — no second backend
- SEO city pages at `/best-places-to-visit-in-<city>`, server-rendered and
  marked up as ranked lists
- Trip hand-off: email the issued sheet, and re-plan a single day from the
  places already saved with the trip
- Google Places Autocomplete for city input
- MongoDB via the driver, behind a typed repository layer — no ODM

### How the itinerary is planned

`frontend/src/server/domain/solver/pipeline.ts` decides every fact in a plan;
the LLM only
narrates the finished plan and cannot change it. Stages: discover (Google
Places) → enrich (Place Details) → partition days by geography and quality →
schedule against real opening hours → refill a short day → cost the trip →
optionally re-verify legs against Google Routes.

Two facts about the Places API shape the pipeline:

- **Opening hours, ratings and price levels are Enterprise on every Places
  endpoint**, with no cheaper tier that returns them. Place Details is a GET
  per place id, so enrichment runs on a shortlist (roughly `days ×
  stopsPerDay × 2 + 8` sights, plus 12 meals) and never on the whole pool.
- **A place's `types` array is wider than the query that found it.** A
  `restaurant` or `cafe` search also returns `confectionery` and `tea_house`
  subtypes. Classification therefore runs over `FOOD_TYPES` (meals) and the
  solver checks those on every place, not only on the ones it asked for — a
  sweet shop classified as an attraction takes an activity slot and eats the
  day's pace.

If enrichment fails **in total** (the Place Details quota returning 429), the
pipeline retries once after a pause and then falls back to planning from
discovery alone: opening hours and ratings are absent, times become estimates,
and the plan is flagged `degraded: true` with a warning rather than silently
claiming an unverified venue. A *partial* enrichment failure is not retried —
enriching what came back is honest, and re-fetching the rest would make the
pool differ run to run, breaking reproducibility.

Pace is an activity budget. Meals ride along between activities (within
1400 m of their neighbours, at their nearest-to-ideal clock time) and never
take a slot; `assignMealRoles` names at most one stop per meal, so a meal in a
window whose slot is taken has no `role` and is still a meal.

## Prerequisites

- Node.js 24 (Active LTS) and npm
- Infisical CLI, logged in to the instance that owns the vault
  (`infisical login`; the CLI profile already points at `https://secrets.shrijit.tech/api`)
- A local MongoDB (only `scripts/dev-mongo.sh` needs it)

## Secrets: how Infisical is wired

Secrets live in Infisical, not in `.env` files. Two separate Infisical
projects are involved:

| Project | ID | Holds |
|---|---|---|
| `shrijit-esdk` (prod env) | `1a39a192-cf29-4ec9-812f-94c35cce34f2` | `TRIPTRIBE_MONGO_URI`, `TRIPTRIBE_OPENAI_KEY`, `TRIPTRIBE_GOOGLE_SEARCH_KEY` (plus `TRIPTRIBE_JWT_SECRET`, unused — see below) |
| frontend project | `9541bd35-aa6f-4719-b663-ec7ec99b8073` (`.infisical.json`) | `VITE_GOOGLE_PLACES_API_KEY`, `VITE_GOOGLE_CUSTOM_SEARCH_API_KEY` |

`.infisical.json` at the repo root pins only the frontend project; the CLI
picks it up automatically when run from `frontend/`. The other vault is
selected by `--projectId` instead, because the root `.infisical.json` would
otherwise shadow it.

### The name mapping

Production never passes raw vault key names to the app. The deploy job
(`.github/workflows/deploy.yml`) renames them when it writes the Dokploy app
env, and `scripts/infisical-env.sh` applies the same renames locally, so the
code reads identical variable names in both environments.

| Vault key | Env var the app reads | Read by |
|---|---|---|
| `TRIPTRIBE_MONGO_URI` | `MONGO_URI` | `frontend/src/server/db/mongo.ts` |
| `TRIPTRIBE_OPENAI_KEY` | `OPENAI_KEY` | `frontend/src/server/domain/narrate.ts` |
| `TRIPTRIBE_GOOGLE_SEARCH_KEY` | `GOOGLE_CUSTOM_SEARCH_API_KEY` | `frontend/src/app/api/plan/image/route.ts` |
| `TRIPTRIBE_GOOGLE_PLACES_API_KEY` | `GOOGLE_PLACES_API_KEY`, `GOOGLE_ROUTES_API_KEY` | `frontend/src/server/domain/places/` |
| `TRIPTRIBE_RESEND_API_KEY` | `RESEND_API_KEY` | `frontend/src/server/domain/mail.ts` |
| — (not a secret) | `AUTH_URL` — see below | `frontend/src/server/auth/session.ts` |
| `VITE_GOOGLE_PLACES_API_KEY` | `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | `frontend/src/lib/maps.ts` |

Secrets are injected as process env only — nothing is written to disk, and
no script echoes a secret value.

`TRIPTRIBE_JWT_SECRET` exists in the vault but nothing reads it: no code
references `JWT_SECRET`, and the deploy job never sets it. It is a leftover
from the pre-Better-Auth setup, when this app issued its own JWTs. It is safe
to remove from the vault.

## Local development

Two terminals, or run them in the background:

```bash
# 1. local MongoDB (data in ~/.local/share/triptribe-mongo)
./scripts/dev-mongo.sh

# 2. the app on :3000, env from both Infisical projects
./scripts/dev-frontend.sh
```

Then open http://localhost:3000. There is no second process: `/api/*` are route
handlers in this app, so dev and production are the same origin by construction.

```bash
cd frontend
npm test        # node --test, no API keys needed
npm run typecheck
npm run lint
npm run build
```

## SEO: the city pages

The pages at `/best-places-to-visit-in-<city>` exist to answer one query:
"best places to visit in X". They are server-rendered and prerendered at build
time from `INDEXED_CITIES` (`frontend/src/lib/seo.ts`), which is a curated
list — an unbounded generator would produce thousands of thin pages that
search engines are entitled to treat as doorway pages.

What each page emits, and why:

| Element | Reason |
|---|---|
| `<h1>Best Places to Visit in <City>` | the query itself, verbatim |
| `<ol>` of ranked places, in HTML | a reader who never loads CSS still gets the list in order |
| `ItemList` + `TouristAttraction` JSON-LD | matches the query, and carries the real ratings |
| `FAQPage` JSON-LD | the questions a reader actually types next |
| `BreadcrumbList` JSON-LD | the hierarchy from home to city |
| `alternates.canonical` | the flat keyword URL, so the canonical is what was searched |
| `sitemap.xml`, `robots.txt` | discovery; `/result`, `/api/` and `/health` are excluded |

Two constraints are worth knowing before changing this:

- **The flat URL is a rewrite.** Next only treats a route segment as dynamic
  when the *entire* segment is bracketed, so `app/best-places-to-visit-in/[city]`
  is the real route and `/best-places-to-visit-in-jaipur` is a rewrite onto it
  (`next.config.ts`). Making the directory literal breaks every city URL while
  the sitemap keeps advertising them.
- **The catalogue is cached upstream.** `GET /api/seo/city-catalogue`
  (`frontend/src/server/domain/catalogue.ts`) resolves the city, discovers places, and
  enriches *only the ones missing* from `placeCache` (Mongo, 90-day TTL).
  Rating, price level and opening hours are Enterprise-tier on every Places
  endpoint with a 1,000-call monthly allowance, so a crawler hitting these
  pages must not re-spend it.

### Why the database is local, not the vault one

`TRIPTRIBE_MONGO_URI` points at `mongo-override-redundant-firewall-1p7yfo:27017`,
a Dokploy swarm service name. It resolves only inside the prod swarm; from
this workstation the name does not resolve and the public port is closed.
Local runs therefore default to `mongodb://127.0.0.1:27017/triptribe_ai_local`
so prod data is never written from a dev machine. Pass `--vault-mongo` to
`scripts/infisical-env.sh` if you ever need the vault value verbatim (it
will not connect from here).

## Known local/prod differences

- **`AUTH_URL` is the same value everywhere now.** It used to be an internal
  swarm DNS name in prod (`http://app-copy-mobile-transmitter-zblo2d:8080`,
  a scratch application that did not exist) and the public URL locally. Both
  are now `https://auth.shrijit.tech`, which is the only value that works
  from inside the container.
- **Session cookie.** Auth is owned by `auth.shrijit.tech`, and the session
  cookie is set on `Domain=.shrijit.tech`. It will not be issued to
  `localhost`, so signed-in flows 401 locally (`{"message":"Not authorized,
  no session."}`) even though the SPA loads. Auth-gated routes in prod:
  `GET /api/users/profile`, `PUT /api/users/profile`, `GET /api/itenary/all`.
- **The AI provider is configurable, not hardcoded.** `src/server/domain/narrate.ts` reads
  `OPENAI_BASE_URL` and `OPENAI_MODEL`, falling back to OpenRouter and
  `google/gemini-2.0-flash-lite-001` when unset. It currently points at the
  gateway `https://gateway.shrijit.tech/v1` with model `big-pickle`, sourced
  from the vault as `TRIPTRIBE_OPENAI_BASE_URL` / `TRIPTRIBE_OPENAI_MODEL`.
  Any OpenAI-compatible endpoint works; switching provider is a vault edit
  plus a redeploy, with no code change. The narrator only writes descriptions
  for place ids the solver already chose — it cannot change the plan, so a
  model that wraps its output in prose degrades to un-narrated stops rather
  than breaking the route.
- **Google keys expire.** The Places key in the vault expired once already
  and silently broke autocomplete while everything else looked fine. Check
  the key with a Geocoding call before blaming the app; see Troubleshooting.
- **Frontend build-time values.** `NEXT_PUBLIC_*` are inlined into the client
  bundle by `frontend/Dockerfile` at CI build time, so changing one requires a
  rebuild. Both CI and local read the same Infisical frontend project
  (`9541bd35-…`), so local and prod agree; `NEXT_PUBLIC_AUTH_URL` and
  `NEXT_PUBLIC_SITE_URL` are non-secret build args set inline in `deploy.yml`
  and must be kept in step with `frontend/.env.example`.
  Every other key is read at request time, never at build time — a missing key
  must degrade its own capability, and a build-time ARG would freeze
  "missing" into the image.

## Deployment

See [DEPLOY.md](DEPLOY.md) for the procedure: the three CI jobs, the Dokploy
calls, the health contract and gate, the secret wiring, and every gate failure
this app has actually hit. `STATE.md` has the live topology.

In short: push to `main`. CI builds one multi-arch image
(`ghcr.io/shrijit37/triptribe-ai-web:<sha>`), re-asserts the Dokploy env
(Infisical's own sync wipes it), redeploys the one app, and waits for
`/api/health` to report **this** SHA as its `version` — health alone is not
enough, because the previous container keeps serving while the new one starts.

Every key comes from Infisical — none from GH secrets. GH secrets hold only the
deploy credentials (`INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`,
`DOKPLOY_API_KEY`, `GHCR_PULL_TOKEN`). If you add a key, add it to Infisical
and never to a GH secret: a duplicated key drifts, and a GH secret set but empty
bakes an empty value into the image.

## Troubleshooting

- **`infisical-env: export failed`** — run `infisical login`; the CLI profile
  must target the instance that owns the vault.
- **`/api/health` returns 503** — the database is down. Check
  `~/.local/share/triptribe-mongo/log/mongod.log`. The body also lists every
  capability as `up` / `missing` / `estimated` / `skipped` / `unavailable`, so
  a degraded key is visible without reading logs.
- **`/api/plan` answers `QUOTA_EXHAUSTED`** — the month's 1,000 Enterprise
  Places calls are spent. A plan costs roughly `days × stopsPerDay × 2 + 20`.
  This is deliberate: it refuses before spending, with copy that says so,
  rather than serving a plan scheduled without real opening hours.
- **Autocomplete attaches but shows no suggestions** — the Places key is
  dead, expired, or the Places API is off on its project. Check it directly:
  ```bash
  curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=London&key=$KEY" | jq -r .status
  ```
  `OK` is healthy; `REQUEST_DENIED` means expired or not activated.
  `gen_204 … ERR_BLOCKED_BY_CLIENT` in the console is an adblocker, harmless.
- **`auth.shrijit.tech` requests fail from localhost with a CORS error** —
  the auth service returns `access-control-allow-origin` for
  `https://triptribe.shrijit.tech` only, and none for `http://localhost:3000`.
  Add the local origin to the Better Auth trusted origins in that service;
  it cannot be worked around from this repo.

## License

MIT