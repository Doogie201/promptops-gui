#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-all}"

run_preflight() {
  echo "[verify] preflight"
  bash "$ROOT_DIR/scripts/preflight.sh"
}

run_build() {
  echo "[verify] build"
  npm run -s build
}

run_tests() {
  echo "[verify] tests"
  npm run -s test:all
}

run_lint() {
  echo "[verify] lint"
  local status=0

  if rg -n "dangerouslySetInnerHTML" ui engine adapters policy 2>/dev/null; then
    echo "lint failure: forbidden HTML sink detected"
    status=1
  fi

  if rg -n "/Users/marcussmith/Projects\\._backup_|Projects\\._backup_" engine policy adapters ui gates.sh scripts package.json .github 2>/dev/null; then
    echo "lint failure: backup-tree absolute path reference detected"
    status=1
  fi

  if rg -n "/Volumes/[^/]+/Dev" . --glob '!docs/sprints/**/evidence/**' --glob '!node_modules/**' --glob '!coverage/**' --glob '!artifacts/proof/**' --glob '!.git/**' --glob '!scripts/verify.sh' 2>/dev/null; then
    echo "lint failure: mount-specific absolute path reference detected"
    status=1
  fi

  return "$status"
}

case "$MODE" in
  preflight)
    run_preflight
    ;;
  build)
    run_build
    ;;
  test)
    run_tests
    ;;
  lint)
    run_lint
    ;;
  all)
    run_preflight
    run_build
    run_tests
    run_lint
    ;;
  *)
    echo "usage: scripts/verify.sh [preflight|build|test|lint|all]" >&2
    exit 2
    ;;
esac
