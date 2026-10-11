#!/usr/bin/env bash
# Start the local MongoDB the backend expects (mongodb://127.0.0.1:27017).
#
# The prod database lives in the Dokploy swarm as an internal service and is
# not reachable from this workstation; local runs use a local mongod and a
# separate `triptribe_ai_local` database so prod data is never touched.
#
# Resolution order for mongod:
#   1. $MONGOD_BIN, if set
#   2. mongod on PATH
#   3. mongod installed through mise (mise use -g mongodb@8)
set -euo pipefail

data_dir="${TRIPTRIBE_MONGO_DATA_DIR:-$HOME/.local/share/triptribe-mongo/data}"
log_dir="$(dirname "$data_dir")/log"
log_file="$log_dir/mongod.log"

find_mongod() {
  if [ -n "${MONGOD_BIN:-}" ] && [ -x "$MONGOD_BIN" ]; then
    printf '%s' "$MONGOD_BIN"; return 0
  fi
  if command -v mongod >/dev/null 2>&1; then
    command -v mongod; return 0
  fi
  if command -v mise >/dev/null 2>&1; then
    mise which mongod 2>/dev/null && return 0 || true
  fi
  return 1
}

if ! mongod_bin="$(find_mongod)"; then
  cat >&2 <<'EOF'
dev-mongo: mongod not found.

Install one of:
  mise use -g mongodb@8      # installs to ~/.local/share/mise/installs/mongodb
  pacman -S mongodb         # Arch official, requires sudo
Or set MONGOD_BIN=/path/to/mongod
EOF
  exit 1
fi

mkdir -p "$data_dir" "$log_dir"

# Reuse the running instance if it already answers on the port.
if (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null; then
  echo "mongod already listening on 127.0.0.1:27017"
  exit 0
fi

"$mongod_bin" \
  --dbpath "$data_dir" \
  --bind_ip 127.0.0.1 \
  --port 27017 \
  --logpath "$log_file" \
  --fork

echo "mongod started (log: $log_file)"
echo "backend MONGO_URI default: mongodb://127.0.0.1:27017/triptribe_ai_local"