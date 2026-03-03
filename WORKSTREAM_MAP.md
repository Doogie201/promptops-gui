# Workstream Map

## Stream 1: Engine Execution Core
- Scope: `engine/events/`, `engine/state/`, `engine/store.ts`
- Goal: idempotent run execution and crash-safe replay.
- Isolation rule: no edits to docs/workflows in this stream unless gates require it.

## Stream 2: Evaluator + Ledger Output
- Scope: `engine/evaluator.ts`, `engine/output/`, `engine/ledger/`, evaluator tests.
- Goal: deterministic done/partial/todo/blocked + delta-only output.
- Isolation rule: no state-machine refactors in same change.

## Stream 3: Policy + Verification
- Scope: `policy/`, `scripts/verify.sh`, `.github/workflows/`.
- Goal: machine-detectable safety and deterministic CI gates.
- Isolation rule: no business-logic edits.

## Stream 4: Docs + Operator Intelligence
- Scope: `docs/backlog/`, `docs/sprints/`, top-level operator docs.
- Goal: keep system-of-record accurate with minimal narrative drift.
- Isolation rule: avoid runtime changes.
