#!/usr/bin/env bash
# Start the Next.js dev server with the same Infisical-backed values the
# production image bakes in at build time.
#
# Production bakes NEXT_PUBLIC_* via Docker build args (frontend/Dockerfile);
# the same values are injected here as process env, which is what Next reads.
# Working root is the frontend package, so the Infisical frontend project
# (.infisical.json -> 9541bd35-...) is selected automatically.
#
# There is no API to point at. `/api/*` are route handlers in this app, so dev
# and production serve the API from the same origin — which is the whole reason
# the backend no longer needs a process of its own here.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$repo_root/frontend"

# NEXT_PUBLIC_* come from the Infisical frontend project via .infisical.json.
export NEXT_PUBLIC_AUTH_URL="${NEXT_PUBLIC_AUTH_URL:-https://auth.shrijit.tech}"
# Absolute URLs for canonical tags, Open Graph and the sitemap. The dev server
# runs on a different origin than production, so without this every canonical
# on a locally-rendered page would point at production.
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

# Server-only keys, read at request time by src/server/env.ts. Each one is
# optional except MONGO_URI: a missing key degrades its own capability and is
# reported by /api/health rather than crashing the process.
export AUTH_URL="${AUTH_URL:-https://auth.shrijit.tech}"
: "${MONGO_URI:=mongodb://127.0.0.1:27017/triptribe_ai_local}"
export MONGO_URI

if command -v infisical >/dev/null 2>&1 && infisical export --silent >/dev/null 2>&1; then
  exec infisical run --env=prod --silent -- npm run dev
fi

echo "infisical CLI unavailable or not logged in; starting with local env only" >&2
exec npm run dev