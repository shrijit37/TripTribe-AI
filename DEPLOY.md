# Deployment — TripTribe-AI (production, Dokploy)

One deployable. The Express backend was merged into the Next.js app, so there is
one image, one Dokploy application, one health endpoint, one env block. Anything
below that says "two" is history.

## The rule

Push to `main`. Nothing else.

`ci` → `build` → `deploy-prod`, in `.github/workflows/deploy.yml`:

1. **`ci`** — `npm ci --ignore-scripts`, `typecheck`, `lint`, `test`, `build` in
   `frontend/`. Node 24. 15-minute timeout. The suite needs no API keys, so it
   runs on every PR.
2. **`build`** — only on `push` to `refs/heads/main`. Multi-arch
   (`linux/amd64,linux/arm64`) image pushed as
   `ghcr.io/shrijit37/triptribe-ai-web:${{ github.sha }}`. Before the build it
   reads the browser Places key from Doppler (`platform`/`prd`, key
   `TRIPTRIBE_VITE_GOOGLE_PLACES_API_KEY`, distinct from the server key) with
   `doppler secrets get … --plain --silent` so the Places autocomplete key is a
   build arg rather than a GH secret.
3. **`deploy-prod`** — `application.saveEnvironment`, then
   `application.saveDockerProvider` pointing at the SHA image, then
   **`application.redeploy`** (not `application.deploy`), then the gate below.

There is no manual prod build path: the image is built only on GH Actions
(`docker/build-push-action@v6` with `push: true`), so a workstation can build
the app for local use but can never produce the artefact production runs.

> **Deviation from the fleet standard:** the last call is
> `application.redeploy`, not `application.deploy`. This repo does what it
> does; do not "correct" the workflow to match another repo's convention.

## The deployed apps

| App | Image | Public domain | Port | Notes |
|---|---|---|---|---|
| web — Dokploy application `triptribe-web-acbq9o` (`STATE.md`), id `yRIyjllOO4I_vHy2tKkmr` (`DOKPLOY_WEB_APP_ID`, issue `TripTribe-AI-usl`) | `ghcr.io/shrijit37/triptribe-ai-web:<full commit sha>` | https://triptribe.shrijit.tech | `80` — `PORT=80` in both `frontend/Dockerfile` and the Dokploy env | Pages, `/api/*` route handlers and the SEO city pages all come from this one container |

| Dependency | Managed by | Public domain | Notes |
|---|---|---|---|
| MongoDB (`MONGO_URI` → swarm service, see README) | not this repo | none | An external cluster; nothing here deploys it. `/api/health` returns 503 when it is unreachable. |
| Better Auth (`AUTH_URL`) | a separate service | https://auth.shrijit.tech | Owns the session cookie on `Domain=.shrijit.tech`. Nothing here deploys it. |
| `google-maps-scraper` sidecar (`SCRAPER_BASE_URL` → internal URL) | Dokploy, from `google-maps-scraper-kit/docker-compose.yml` (digest-pinned) | none — internal only | Runs the scrape fallback behind `POST /api/internal/prewarm`. No public ingress: it must never be reachable from the internet. Web app also needs `INTERNAL_PREWARM_TOKEN` set to the same bearer the cron sends. |

Data services get no public domain because they are never routed by Dokploy
through this app — there is no proxy to them in this repo's config.

The container listens on **80, not 3000**, deliberately (`frontend/Dockerfile`):
this app is routed to the port its Dokploy application was created with, which
was nginx's 80. It has shipped 502 on every request otherwise.

## Health

`GET /api/health` →

```json
{
  "status": "ok" | "degraded",
  "service": "triptribe-web",
  "version": "<APP_VERSION, or \"unknown\">",
  "checks": { "assets": "up", "mongo": "up", "places": "up", "routes": "up",
              "openai": "up", "resend": "up", "auth": "up" }
}
```

- **200** when Mongo is reachable, **503** when it is not. `status` is `ok` or
  `degraded`; `degraded` is a legitimate healthy state for an app built to run
  with keys missing and is **not** down.
- The app never calls `process.exit(1)` — it answers 503 and stays up so health
  can report the failure instead of the orchestrator reporting a crash-loop.

Route: `frontend/src/app/health/route.ts`.
`frontend/src/app/api/health/route.ts` is a one-line re-export of the same
handler, so `/api/health` is the real route and `/health` is the alias.

| `checks` key | Probes | Non-`up` value |
|---|---|---|
| `assets` | Nothing — static assets baked into the image | — |
| `mongo` | `ping()` in `src/server/db/mongo.ts` | `down` (the 503) |
| `places` | `degradedCapabilities()` → `GOOGLE_PLACES_API_KEY` | `missing` → solver returns `PLACES_NOT_CONFIGURED` |
| `routes` | `GOOGLE_ROUTES_API_KEY` | `estimated` → geodesic times instead of computed |
| `openai` | `OPENAI_KEY` | `skipped` → narration skipped, plan still complete |
| `resend` | `RESEND_API_KEY` | `unavailable` → email hand-off explains itself |
| `auth` | `AUTH_URL` | `default` → falls back to `https://auth.shrijit.tech` |

`/health` exists only because the health path is configured **outside** this
repo (Dokploy's application healthcheck, and whatever monitors the container).
Renaming it here breaks a setting nobody in this repo can see.

### The gate

```
GET ${{ vars.WEB_URL }}/api/health          →  https://triptribe.shrijit.tech/api/health
matcher:  grep -q "\"version\":\"$SHA"       (this run's full commit SHA)
budget:   30 attempts, sleep 10, curl --max-time 10   (~5 min)
```

`status` is deliberately not matched. `"version"` is: the previous container
keeps serving while the new one starts, so a health-only poll passes against the
build being replaced. That is how the frontend migration once shipped a green
run while the web app was 502-ing — the old nginx container answered `/health`,
then died, and nothing noticed.

## Secrets

Every app key comes from Doppler. **No app key is a GH secret.** A duplicated
key drifts, and a GH secret set-but-empty bakes an empty value into the image.

One Doppler config (README):

| Config | Scope | Holds |
|---|---|---|
| `platform` / `prd` | workspace `deployment`, one flat namespace shared with the rest of the fleet, keys prefixed per app (this app's under `TRIPTRIBE_`) | `TRIPTRIBE_MONGO_URI`, `TRIPTRIBE_OPENAI_*`, `TRIPTRIBE_GOOGLE_PLACES_API_KEY`, `TRIPTRIBE_GOOGLE_SEARCH_KEY`, `TRIPTRIBE_VITE_GOOGLE_PLACES_API_KEY` (browser key, build arg), `TRIPTRIBE_JWT_SECRET` (dead) |

Doppler key → env var the app reads (the deploy job renames on write;
`scripts/vault-env.sh` applies the same renames locally):

| Doppler key | App env var | Read by |
|---|---|---|
| `TRIPTRIBE_MONGO_URI` | `MONGO_URI` | `src/server/db/mongo.ts` (only required key) |
| `TRIPTRIBE_OPENAI_KEY` | `OPENAI_KEY` | `src/server/domain/narrate.ts` |
| `TRIPTRIBE_OPENAI_BASE_URL` / `_MODEL` | `OPENAI_BASE_URL` / `OPENAI_MODEL` | `src/server/domain/narrate.ts` |
| `TRIPTRIBE_GOOGLE_PLACES_API_KEY` | `GOOGLE_PLACES_API_KEY` **and** `GOOGLE_ROUTES_API_KEY` | `src/server/domain/places/` |
| `TRIPTRIBE_GOOGLE_SEARCH_KEY` | `GOOGLE_CUSTOM_SEARCH_API_KEY` | `src/app/api/plan/image/route.ts` |
| — (not written) | `RESEND_API_KEY` / `RESEND_FROM` | `src/server/domain/mail.ts`, which degrades without them |
| `TRIPTRIBE_VITE_GOOGLE_PLACES_API_KEY` | `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` (build arg, **literal value**) | `src/lib/maps.ts` |
| — (not a secret) | `AUTH_URL`, `PORT`, `APP_VERSION` | written literally by the deploy job |

**How values reach the container.** Two paths, and conflating them is the bug
this doc exists to prevent:

- **Server-side keys: values, read from Doppler by the deploy job.** The job
  runs `doppler secrets download --no-file --format json --silent` against
  `platform`/`prd` with a read-only, config-scoped service token
  (`DOPPLER_TOKEN` — see the table below), keeps only the `TRIPTRIBE_` keys out
  of a config shared with eight other products, builds the env block out of
  those values with `printf`, and POSTs *resolved values* to
  `application.saveEnvironment`. Before the POST it refuses to continue if any
  value the template needs is empty — an empty value means the config does not
  have the key, and overwriting the app env with a hole is how a
  healthy-looking container ends up unable to reach its database.
- **The Places autocomplete key: a literal value, inlined at build time.** It
  is exported to the `build` job's environment from the same `platform`/`prd`
  config, under `TRIPTRIBE_VITE_GOOGLE_PLACES_API_KEY`, and interpolated into
  `build-args: NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=${{ env.VITE_GOOGLE_PLACES_API_KEY }}`.
  Why: `NEXT_PUBLIC_*` is inlined into the client bundle by
  `frontend/Dockerfile` at build time, so it cannot be read from the container's
  env at all.

**Vault references do not work here, and that is worth knowing.** The deploy
job writes resolved values; it never leaves an env line as a literal
`${{vault.doppler-prod.<KEY>}}` reference for Dokploy to resolve. Both ways that
approached a reference failed before the Doppler cutover, under the old
`infisical-prod` provider, and the mechanism `doppler-prod` exposes today is the
same one:

- Dokploy aborts at `Initializing deployment` with
  `Infisical: secret "TRIPTRIBE_RESEND_API_KEY" not found in environment "prod"`
  when a reference cannot be resolved. The deployment never starts, the old
  container keeps serving, and the workflow still reports three successful
  calls — three deploys in a row behaved exactly this way (`395b1df`,
  `522c265`, `7a4de4c`).
- When the references *do* resolve, they still reach the container verbatim:
  a rolled container held `MONGO_URI=${vault.infisical-prod.TRIPTRIBE_MONGO_URI}}`
  as its value and answered `checks.mongo: "down"`.

So: **write values, not references.** Check with
`docker inspect` (or `/proc/1/environ` in the container) that a key is the
value, not a string containing `${vault`.

Every server-side key is read at request time inside the container, so a missing
key degrades only its own capability. A build-time ARG would freeze "missing"
into the image.

### Rotating a key

- **Server-side key** (Mongo, OpenAI, Places/Routes, Search): edit it in
  `platform`/`prd`, then make CI re-assert the env. `application.saveEnvironment`
  is re-run on every push to `main` and re-asserts the whole block rather than
  a diff — the vault provider's own sync wipes the app env, which is why the
  step exists. To rotate without shipping code, apply the same block by hand
  through the Dokploy UI or `application.saveEnvironment` and redeploy; the next
  push re-derives the identical block from Doppler.
- **`TRIPTRIBE_VITE_GOOGLE_PLACES_API_KEY`**: same edit, but it is a build arg, so
  it needs an image rebuild. Push (or re-run) a build; a bare env re-assert is
  not enough.
- **`AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `PORT`, `APP_VERSION`**: set inline in
  `.github/workflows/deploy.yml` / `frontend/Dockerfile`. Keep them in step with
  `frontend/.env.example`.
`TRIPTRIBE_JWT_SECRET` exists in Doppler and nothing reads it — leftover from
the pre-Better-Auth setup. Safe to remove.

**Infisical service tokens to retire (history).** The Doppler cutover removed
the `Infisical/secrets-action@v1.0.18` wiring and the `INFISICAL_ESDK_TOKEN`
secret from the workflows, but the tokens that wiring used still exist in
Infisical until that provider is decommissioned. Several read-only
`shrijit-esdk` prod tokens named `github-actions-deploy-prod` and `probe-parse`
were minted on 2026-10-12 while it was built, and the CLI has no list-or-revoke
command, so they have to be removed through the Infisical UI (project → Service
Tokens). Delete them all — nothing in CI reads that project any more.

## Repo configuration

Settings (Settings → Secrets and variables → Actions). These are deploy
credentials, not app secrets.

| `DOPPLER_TOKEN` | secret | read-only, config-scoped Doppler service token (project `platform`, config `prd`), used by both the `build` and `deploy-prod` fetches. Replaced `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` / `INFISICAL_ESDK_TOKEN`, all retired with the migration. |
| `DOKPLOY_API_KEY` | secret | `x-api-key` on all three Dokploy calls |
| `GHCR_PULL_TOKEN` | secret | Dokploy pulling from GHCR — **long-lived**, never `GITHUB_TOKEN`, which expires after the job and silently breaks every later pull |
| `DOKPLOY_URL` | variable | base for `/api/application.*` |
| `DOKPLOY_WEB_APP_ID` | variable | the one application id (`yRIyjllOO4I_vHy2tKkmr`, per issue `TripTribe-AI-usl`) |
| `WEB_URL` | variable | `https://triptribe.shrijit.tech` — the gate's base URL |

Values for the three variables are **not recorded in this repo** except the app
id; read them from the repo's Actions variables.

### `workflow_dispatch` — read this before relying on it

`on.workflow_dispatch` exists, but `build` is gated on
`if: github.ref == 'refs/heads/main' && github.event_name == 'push'`. A manual
dispatch therefore runs **`ci` only** — `build` and `deploy-prod` are skipped,
and nothing ships.

To re-deploy an already-built SHA, **re-run the original push run** (event name
stays `push`) rather than dispatching by hand.

## When the gate fails

| Symptom | Cause |
|---|---|
| Every Dokploy call reports success, the health gate fails, and no new container exists | The deployment aborted at `Initializing deployment` — read `deployment.readLogs` for the application. `Infisical: secret "X" not found in environment "prod"` means the app env named a key the provider did not have; the old container keeps serving and the run still looks green. This is what `395b1df`, `522c265` and `7a4de4c` all were. Resolved by the Doppler cutover: the job writes resolved values, so no reference is left for Dokploy to fail on. |
| `/api/health` answers, but `checks.mongo: "down"` | The container holds a literal `${vault.doppler-prod.…}` string instead of a URI. Write values, not references — see *How values reach the container*. The one real occurrence was Infisical-era and was resolved by the Doppler cutover. |
| `deploy-prod` fails at *Fetch app keys* with `403 ProjectMembershipNotFound` | History, resolved by the Doppler cutover. The old identity authenticated against an Infisical project it was deliberately not a member of (`INFISICAL_CLIENT_ID` was not in `shrijit-esdk`, so the `build` job could not read every other product's secrets). Both jobs now fetch with the single `DOPPLER_TOKEN`, so there is no per-project membership left to get wrong. |
| `services did not converge on $SHA`, while `/health` answers 200 with a stale `version` | `saveDockerProvider` returned 200 without applying. Real occurrence (`TripTribe-AI-usl`, cutover `395b1df`, run `38171315352`): image pushed, digest `sha256:a4fd85d5…`, both Dokploy calls "successful", container never rolled. `/health` returned the *old* shape `{"status":"ok","service":"triptribe-web","version":"081534e8…","checks":{"assets":"up"}}` and `/api/health` returned Express's `Cannot GET /api/health` — proof the previous image was still live. Production stayed on the last good image and the gate failed loudly instead of reporting a false green. |
| Old image, but `/api/health` 404s with `Cannot GET /api/health` | Same condition seen from the other side: the retired Express backend is still fronting `/api/*` through the old `rewrites()` rule. `api.triptribe.shrijit.tech` is deliberately no longer deployed; its hostname stops resolving once the old web image is replaced. |
| Every request 502s, `/api/health` never answers | The container bound Next's default 3000 while Dokploy routed to 80. `frontend/Dockerfile` sets `PORT=80` and `HOSTNAME=0.0.0.0` for exactly this reason. |
| Page loads but is unstyled, every stylesheet 404s | `output: standalone` does not copy `.next/static` or `public/`. The Dockerfile has both `COPY` lines; without them there is no error, just a broken-looking page. |
| `/api/health` returns 503 with `checks.mongo: "down"` | Mongo unreachable. `status` becomes `degraded`; nothing else works. |
| Autocomplete attaches but returns no suggestions, everything else looks fine | The Places key expired. It has already happened once. Check it directly: `curl -s "https://maps.googleapis.com/maps/api/geocode/json?address=London&key=$KEY" \| jq -r .status` → `OK` healthy, `REQUEST_DENIED` expired or not activated. `gen_204 … ERR_BLOCKED_BY_CLIENT` in the console is an adblocker — harmless. |
| Dokploy redeploy fails to pull | `GHCR_PULL_TOKEN` expired, or `GITHUB_TOKEN` was used instead. It must be a long-lived classic PAT with `read:packages`. |
| A capability silently wrong in production but fine locally | `NEXT_PUBLIC_*` changed in Doppler without an image rebuild, or a `NEXT_PUBLIC_*` build arg in `deploy.yml` drifted from `frontend/.env.example`. They are inlined at build time; everything else is read at request time. |
| `AUTH_URL` points at an internal swarm name, every authenticated request 401s | `AUTH_URL` must be `https://auth.shrijit.tech`. It used to be `http://app-copy-mobile-transmitter-zblo2d:8080` — a scratch application that did not exist — while the image separately baked `BACKEND_URL=http://triptribe-api-y59lny:8080`. One process makes that class of mismatch structurally impossible. |

## What goes in git (and what never does)

In git:

- `.github/workflows/deploy.yml`, `frontend/Dockerfile`, `docker-compose.yaml`
- `frontend/.env.example` — placeholders only (`your_google_places_api_key_here`)
- `STATE.md` (live topology), `README.md` (secrets wiring), this file

Never in git:

- any Doppler value, `.env`, or exported secret file
- the Dokploy API key or the GHCR pull token — GH secrets only
- `MONGO_URI` in any form; local runs default to
  `mongodb://127.0.0.1:27017/triptribe_ai_local` so prod data is never written
  from a dev machine (`--vault-mongo` exists for reading the raw value and will
  not connect off the swarm)

No script echoes a secret value, and secrets are injected as process env only —
nothing is written to disk.