# S02: Engine Run Store + Idempotency + Crash-Safe Resume v1

## Objective
Implement a deterministic, append-only run store plus idempotency and crash-safe resume so identical inputs converge to identical outputs without duplicating actions.

## Work Plan
1. **Engine Update**: Implement the append-only run store in `/engine`.
2. **Idempotency**: Ensure that existing runs are detected and inputs matching previous runs do not unnecessarily re-trigger identical workflows.
3. **Crash-Safe Resume**: Implement ability to load prior state and resume interrupted runs deterministically.

## Acceptance Tests
- [ ] AT-S02-01: Run Store correctly tracks and retrieves append-only events.
- [ ] AT-S02-02: Idempotency is preserved (identical inputs yield no new duplicated actions).
- [ ] AT-S02-03: Crash-safe resume restores state precisely and completes workflow successfully.

## Definition of Done (DoD)
- All ATs pass with verifiable command-line receipts.
- Determinism and Security non-negotiables are upheld (monotonic state).
- Whitelist strictly adhered to.
- Pre-commit CI and local gates pass cleanly.
- Sprint branch created prefix `sprint/S02-` and merged via PR.
- Durable evidence collected in `docs/sprints/S02/evidence/`.
