# Frontend (Next.js 16 App Router) — standalone server, no nginx.
#
# The SPA this replaces was a static bundle behind nginx. Server-rendered city
# pages changed that: the SEO surface is HTML produced per request, so there is
# nothing static to serve, and nginx would only add a hop between the crawler
# and the HTML.
#
# Built on GH Actions, never on the server. Node 24 = Active LTS.
FROM node:24-bookworm-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
# `--ignore-scripts` because the production image runs no install hooks.
RUN npm ci --ignore-scripts

FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
# NEXT_PUBLIC_AUTH_URL is the shared Better Auth service that issues the
# .shrijit.tech session cookie (src/lib/auth-client.ts).
# NEXT_PUBLIC_GOOGLE_PLACES_API_KEY powers the city autocomplete.
# BACKEND_URL and CATALOGUE_API_URL stay server-only: they name internal
# addresses that must never reach the browser.
ARG NEXT_PUBLIC_ITENARY_API_URL=/api/itenary
ARG NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=
ARG NEXT_PUBLIC_AUTH_URL=https://auth.shrijit.tech
ARG NEXT_PUBLIC_SITE_URL=https://triptribe.shrijit.tech
# Internal swarm DNS (no public hairpin: container egress to the public IP is
# unreliable). App names are stable; if the api app is ever recreated, update
# this + STATE.md.
ARG BACKEND_URL=http://backend:8080
ARG CATALOGUE_API_URL=http://backend:8080/api/seo/city-catalogue
ARG APP_VERSION=unknown

ENV NEXT_PUBLIC_ITENARY_API_URL=$NEXT_PUBLIC_ITENARY_API_URL \
    NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=$NEXT_PUBLIC_GOOGLE_PLACES_API_KEY \
    NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    BACKEND_URL=$BACKEND_URL \
    CATALOGUE_API_URL=$CATALOGUE_API_URL

RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

# Re-declared here, not inherited: an ARG is scoped to the stage that declares
# it. Without this the ENV below expands to an empty string and `/health`
# reports `version: ""` instead of the commit sha.
ARG APP_VERSION=unknown
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    APP_VERSION=$APP_VERSION

# `output: standalone` produces a server plus a pruned node_modules, but
# deliberately does NOT copy `.next/static` or `public/` — Next expects the
# deploy target to place them. Without these two copies every stylesheet and
# chunk 404s and the page renders unstyled, which is exactly what happens if
# they are forgotten.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]