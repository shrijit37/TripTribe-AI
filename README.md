# TripTribe

TripTribe is a travel itinerary generator web application. Users can enter their destination, budget, and trip duration to receive a personalized travel plan.

## Features

- User authentication (signup, login, logout) via the shared Better Auth service
- Personalized itinerary generation based on city, budget, and days
- Responsive frontend built with React and Vite
- Backend API built with Express.js and MongoDB
- Google Places Autocomplete for city input

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
| `VITE_GOOGLE_PLACES_API_KEY` | same name | `frontend/src/services/GlobalApi.jsx`, `src/main.jsx` |

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

# 3. frontend on :5173, VITE_* from the frontend Infisical project
./scripts/dev-frontend.sh
```

Then open http://localhost:5173.

The Vite dev server proxies `/api` to `http://localhost:8080`
(`frontend/vite.config.js`), mirroring the nginx `proxy_pass` in production,
so the app runs same-origin in dev exactly as it does behind prod nginx.

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
- **The AI key is still a placeholder.** `TRIPTRIBE_OPENAI_KEY` remains
  `REPLACE_ME_*` in the vault, so `POST /api/itenary` returns 500 and
  `/api/itenary/city-image`-backed AI features fail at request time. The
  backend boots anyway (the OpenAI client is built lazily) and
  `/api/itenary/city-image` works — it uses `TRIPTRIBE_GOOGLE_SEARCH_KEY`,
  which now holds a real key.
- **Google keys expire.** The Places key in the vault expired once already
  and silently broke autocomplete while everything else looked fine. Check
  the key with a Geocoding call before blaming the app; see Troubleshooting.
- **Frontend build-time values.** `VITE_*` are baked into the bundle by
  `frontend/Dockerfile` at CI build time, so changing a key requires a
  rebuild. Both CI and local read the same Infisical frontend project
  (`9541bd35-…`), so local and prod agree; `VITE_AUTH_API_URL` and
  `VITE_ITENARY_API_URL` are non-secret build args set inline in
  `deploy.yml` and must be kept in step with `frontend/.env.example`.

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
  `https://triptribe.shrijit.tech` only, and none for `http://localhost:5173`.
  Add the local origin to the Better Auth trusted origins in that service;
  it cannot be worked around from this repo.

## License

MIT