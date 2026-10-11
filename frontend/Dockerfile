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

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so
# they are fixed here and nowhere else.
# NEXT_PUBLIC_AUTH_URL is the shared Better Auth service that issues the
# .shrijit.tech session cookie (src/lib/auth-client.ts).
# NEXT_PUBLIC_GOOGLE_PLACES_API_KEY powers the city autocomplete.
#
# There is no NEXT_PUBLIC_ITENARY_API_URL any more, and no BACKEND_URL or
# CATALOGUE_API_URL. All three named an address that no longer exists: the API
# routes are in this image, so the browser calls this same origin, and the
# server calls `buildCityCatalogue` in-process instead of over HTTP.
ARG NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=
ARG NEXT_PUBLIC_AUTH_URL=https://auth.shrijit.tech
ARG NEXT_PUBLIC_SITE_URL=https://triptribe.shrijit.tech

ENV NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=$NEXT_PUBLIC_GOOGLE_PLACES_API_KEY \
    NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# The server-only keys are read at request time, never at build time, so they
# are not declared here: a missing key must degrade the capability it belongs
# to, and a build-time ARG would freeze "missing" into the image.
RUN npm run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

# Binds 80, not Next's default 3000, and deliberately so: this app is routed by
# Dokploy to the port its application was created with, which was nginx's. When
# the frontend moved from a static nginx bundle to a Node server, listening on
# 3000 meant Dokploy kept routing to 80 and every request 502'd while the old
# container was gone. Serving on 80 keeps the deployment contract identical to
# what the app has always been configured for.
ARG APP_VERSION=unknown
ENV NODE_ENV=production \
    PORT=80 \
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

EXPOSE 80
CMD ["node", "server.js"]