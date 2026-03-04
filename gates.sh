#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "--- Running Deterministic Gates ---"
echo "[1/4] Preflight"
npm run -s preflight

echo "[2/4] Build"
npm run -s build

echo "[3/4] Test"
npm run -s test:all

echo "[4/4] Lint & Stoplight Greps"
npm run -s lint

echo "Gates passed."
