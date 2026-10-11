#!/usr/bin/env bash
# Start the Vite dev server with the same Infisical-backed VITE_* values the
# production image bakes in at build time.
#
# Production bakes VITE_* via Docker build args (frontend/Dockerfile); the
# same values are injected here as process env, which is exactly what Vite
# reads from .env files. Working root is the frontend package, so the
# Infisical frontend project (.infisical.json -> 9541bd35-...) is selected
# automatically.
#
# The dev proxy (frontend/vite.config.js) forwards /api to localhost:8080,
# matching prod nginx, which forwards /api to the api service.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$repo_root/frontend"

# VITE_* come from the Infisical frontend project via .infisical.json.
# VITE_AUTH_API_URL / VITE_ITENARY_API_URL keep the prod values: same-origin
# /api/* paths, proxied in dev exactly as nginx proxies them in prod.
export VITE_AUTH_API_URL="${VITE_AUTH_API_URL:-/api/users}"
export VITE_ITENARY_API_URL="${VITE_ITENARY_API_URL:-/api/itenary}"
export VITE_AUTH_URL="${VITE_AUTH_URL:-https://auth.shrijit.tech}"

if command -v infisical >/dev/null 2>&1 && infisical export --silent >/dev/null 2>&1; then
  exec infisical run --env=prod --silent -- npm run dev
fi

echo "infisical CLI unavailable or not logged in; starting with local env only" >&2
exec npm run dev