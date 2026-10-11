# TripTribe

TripTribe is a travel itinerary generator web application. Users can enter their destination, budget, and trip duration to receive a personalized travel plan.

## Features

- User authentication (signup, login, logout) via the shared Better Auth service
- Personalized itinerary generation based on city, budget, and days
- Server-rendered Next.js 16 frontend (App Router) at the root of `frontend/`
- SEO city pages at `/best-places-to-visit-in-<city>`, server-rendered and
  marked up as ranked lists
- Backend API built with Express.js and MongoDB
- Google Places Autocomplete for city input

### How the itinerary is planned

`backend/solver/pipeline.js` decides every fact in a plan; the LLM only
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
picks it up automatically when run from `frontend/`. The backend vault is
selected by `--projectId` instead, because the root `.infisical.json` would
otherwise shadow it.

### The name mapping

Production never passes raw vault key names to the app. The deploy job
(`.github/workflows/deploy.yml`) renames them when it writes the Dokploy app
env, and `scripts/infisical-env.sh` applies the same renames locally, so the
code reads identical variable names in both environments.

| Vault key | Env var the app reads | Read by |
|---|---|---|
| `TRIPTRIBE_MONGO_URI` | `MONGO_URI` | `backend/config/db.js` |
| `TRIPTRIBE_OPENAI_KEY` | `OPENAI_KEY` | `backend/controllers/gptResponse.js` |
| `TRIPTRIBE_GOOGLE_SEARCH_KEY` | `GOOGLE_CUSTOM_SEARCH_API_KEY` | `backend/routes/itenaryRoute.js` |
| — (not a secret) | `AUTH_URL` — **value differs, see below** | `backend/middleware/authenticate.js` |
| `VITE_GOOGLE_PLACES_API_KEY` | `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` | `frontend/src/lib/maps.ts` |

Secrets are injected as process env only — nothing is written to disk, and
no script echoes a secret value.

`TRIPTRIBE_JWT_SECRET` exists in the vault but nothing reads it: no backend
code references `JWT_SECRET`, and the deploy job never sets it. It is a
leftover from the pre-Better-Auth setup, when this app issued its own JWTs.
`backend/.env.example` and `docker-compose.yaml` still list `JWT_SECRET` for
the same historical reason; the local scripts do not set it.

## Local development

Three terminals, or run them in the background:

```bash
# 1. local MongoDB (data in ~/.local/share/triptribe-mongo)
./scripts/dev-mongo.sh

# 2. backend on :8080, env from the Infisical vault
./scripts/dev-backend.sh          # nodemon; --no-watch for a single run

# 3. frontend on :3000, NEXT_PUBLIC_* from the frontend Infisical project
./scripts/dev-frontend.sh
```

Then open http://localhost:3000.

The Next.js dev server proxies `/api` to `http://localhost:8080`
(`frontend/next.config.ts` `rewrites()`), so the app runs same-origin in dev
exactly as it does in production.

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
  (`backend/services/catalogue.js`) resolves the city, discovers places, and
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

- **`AUTH_URL` reaches the same service by a different name.** Prod sets
  `AUTH_URL=http://app-copy-mobile-transmitter-zblo2d:8080`, an internal swarm
  DNS name that resolves only inside the swarm. Locally the script defaults
  to `https://auth.shrijit.tech` — the public URL of that same service, and
  the value `authenticate.js` already falls back to when `AUTH_URL` is
  unset. Same backend, different network path; the app only calls
  `/api/auth/get-session` on it.
- **Session cookie.** Auth is owned by `auth.shrijit.tech`, and the session
  cookie is set on `Domain=.shrijit.tech`. It will not be issued to
  `localhost`, so signed-in flows 401 locally (`{"message":"Not authorized,
  no session."}`) even though the SPA loads. Auth-gated routes in prod:
  `GET /api/users/profile`, `PUT /api/users/profile`, `GET /api/itenary/all`.
- **The AI provider is configurable, not hardcoded.** `gptResponse.js` reads
  `OPENAI_BASE_URL` and `OPENAI_MODEL`, falling back to OpenRouter and
  `google/gemini-2.0-flash-lite-001` when unset. It currently points at the
  gateway `https://gateway.shrijit.tech/v1` with model `big-pickle`, sourced
  from the vault as `TRIPTRIBE_OPENAI_BASE_URL` / `TRIPTRIBE_OPENAI_MODEL`.
  Any OpenAI-compatible endpoint works; switching provider is a vault edit
  plus a redeploy, with no code change. `POST /api/itenary` needs a JSON
  itinerary back, so a model that wraps output in prose will fail to parse.
- **Google keys expire.** The Places key in the vault expired once already
  and silently broke autocomplete while everything else looked fine. Check
  the key with a Geocoding call before blaming the app; see Troubleshooting.
- **Frontend build-time values.** `NEXT_PUBLIC_*` are inlined into the client
  bundle by `frontend/Dockerfile` at CI build time, so changing a key requires
  a rebuild. Both CI and local read the same Infisical frontend project
  (`9541bd35-…`), so local and prod agree; `NEXT_PUBLIC_ITENARY_API_URL`,
  `NEXT_PUBLIC_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` are non-secret build args
  set inline in `deploy.yml` and must be kept in step with
  `frontend/.env.example`. `BACKEND_URL` and `CATALOGUE_API_URL` are
  server-only and must never be prefixed `NEXT_PUBLIC_` — they name internal
  addresses that would otherwise be published in the bundle.

## Deployment

Push to `main`: CI lints and builds both packages, builds multi-arch images
to `ghcr.io/shrijit37/triptribe-ai-{api,web}:<sha>`, then the deploy job
re-asserts the Dokploy env (Infisical's own sync wipes it) and redeploys both
apps. See `STATE.md` for the live topology.

Every key comes from Infisical — none from GH secrets. The `build` job pulls
the frontend project with `Infisical/secrets-action` using the
`INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` machine identity, and the
backend's keys reach Dokploy through the vault's own sync. GH secrets hold
only the deploy credentials (`DOKPLOY_*`, `GHCR_PULL_TOKEN`). If you add a
key, add it to Infisical and never to a GH secret: a duplicated key drifts,
and a GH secret set but empty bakes an empty value into the image.

## Troubleshooting

- **`infisical-env: export failed`** — run `infisical login`; the CLI profile
  must target the instance that owns the vault.
- **`/health` returns 503** — the database is down. Check
  `~/.local/share/triptribe-mongo/log/mongod.log`.
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