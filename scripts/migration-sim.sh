#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

bash "$REPO_ROOT/scripts/preflight.sh"

WORK_DIR="/tmp"
(
  cd "$WORK_DIR"
  echo "[migration-sim] cwd=$PWD repo_root=$REPO_ROOT"
  bash "$REPO_ROOT/gates.sh"
)
