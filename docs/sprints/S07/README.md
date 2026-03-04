# Sprint S07: GitHub PR Protocol Automation

## Objective
Implement Open PR Handling Protocol in-engine with GUI-visible status, deterministic stop conditions, codex-thread resolution support, and operator-grade receipts, while using a migration-resilient canonical root policy.

## Work Plan
- **S07.A Inventory**: Collect open PR inventory using `gh pr list` and stop deterministically on unrelated open PRs.
- **S07.B Readiness**: Evaluate merge readiness from `gh pr view` + thread GraphQL receipts with explicit failing conditions.
- **S07.C Merge gate**: Expose merge attempt capability guarded by `operatorApprovedMerge=true` (default false).
- **S07.D Codex protocol**: Detect codex comments/threads, identify unresolved codex threads, resolve via GraphQL where possible, and stop with deterministic blocker when unresolved.
- **S07.E Canonical root policy**: Resolve canonical root via `PROMPTOPS_GUI_CANONICAL_ROOT` or git toplevel fallback and enforce cwd guardrails.

## Acceptance Tests
- **AT-S07-01**: Unrelated open PR inventory triggers deterministic stop with evidence.
- **AT-S07-02**: Readiness gate fail path reports exact failing JSON field conditions.
- **AT-S07-03**: Codex unresolved thread flow resolves via GraphQL (fixture-driven) or stops deterministically if blocked.

## Definition of Done
- S07 protocol logic runs through the existing receipts executor path.
- Canonical-root resolution is migration-resilient and evidences resolved path/source.
- Deterministic reason codes and timeline states are emitted for every stop/pass path.
- AT-S07-01/02/03 are evidenced, plus verify/gates receipts and sprint docs sync.

## Evidence Paths
- Staging: `/tmp/promptops/S07/<RUN_ID>/`
- Durable: `docs/sprints/S07/evidence/`
