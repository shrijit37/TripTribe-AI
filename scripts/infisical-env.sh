#!/usr/bin/env bash
# Resolve TripTribe env vars from Infisical, mirroring production exactly.
#
# Production (Dokploy + .github/workflows/deploy.yml) does NOT hand the app
# the raw vault key names. The deploy job maps the shared `TRIPTRIBE_*` vault
# keys onto the app-level names the code reads, via this exact mapping:
#
#   MONGO_URI                     <- TRIPTRIBE_MONGO_URI
#   OPENAI_KEY                    <- TRIPTRIBE_OPENAI_KEY
#   GOOGLE_CUSTOM_SEARCH_API_KEY  <- TRIPTRIBE_GOOGLE_SEARCH_KEY
#   AUTH_URL                      -> internal swarm DNS of the auth service
#
# This script performs the same mapping locally so a local run and a prod
# container see identically named variables. Secrets are only ever held in
# process env: nothing is written to disk, nothing is echoed.
#
# Usage: source scripts/infisical-env.sh [--vault-mongo]
#
# Overridable:
#   TRIPTRIBE_INFISICAL_PROJECT_ID  vault project (prod default)
#   TRIPTRIBE_INFISICAL_ENV         environment slug (prod default)
#   TRIPTRIBE_LOCAL_MONGO_URI       local database (default below)
#   TRIPTRIBE_AUTH_URL              auth base URL for local runs
#   --vault-mongo                   use the prod vault MONGO_URI (only
#                                   reachable from inside the prod swarm)

TRIPTRIBE_INFISICAL_PROJECT_ID="${TRIPTRIBE_INFISICAL_PROJECT_ID:-1a39a192-cf29-4ec9-812f-94c35cce34f2}"
TRIPTRIBE_INFISICAL_ENV="${TRIPTRIBE_INFISICAL_ENV:-prod}"
TRIPTRIBE_LOCAL_MONGO_URI="${TRIPTRIBE_LOCAL_MONGO_URI:-mongodb://127.0.0.1:27017/triptribe_ai_local}"
# Prod points this at internal swarm DNS (http://app-copy-mobile-transmitter-zblo2d:8080).
# That name does not resolve off the server; the public URL is the same service.
TRIPTRIBE_AUTH_URL="${TRIPTRIBE_AUTH_URL:-https://auth.shrijit.tech}"

__triptribe_use_vault_mongo=false
for __triptribe_arg in "$@"; do
  case "$__triptribe_arg" in
    --vault-mongo) __triptribe_use_vault_mongo=true ;;
    *) echo "infisical-env: unknown argument: $__triptribe_arg" >&2; return 1 2>/dev/null || exit 1 ;;
  esac
done

command -v infisical >/dev/null 2>&1 || {
  echo "infisical-env: infisical CLI not found on PATH" >&2
  return 1 2>/dev/null || exit 1
}

# Single API round trip, then read keys out of the JSON in memory.
__triptribe_secrets="$(
  infisical export \
    --projectId="$TRIPTRIBE_INFISICAL_PROJECT_ID" \
    --env="$TRIPTRIBE_INFISICAL_ENV" \
    --format=json \
    --silent 2>/dev/null
)" || {
  echo "infisical-env: export failed for project $TRIPTRIBE_INFISICAL_PROJECT_ID" \
    "env '$TRIPTRIBE_INFISICAL_ENV' — run 'infisical login', and confirm" \
    "with 'infisical profile list' that the CLI targets the instance" \
    "owning this vault" >&2
  return 1 2>/dev/null || exit 1
}

__triptribe_get() {
  printf '%s' "$__triptribe_secrets" |
    jq -r --arg k "$1" 'map(select(.key == $k)) | .[-1].value // ""'
}

MONGO_URI="$(__triptribe_get TRIPTRIBE_MONGO_URI)"
if [ "$__triptribe_use_vault_mongo" != true ]; then
  MONGO_URI="$TRIPTRIBE_LOCAL_MONGO_URI"
fi
OPENAI_KEY="$(__triptribe_get TRIPTRIBE_OPENAI_KEY)"
GOOGLE_CUSTOM_SEARCH_API_KEY="$(__triptribe_get TRIPTRIBE_GOOGLE_SEARCH_KEY)"

# A missing vault key must fail loudly: an empty MONGO_URI leaves mongoose
# hanging on connect and an empty OPENAI_KEY fails only at request time, so
# both read as unrelated bugs otherwise.
__triptribe_require() {
  if [ -z "$2" ]; then
    echo "infisical-env: required vault key '$1' is missing or empty in" \
      "$TRIPTRIBE_INFISICAL_PROJECT_ID/$TRIPTRIBE_INFISICAL_ENV" >&2
    return 1
  fi
}

# Placeholders are owner TODOs in the vault, not credentials. Warn and keep
# going: production boots degraded on these, local should behave the same.
__triptribe_warn_placeholder() {
  case "$2" in
    REPLACE_ME*)
      echo "infisical-env: $1 is a REPLACE_ME placeholder — features using" \
        "it will fail at request time (prod degrades the same way)" >&2
      ;;
  esac
}

__triptribe_require MONGO_URI "$MONGO_URI" || return 1 2>/dev/null || exit 1
__triptribe_require OPENAI_KEY "$OPENAI_KEY" || return 1 2>/dev/null || exit 1
__triptribe_require GOOGLE_CUSTOM_SEARCH_API_KEY "$GOOGLE_CUSTOM_SEARCH_API_KEY" \
  || return 1 2>/dev/null || exit 1
__triptribe_warn_placeholder OPENAI_KEY "$OPENAI_KEY"
__triptribe_warn_placeholder GOOGLE_CUSTOM_SEARCH_API_KEY "$GOOGLE_CUSTOM_SEARCH_API_KEY"

AUTH_URL="$TRIPTRIBE_AUTH_URL"
PORT="${PORT:-8080}"
NODE_ENV="${NODE_ENV:-development}"
APP_VERSION="${APP_VERSION:-local}"

export MONGO_URI OPENAI_KEY GOOGLE_CUSTOM_SEARCH_API_KEY AUTH_URL \
  PORT NODE_ENV APP_VERSION

unset __triptribe_secrets __triptribe_get __triptribe_use_vault_mongo __triptribe_arg \
  __triptribe_require __triptribe_warn_placeholder
unset TRIPTRIBE_INFISICAL_PROJECT_ID TRIPTRIBE_INFISICAL_ENV \
  TRIPTRIBE_LOCAL_MONGO_URI TRIPTRIBE_AUTH_URL