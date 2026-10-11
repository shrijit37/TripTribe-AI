# STATE.md — TripTribe-AI (AI trip planner, Next.js + Express)

Last verified: 2026-10-11. Frontend migrated from a Vite SPA to Next.js 16
(App Router) with strict TypeScript; the backend is unchanged apart from the SEO
catalogue route. Both services answer the uniform `GET /health` contract.

## What it is
`backend` (Express 5 + Mongoose 9, :8080), `frontend` (Next.js 16 App Router,
strict TypeScript, standalone server, :3000). AI itinerary via OpenRouter, places
and routing via Google Places/Routes, signup/session via the shared Better Auth
service on `auth.shrijit.tech`, city autocomplete via Google Places.

## Why the frontend moved off Vite
The SPA shipped an empty `<div id="root">` to any crawler, so the site was
invisible to search — there was no page to rank for "best places to visit in X".
Server-rendering the city pages is the fix, and nothing in the backend needed
rewriting to get it. Four consequences will bite anyone changing this:

- **`src/pages/` is reserved by Next as the Pages Router.** The ported screens
  live in `src/screens/`. A component dropped into `src/pages/` is treated as a
  route, and the build fails on it having no provider context.
- **`/best-places-to-visit-in-jaipur` is a rewrite**, onto
  `app/best-places-to-visit-in/[city]`. Next only treats a segment as dynamic
  when the *whole* segment is bracketed; renaming that directory to the flat
  form silently makes it a literal route, and every city URL 404s while the
  sitemap keeps advertising them. This was hit during the migration. Verified
  afterwards: all 84 sitemap URLs return 200.
- **`output: standalone` does not copy `.next/static` or `public/`.** The
  Dockerfile copies both. Without those two lines every stylesheet and chunk
  404s and the site renders unstyled — no error, just a broken-looking page.
- **`react-router`'s `location.state` has no App Router equivalent.**
  `@/lib/nav.ts` parks the itinerary plan and the Hero's form seed in one-shot
  `sessionStorage` keys. Two components calling the *consuming* reader both get
  nothing: `Result` claims the plan once and passes it down to `HotelSection`.

## Production topology (Dokploy project `TripTribe-AI`, env `production`)
| Service | App | Public URL | Health |
|---|---|---|---|
| web | `triptribe-web-acbq9o` | https://triptribe.shrijit.tech | ok, assets:up |
| api | `triptribe-api-y59lny` | https://api.triptribe.shrijit.tech | ok, database:up |
| mongo | `mongo-override-redundant-firewall-1p7yfo` (mongo:9.0) | internal only | via api check |

Images: `ghcr.io/shrijit37/triptribe-ai-{api,web}:<sha>`, multi-arch, built on
GH Actions. Secrets from Infisical (`TRIPTRIBE_MONGO_URI`, vault
`infisical-prod` assigned to the TripTribe-AI env). The web image is a Node
server, not nginx: it produces HTML per request, so the static-file layer was
removed rather than kept in front of it. The nginx `proxy_pass` is now the
`rewrites()` rule in `next.config.ts`.

## Env split: why some values are `NEXT_PUBLIC_` and some are not
`NEXT_PUBLIC_*` is inlined into the client bundle at build time and is public.
Everything else stays on the server. `BACKEND_URL` and `CATALOGUE_API_URL` name
internal swarm DNS and **must not** be prefixed `NEXT_PUBLIC_` — that would
publish internal hostnames to anyone reading the bundle. Both are ARG/ENV in
`frontend/Dockerfile` and build args in `deploy.yml`.

## SEO: the city pages
`/best-places-to-visit-in-<city>` for the 81 cities in `frontend/src/lib/seo.ts`
(`INDEXED_CITIES`, curated and deduped), plus `/cities` as the internal-link
hub, `/sitemap.xml` and `/robots.txt`. Each city page emits `ItemList` +
`TouristAttraction` (carrying real ratings), `FAQPage` and `BreadcrumbList`
JSON-LD, and an `alternates.canonical` pointing at the flat keyword URL.
`/result`, `/search`, `/auth` and `/api/` are noindex — they render a private,
per-visitor response or a form.

Data comes from `GET /api/seo/city-catalogue` →
`backend/services/catalogue.js`, which enriches **only** the places missing
from `placeCache` (Mongo, 90-day TTL). That cache is load-bearing rather than
an optimisation: rating, price level and opening hours are Enterprise-tier on
every Places endpoint against a 1,000-call monthly allowance, and a crawler
hitting these pages repeatedly would exhaust it.

**The catalogue must be populated for these pages to rank.** With the Places
daily quota spent they still render and stay crawlable, but they carry no place
list — a thin page. Restore quota and request a few city pages to warm the
cache; the first render per city is the one that spends the Enterprise calls.

## Web → api addressing
`BACKEND_URL` / `CATALOGUE_API_URL` are baked at build time to the internal
swarm DNS name (`http://triptribe-api-y59lny:8080`). The public-URL hairpin
from inside a container proved unreliable (flapping 502/timeouts, verified
2026-10-09). App names are stable; if the api app is recreated with a new
suffix, update `deploy.yml` and this file.

## Needs owner keys (app boots degraded without them)
| Infisical key | Powers |
|---|---|
| `TRIPTRIBE_OPENAI_KEY` (placeholder) | itinerary narration (`/api/itenary`) |
| `TRIPTRIBE_GOOGLE_SEARCH_KEY` (placeholder) | city images |
| `TRIPTRIBE_GOOGLE_PLACES_API_KEY` | place discovery, enrichment, and every SEO city page |
| `TRIBE_FIREBASE_*` (7 keys, unset) | email signup |

Without the Places key the solver reports "not configured" at request time and
the city pages fall back to their no-data state; the app still boots. Without
the OpenRouter key the backend boots (lazy client in `gptResponse.js`) and
itinerary generation fails at request time. To activate: add the keys to
Infisical (and GH secrets for `TRIBE_*`), re-run the workflow — no code change.

## Deliberately removed / kept
- Removed the Vite toolchain, `react-router`, `react-helmet`, `axios`, and the
  RTK Query slices against the retired Firebase backend. `react-helmet` is
  replaced by the Next Metadata API at each route.
- Removed `frontend/nginx.conf`: server-rendered HTML plus a Node runtime needs
  no static-file proxy in front of it, and its `/health` contract is preserved
  verbatim as a Next route handler so the deploy gate's grep still matches.
- Kept the MongoDB (Postgres rewrite out of scope — the app is Mongoose
  throughout) and kept React 19 rather than revisiting the 18→19 cascade.
- Fixed along the way: the dev proxy used to strip `/api` while Express mounts
  `/api/*`, so every dev API call 404'd; `MEAL_TYPES` omitted the food subtypes
  (`confectionery`, `tea_house`) that a `restaurant` query also returns, which
  let sweet shops be partitioned as day activities; and both `compose.js` and
  the live smoke classified meals by `stop.role != null` rather than by the
  place, so a meal landing between two clock windows was filed under
  Activities.