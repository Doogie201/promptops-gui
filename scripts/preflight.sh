#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STATE_DIR="$REPO_ROOT/.agent_state"
PROBE_FILE="$STATE_DIR/preflight.write_probe"

need_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "preflight failure: missing required command '$cmd'" >&2
    exit 10
  fi
}

need_cmd git
need_cmd node
need_cmd npm
need_cmd rg

if ! git -C "$REPO_ROOT" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "preflight failure: '$REPO_ROOT' is not a git repository root" >&2
  exit 11
fi

TOPLEVEL="$(git -C "$REPO_ROOT" rev-parse --show-toplevel)"
if [[ "$TOPLEVEL" != "$REPO_ROOT" ]]; then
  echo "preflight failure: script-derived root '$REPO_ROOT' != git root '$TOPLEVEL'" >&2
  exit 12
fi

mkdir -p "$STATE_DIR"
echo "probe" >"$PROBE_FILE"
rm -f "$PROBE_FILE"

if [[ "$REPO_ROOT" == /Volumes/* ]]; then
  MOUNT_ROOT="$(echo "$REPO_ROOT" | awk -F/ '{print "/"$2"/"$3}')"
  if [[ ! -d "$MOUNT_ROOT" ]]; then
    echo "preflight failure: required mount path '$MOUNT_ROOT' is missing." >&2
    echo "operator action: mount the drive, then rerun 'npm run -s verify'." >&2
    exit 20
  fi
  if [[ ! -w "$MOUNT_ROOT" ]]; then
    echo "preflight failure: required mount path '$MOUNT_ROOT' is not writable." >&2
    echo "operator action: fix mount permissions, then rerun 'npm run -s verify'." >&2
    exit 21
  fi
fi

NODE_VERSION="$(node -v)"
NPM_VERSION="$(npm -v)"
echo "preflight ok: repo_root=$REPO_ROOT node=$NODE_VERSION npm=$NPM_VERSION"
