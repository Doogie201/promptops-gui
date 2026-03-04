---
name: repo-operability
description: Use this skill when preparing or repairing this repository for deterministic autonomous operation (build, test, lint, verify, CI parity).
---

# Repo Operability Skill

## Use When
- Gates are failing or missing.
- Scripts and CI steps are out of sync.
- Determinism checks need to be made machine-detectable.

## Procedure
1. Confirm baseline with `git status --porcelain=v1 --branch`.
2. Run `npm ci` and `npm run -s verify`.
3. If verify scripts are missing or stale, update `scripts/verify.sh` and keep `package.json` scripts aligned.
4. Ensure workflow parity in `.github/workflows/verify.yml`.
5. Re-run `npm run -s verify` and summarize blockers with concrete file paths.

## Constraints
- Smallest safe change set.
- No speculative refactors.
- No path-specific assumptions tied to a single machine.
