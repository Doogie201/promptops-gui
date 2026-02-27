#!/usr/bin/env bash
set -e

echo "--- Running Gates ---"
cd /Users/marcussmith/Projects/promptops-gui

echo "[1/3] Build (tsc)"
npx tsc

echo "[2/3] Test"
node --test engine/state/machine.test.js

echo "[3/3] Lint & Stoplight Greps"
mkdir -p docs/sprints/S01/evidence
echo "--- Stoplight Greps Catalog ---" > docs/sprints/S01/evidence/stoplight_greps.txt
grep -rn "dangerouslySetInnerHTML" ui/ || true >> docs/sprints/S01/evidence/stoplight_greps.txt
grep -rn "console.log" engine/ || true >> docs/sprints/S01/evidence/stoplight_greps.txt
grep -rn --exclude-dir=node_modules --exclude-dir=.git "TODO" . || true >> docs/sprints/S01/evidence/stoplight_greps.txt

echo "Gates passed."
