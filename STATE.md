# STATE.md — TripTribe-AI (AI trip planner, MERN)

Last verified: 2026-10-09, CI run 37930253590 green, both prod
services serving the uniform `GET /health` contract.

## What it is
MERN: `backend` (Express 5 + Mongoose 9, :8080), `frontend` (Vite 8 +
React 18 SPA on nginx, :80). AI itinerary via OpenRouter, city images
via Google Custom Search, email signup via Firebase, maps autocomplete
via Google Places.

## Production topology (Dokploy project `TripTribe-AI`, env `production`)
| Service | App | Public URL | Health |
|---|---|---|---|
| web | `triptribe-web-acbq9o` | https://triptribe.shrijit.tech | ok, assets:up |
| api | `triptribe-api-y59lny` | https://api.triptribe.shrijit.tech | ok, database:up |
| mongo | `mongo-override-redundant-firewall-1p7yfo` (mongo:8.0) | internal only | via api check |

Images: `ghcr.io/shrijit37/triptribe-ai-{api,web}:<sha>`,
multi-arch, built on GH Actions. Secrets from Infisical
(`TRIPTRIBE_MONGO_URI`, `TRIPTRIBE_JWT_SECRET`, vault `infisical-prod`
assigned to the TripTribe-AI env). Old idle compose (never deployed)
deleted 2026-10-09. `triptribe.shrijit.tech` DNS moved off Vercel
(CNAME) to A 130.210.29.215. Stale `triptribe-ai.shrijit.tech` A
record left untouched (nothing serves it).

## Web → api proxying
nginx `proxy_pass` uses **internal swarm DNS**
(`http://triptribe-api-y59lny:8080`), baked at build time. The public
URL hairpin (`https://api.triptribe.shrijit.tech` from inside the web
container) proved unreliable (flapping 502/timeouts, verified
2026-10-09). App names are stable; if the api app is ever recreated
with a new suffix, update `BACKEND_URL` in `deploy.yml` and rebuild.

## Needs owner keys (app boots degraded without them)
| Infisical key | Powers | CI secret (build-arg) |
|---|---|---|
| `TRIPTRIBE_OPENAI_KEY` (placeholder) | AI itinerary (`/api/itenary`) | — (runtime env) |
| `TRIPTRIBE_GOOGLE_SEARCH_KEY` (placeholder) | city images | — (runtime env) |
| `TRIBE_FIREBASE_*` (7 keys, unset) | email signup | GH secrets `TRIBE_FIREBASE_*` → baked at build |
| `TRIBE_GOOGLE_PLACES_API_KEY` (unset) | maps autocomplete | GH secret, baked at build |
| `TRIBE_EMAIL_VERIFICATION_API_URL` (unset) | pre-signup email check | GH secret, baked at build |

Without Firebase keys the SPA still boots (defensive init in
`FirebaseConfig.js`); signup shows "auth not configured". Without the
OpenRouter key the backend still boots (lazy client in
`gptResponse.js`); itinerary generation fails at request time. To
activate: add the keys (Infisical for backend, GH secrets for `TRIBE_*`
frontend), re-run the workflow — no code change needed.

## Deliberately removed / kept
- Removed `@vercel/analytics` + `@vercel/speed-insights`: Vite 8
  (rolldown) hard-fails the build on them
  (`__vite-optional-peer-dep:react` MISSING_EXPORT, even at v2.x);
  they only report to Vercel and do nothing on Dokploy.
- Removed unused backend deps: `bcrypt` (native; code uses pure-JS
  `bcryptjs`), `multer`, `express-formidable`, `concurrently`;
  `nodemon` moved to devDependencies (`start` = `node`).
- Kept React 18 (19 migration cascades through helmet/spring; revisit
  separately), kept MongoDB (Postgres rewrite out of scope — app is
  Mongoose throughout).
- Fixed along the way: vite dev proxy stripped `/api` while the
  backend mounts `/api/*` (dev 404s; rewrite removed), 9 lint errors
  (unused vars), `triptribe-ai.shrijit.tech` record ignored.
