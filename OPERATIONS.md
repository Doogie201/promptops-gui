# Operations

## Standard Operator Loop
1. `git status --porcelain=v1 --branch`
2. `npm ci`
3. `npm run -s preflight`
4. `npm run -s verify`
5. Review failures by module boundary (`engine/`, `policy/`, `docs/`, workflows).
6. Apply smallest fix and rerun verify.

## Command Catalog
- Preflight: `npm run -s preflight`
- Build only: `npm run -s build`
- Test only: `npm run -s test:all`
- Lint only: `npm run -s lint`
- Full gate: `npm run -s verify`
- CI parity local run: `bash gates.sh`
- Migration simulation from non-repo cwd: `npm run -s simulate:migration`

## Failure Triage
- TypeScript compile failures: fix types or module contracts first.
- Determinism regressions: inspect canonical sort/hash code paths.
- Delta/evaluator regressions: rerun `engine/evaluator.test.ts` and inspect expected verdict contract.
- Policy regressions: run `policy/index.test.ts` and inspect whitelist/budget invariants.

## Boundary Checks
- `engine/` cannot depend on UI.
- `policy/` must remain dependency sink.
- Evidence/docs updates should not alter runtime semantics.
- Scripts must derive paths from repo root at runtime; no hard-coded mount assumptions.

## Release Readiness
- Verify all gates pass.
- Verify migration simulation passes from outside repo cwd.
- Confirm docs for decisions and next actions updated.
- Confirm workflows include verify + coverage upload paths.
