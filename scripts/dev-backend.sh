#!/usr/bin/env bash
# Start the backend with the same Infisical-backed env production gets.
#
#   ./scripts/dev-backend.sh            nodemon, watch mode
#   ./scripts/dev-backend.sh --no-watch node, single run
#
# Secrets come from the Infisical vault (see scripts/infisical-env.sh); the
# MONGO_URI default points at a local mongod, not the prod swarm service.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

no_watch=false
[ "${1:-}" = "--no-watch" ] && no_watch=true

# Source with positional parameters cleared: the resolver takes its own flags.
set --
# shellcheck source=scripts/infisical-env.sh
source "$repo_root/scripts/infisical-env.sh"

cd "$repo_root/backend"

if [ "$no_watch" = true ]; then
  exec node index.js
fi
exec npx nodemon index.js
