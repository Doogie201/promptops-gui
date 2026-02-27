# Sprint S04: Evaluator, Evidence Ledger, and Codecov

## Objective
Implement a deterministic evaluator that compares Agent Output vs Sprint Requirements, maintains an evidence ledger, and emits only delta tickets when incomplete, while also adding operator-grade Codecov coverage upload in CI.

## Work Plan
- Integrate Codecov in CI via GitHub Actions.
- Generate `lcov` coverage for evaluator tests and upload with `codecov/codecov-action@v5`.
- Implement deterministic evaluator logic in `engine/evaluator.ts` that outputs cited ledger entries and outstanding-only delta tickets.
- Add repeat-request detection: if a requirement was already DONE with evidence, re-asking it returns `blocked` / `needs_input` and does not produce a looping delta ticket.
- Enforce completion contract: when all requirements are DONE, emit no JSON delta ticket file.
- Create acceptance tests for determinism, no re-asking of already evidenced work, repeat-request blocking, and no-ticket-on-complete.
- No rework of evidenced work; delta tickets only.

## Acceptance Tests
- **AT-S04-01**: Evaluator deterministically compares output to requirements and identifies missing items.
- **AT-S04-02**: Evaluator emits a delta ticket when requirements are incomplete.
- **AT-S04-03**: Evaluator maintains a monotonic evidence ledger of evaluations.
- **AT-S04-04**: Codecov coverage generation runs successfully and coverage artifacts are uploaded in CI.
- **AT-S04-05**: Repeat-request detection returns `blocked` / `needs_input` deterministically and emits no looping delta ticket.
- **AT-S04-06**: When all requirements are DONE, evaluator emits no delta ticket JSON file.

## Definition of Done
- No god-files breached (budget: 120 net new lines per existing file, 1200 max LOC).
- All gates pass locally.
- 10 evidence commands captured from primary worktree.
- Receipts stored in `docs/sprints/S04/evidence/`.
- Tests prove requirements, evaluator determinism, and outstanding-only delta output.
