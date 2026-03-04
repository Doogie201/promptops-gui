# Architecture Inference

## Current Model
This repository is a deterministic event-driven core with sprint-oriented policy and evidence constraints. It is intentionally minimal: business logic is implemented as pure or near-pure transformations, while filesystem writes are constrained to explicit outputs.

## Inferred Invariants
- Determinism is required: canonical ordering, stable hashes, no timestamp-based output contracts.
- Delta-only closeout is required: completed requirements must never reappear in delta tickets.
- Policy acts as hard boundary: constraints should be machine-checkable and testable.
- Evidence must be durable and externally auditable (docs + /tmp artifacts).

## Coupling and Risk Points
- `engine/store.ts` mixes persistence and replay/state application; regressions here affect idempotency and resume behavior.
- `engine/evaluator.ts` is now central to sprint closeout logic; contract drift can break downstream reporting.
- CI success depends on scripts and tests staying aligned with package scripts.
- Absolute path leakage is a recurring operational risk; stoplight checks must stay active.

## Architectural Gaps Closed in This Run
- Added canonical verify entrypoint (`scripts/verify.sh`) and CI verify workflow.
- Added missing tests for policy and event canonicalization.
- Added integration test to prevent drift between store and evaluator behavior.
- Converted hardcoded repo policy path to computed repo root.

## Remaining Risks
- No explicit integration tests yet for template->ticket output module boundary in one end-to-end scenario.
- Evidence directory growth control is procedural but not yet enforced by a size-aware guard script.
