#!/usr/bin/env bash
# Start the Next.js dev server with the same Infisical-backed NEXT_PUBLIC_*
# values the production image bakes in at build time.
#
# Production bakes NEXT_PUBLIC_* via Docker build args (frontend/Dockerfile);
# the same values are injected here as process env, which is what Next reads.
# Working root is the frontend package, so the Infisical frontend project
# (.infisical.json -> 9541bd35-...) is selected automatically.
#
# The dev proxy (frontend/next.config.ts `rewrites()`) forwards /api to
# localhost:8080, matching production, which forwards it to the api service.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$repo_root/frontend"

# NEXT_PUBLIC_* come from the Infisical frontend project via .infisical.json.
# These keep the prod values: same-origin /api/* paths, proxied in dev exactly
# as production proxies them.
export NEXT_PUBLIC_ITENARY_API_URL="${NEXT_PUBLIC_ITENARY_API_URL:-/api/itenary}"
export NEXT_PUBLIC_AUTH_URL="${NEXT_PUBLIC_AUTH_URL:-https://auth.shrijit.tech}"
# Server-only: the catalogue and API targets name the backend from the server,
# never from the browser.
export BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
export CATALOGUE_API_URL="${CATALOGUE_API_URL:-http://localhost:8080/api/seo/city-catalogue}"
# Absolute URLs for canonical tags, Open Graph and the sitemap. The dev server
# runs on a different origin than production, so without this every canonical
# on a locally-rendered page would point at production.
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

if command -v infisical >/dev/null 2>&1 && infisical export --silent >/dev/null 2>&1; then
  exec infisical run --env=prod --silent -- npm run dev
fi

echo "infisical CLI unavailable or not logged in; starting with local env only" >&2
exec npm run dev