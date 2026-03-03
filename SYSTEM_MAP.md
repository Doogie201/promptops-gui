# System Map

## Runtime Surface
- `engine/`: deterministic execution core (events, state machine, run store, evaluator, templates).
- `policy/`: global constraints (path whitelist + budget invariants).
- `docs/`: sprint system-of-record, evidence receipts, backlog index.
- `.github/workflows/`: CI verification + Codecov upload.

## Command Surface
- Build: `npm run -s build`
- Test: `npm run -s test:all`
- Lint/stoplight checks: `npm run -s lint`
- Full verify: `npm run -s verify`
- Legacy gate wrapper: `bash gates.sh`

## Data Artifacts
- Engine run logs: `/tmp/promptops/S02/runs/*.jsonl`
- Evaluator fixtures: `/tmp/promptops/S04/fixtures/*.json`
- Delta tickets: `/tmp/promptops/S04/delta/*.json`
- Coverage outputs: `coverage/tmp/coverage-*.json`

## Dependency Graph (high-level)
- `engine/events/schema.ts` -> used by `engine/store.ts` and template compiler canonicalization.
- `engine/state/machine.ts` -> used by `engine/store.ts`.
- `engine/store.ts` + `engine/evaluator.ts` -> integration contract for run evidence and outstanding-only deltas.
- `policy/index.ts` -> constraints leaf module (must remain dependency sink).

## Ownership Domains
- Domain A: execution core (`engine/state`, `engine/events`, `engine/store`).
- Domain B: evaluation/output (`engine/evaluator`, `engine/templates`, `engine/output`).
- Domain C: policy/guardrails (`policy/`, `scripts/verify.sh`, CI workflows).
- Domain D: documentation+evidence (`docs/backlog`, `docs/sprints`).
