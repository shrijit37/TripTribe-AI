#!/usr/bin/env bash
# Resolve TripTribe env vars from Doppler, mirroring production exactly.
#
# Production (Dokploy + .github/workflows/deploy.yml) does NOT hand the app
# the raw vault key names. The deploy job maps the shared `TRIPTRIBE_*` vault
# keys onto the app-level names the code reads, via this exact mapping:
#
#   MONGO_URI                     <- TRIPTRIBE_MONGO_URI
#   OPENAI_KEY                    <- TRIPTRIBE_OPENAI_KEY
#   GOOGLE_CUSTOM_SEARCH_API_KEY  <- TRIPTRIBE_GOOGLE_SEARCH_KEY
#   RESEND_API_KEY                <- TRIPTRIBE_RESEND_API_KEY
#   AUTH_URL                      =  https://auth.shrijit.tech
#
# This script performs the same mapping locally so a local run and a prod
# container see identically named variables. Secrets are only ever held in
# process env: nothing is written to disk, nothing is echoed.
#
# Usage: source scripts/vault-env.sh [--vault-mongo]
#
# Overridable:
#   TRIPTRIBE_DOPPLER_PROJECT       Doppler project (platform default)
#   TRIPTRIBE_DOPPLER_CONFIG        Doppler config (prd default)
#   TRIPTRIBE_LOCAL_MONGO_URI       local database (default below)
#   TRIPTRIBE_AUTH_URL              auth base URL for local runs
#   --vault-mongo                   use the prod vault MONGO_URI (only
#                                   reachable from inside the prod swarm)
#
# Mappings this script adds for the grounded itinerary pipeline and the
# email hand-off:
#   GOOGLE_PLACES_API_KEY         <- TRIPTRIBE_GOOGLE_PLACES_API_KEY
#   GOOGLE_ROUTES_API_KEY         <- TRIPTRIBE_GOOGLE_PLACES_API_KEY (same key)
#   RESEND_API_KEY                <- TRIPTRIBE_RESEND_API_KEY
#   RESEND_FROM                   <- TRIPTRIBE_RESEND_FROM
#                                   reachable from inside the prod swarm)

TRIPTRIBE_DOPPLER_PROJECT="${TRIPTRIBE_DOPPLER_PROJECT:-platform}"
TRIPTRIBE_DOPPLER_CONFIG="${TRIPTRIBE_DOPPLER_CONFIG:-prd}"
TRIPTRIBE_LOCAL_MONGO_URI="${TRIPTRIBE_LOCAL_MONGO_URI:-mongodb://127.0.0.1:27017/triptribe_ai_local}"
# Prod points this at internal swarm DNS (http://app-copy-mobile-transmitter-zblo2d:8080).
# That name does not resolve off the server; the public URL is the same service.
# Prod used to point this at internal swarm DNS
# (http://app-copy-mobile-transmitter-zblo2d:8080) — the name of a scratch
# application, not the auth service. The public endpoint is the only value that
# works from inside the container.
TRIPTRIBE_AUTH_URL="${TRIPTRIBE_AUTH_URL:-https://auth.shrijit.tech}"

__triptribe_use_vault_mongo=false
for __triptribe_arg in "$@"; do
  case "$__triptribe_arg" in
    --vault-mongo) __triptribe_use_vault_mongo=true ;;
    *) echo "vault-env: unknown argument: $__triptribe_arg" >&2; return 1 2>/dev/null || exit 1 ;;
  esac
done

command -v doppler >/dev/null 2>&1 || {
  echo "vault-env: doppler CLI not found on PATH" >&2
  return 1 2>/dev/null || exit 1
}

# Single API round trip, then read keys out of the JSON in memory.
__triptribe_secrets="$(
  doppler secrets download \
    -p "$TRIPTRIBE_DOPPLER_PROJECT" \
    -c "$TRIPTRIBE_DOPPLER_CONFIG" \
    --no-file \
    --format json \
    --silent 2>/dev/null
)" || {
  echo "vault-env: download failed for project $TRIPTRIBE_DOPPLER_PROJECT" \
    "config '$TRIPTRIBE_DOPPLER_CONFIG' — run 'doppler login', and confirm" \
    "with 'doppler configs' that the CLI is authenticated against the" \
    "workspace owning this config" >&2
  return 1 2>/dev/null || exit 1
}

__triptribe_get() {
  printf '%s' "$__triptribe_secrets" |
    jq -r --arg k "$1" '.[$k] // ""'
}

MONGO_URI="$(__triptribe_get TRIPTRIBE_MONGO_URI)"
if [ "$__triptribe_use_vault_mongo" != true ]; then
  MONGO_URI="$TRIPTRIBE_LOCAL_MONGO_URI"
fi
OPENAI_KEY="$(__triptribe_get TRIPTRIBE_OPENAI_KEY)"
GOOGLE_CUSTOM_SEARCH_API_KEY="$(__triptribe_get TRIPTRIBE_GOOGLE_SEARCH_KEY)"
OPENAI_BASE_URL="$(__triptribe_get TRIPTRIBE_OPENAI_BASE_URL)"
OPENAI_MODEL="$(__triptribe_get TRIPTRIBE_OPENAI_MODEL)"
# Grounded pipeline. The same key serves Places and Routes: it is created with
# `--api-target=service=places.googleapis.com --api-target=service=routes.googleapis.com`
# so one restricted server key covers discovery, enrichment and day ordering.
GOOGLE_PLACES_API_KEY="$(__triptribe_get TRIPTRIBE_GOOGLE_PLACES_API_KEY)"
GOOGLE_ROUTES_API_KEY="$GOOGLE_PLACES_API_KEY"

# A missing vault key must fail loudly: an empty MONGO_URI leaves mongoose
# hanging on connect and an empty OPENAI_KEY fails only at request time, so
# both read as unrelated bugs otherwise.
__triptribe_require() {
  if [ -z "$2" ]; then
    echo "vault-env: required vault key '$1' is missing or empty in" \
      "$TRIPTRIBE_DOPPLER_PROJECT/$TRIPTRIBE_DOPPLER_CONFIG" >&2
    return 1
  fi
}

# Placeholders are owner TODOs in the vault, not credentials. Warn and keep
# going: production boots degraded on these, local should behave the same.
__triptribe_warn_placeholder() {
  case "$2" in
    REPLACE_ME*)
      echo "vault-env: $1 is a REPLACE_ME placeholder — features using" \
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

# Grounding is a required feature, but not a required boot. A missing key
# leaves the API up and only itinerary generation unconfigured, which matches
# how the app degrades in production — so warn rather than exit.
if [ -z "$GOOGLE_PLACES_API_KEY" ]; then
  echo "vault-env: TRIPTRIBE_GOOGLE_PLACES_API_KEY is missing — grounded" \
    "itinerary generation will report 'not configured' at request time" >&2
fi
__triptribe_warn_placeholder GOOGLE_PLACES_API_KEY "$GOOGLE_PLACES_API_KEY"

# A gateway changes endpoint and model together; either both are present or
# neither is, so a half-configured pair never silently falls back to
# OpenRouter while looking configured.
if [ -n "$OPENAI_BASE_URL" ] || [ -n "$OPENAI_MODEL" ]; then
  if [ -z "$OPENAI_BASE_URL" ] || [ -z "$OPENAI_MODEL" ]; then
    echo "vault-env: OPENAI_BASE_URL and OPENAI_MODEL must both be set" \
      "for a non-OpenRouter gateway; one alone was found" >&2
    return 1 2>/dev/null || exit 1
  fi
fi

# The email hand-off. Optional in both directions: without the key the route
# answers "not available right now" rather than failing opaquely.
RESEND_API_KEY="$(__triptribe_get TRIPTRIBE_RESEND_API_KEY)"
RESEND_FROM="$(__triptribe_get TRIPTRIBE_RESEND_FROM)"
if [ -z "$RESEND_API_KEY" ]; then
  echo "vault-env: TRIPTRIBE_RESEND_API_KEY is missing — the email hand-off" \
    "will report 'not available right now'" >&2
fi

AUTH_URL="$TRIPTRIBE_AUTH_URL"
# The app listens on 80 in the container and on 3000 in dev; this script is the
# dev path.
PORT="${PORT:-3000}"
NODE_ENV="${NODE_ENV:-development}"
APP_VERSION="${APP_VERSION:-local}"

export MONGO_URI OPENAI_KEY GOOGLE_CUSTOM_SEARCH_API_KEY OPENAI_BASE_URL \
  OPENAI_MODEL AUTH_URL PORT NODE_ENV APP_VERSION \
  GOOGLE_PLACES_API_KEY GOOGLE_ROUTES_API_KEY \
  RESEND_API_KEY RESEND_FROM

unset __triptribe_secrets __triptribe_get __triptribe_use_vault_mongo __triptribe_arg \
  __triptribe_require __triptribe_warn_placeholder
unset TRIPTRIBE_DOPPLER_PROJECT TRIPTRIBE_DOPPLER_CONFIG \
  TRIPTRIBE_LOCAL_MONGO_URI TRIPTRIBE_AUTH_URL
