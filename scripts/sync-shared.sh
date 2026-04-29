#!/usr/bin/env bash
# =====================================================================
# sync-shared.sh
#
# Copies the canonical shooter engine (sim.ts, map.ts, types.ts) from
# the website repo into shooter-server/src/shared/ so the server can
# build against the same code that single-player runs.
#
# Run this whenever you edit any of these files in the website:
#   ardoremy_actually_website_github_repo/hry/shooter/types.ts
#   ardoremy_actually_website_github_repo/hry/shooter/engine/map.ts
#   ardoremy_actually_website_github_repo/hry/shooter/engine/sim.ts
#
# Or just `cd shooter-server && npm run build` — prebuild auto-runs it
# if the website source is reachable as a sibling. In Docker (Railway)
# the website isn't reachable, so the committed copy in src/shared/ is
# what ships.
# =====================================================================

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SERVER_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
WEBSITE="$( cd "$SERVER_ROOT/.." && pwd )/ardoremy_actually_website_github_repo/hry/shooter"
SHARED="$SERVER_ROOT/src/shared"

if [ ! -d "$WEBSITE" ]; then
  echo "[sync-shared] website source not found at $WEBSITE — skipping (using committed copy)"
  exit 0
fi

mkdir -p "$SHARED"

HEADER='// =====================================================================
// AUTO-GENERATED — DO NOT EDIT.
// Source of truth: ardoremy_actually_website_github_repo/hry/shooter/
// Re-sync: cd shooter-server && ./scripts/sync-shared.sh
// =====================================================================
'

write_with_header() {
  local src="$1"
  local dst="$2"
  {
    printf '%s\n' "$HEADER"
    cat "$src"
  } > "$dst"
}

write_with_header "$WEBSITE/types.ts"        "$SHARED/types.ts"
write_with_header "$WEBSITE/engine/map.ts"   "$SHARED/map.ts"
write_with_header "$WEBSITE/engine/sim.ts"   "$SHARED/sim.ts"

# NodeNext requires explicit .js extensions in relative imports.
# Website (Vite, bundler resolution) doesn't, so rewrite as we copy.
sed -i.bak "s|from '\.\./types'|from './types.js'|g" "$SHARED/map.ts" "$SHARED/sim.ts"
rm -f "$SHARED"/*.bak

echo "[sync-shared] copied types.ts, map.ts, sim.ts → $SHARED"
