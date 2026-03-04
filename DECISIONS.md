# Decisions

## D1: One canonical verify entrypoint
- Decision: use `scripts/verify.sh` for local and CI parity.
- Why: reduces drift between ad-hoc commands and workflow behavior.

## D2: Deterministic stoplight lint instead of dependency-heavy lint stack
- Decision: enforce critical checks with `rg`/`find` in `scripts/verify.sh`.
- Why: no new dependencies, fast signal, and compatible with current repo maturity.

## D3: Policy path should be computed, not hardcoded
- Decision: derive repository root in `policy/index.ts`.
- Why: avoids machine-specific path breakage after migrations/worktree moves.

## D4: Add integration test crossing store + evaluator boundary
- Decision: create `engine/integration.test.ts`.
- Why: catches contract drift between execution evidence and closeout logic.

## D5: Seed lightweight reusable skills now
- Decision: add two minimal skills under `/skills`.
- Why: reduces future prompt volume and standardizes repeated workflows.
