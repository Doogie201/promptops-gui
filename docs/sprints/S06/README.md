# Sprint S06: Git + Worktree Preflight Automation

## Objective
Implement full git/worktree preflight automation inside the engine using the S05 receipts executor: primary worktree command-set validation with hard-stop flows, sprint branch-prefix compliance with remediation guidance, prune/worktree sanity policy checks, and deterministic `OUT_OF_SYNC` event emission.

## Work Plan
- **S06.A Primary worktree automation**: Execute the canonical command set against `~/Projects/promptops-gui` and emit structured pass/hard-stop outcomes with receipts.
- **S06.B Branch compliance gate**: Validate both `^sprint/S\\d{2}-` and `^sprint/S06-`; emit `HARD_STOP_BRANCH_NONCOMPLIANCE` plus remediation guidance if invalid.
- **S06.C Prune/worktree sanity policy**: Always record `git worktree list --porcelain`; run `git prune --dry-run` when policy is `ON`, otherwise emit `PRUNE_DISABLED`.
- **S06.D Out-of-sync detection**: Capture baseline fingerprints and emit deterministic `OUT_OF_SYNC` on unexpected mid-run repository changes.

## Acceptance Tests
- **AT-S06-01**: Primary worktree hard-stop triggers and blocks sprint start when dirty/off-base/behind origin.
- **AT-S06-02**: Branch noncompliance hard-stop triggers with guided remediation receipts.
- **AT-S06-03**: Out-of-sync event is emitted when repository state changes unexpectedly mid-run.

## Definition of Done
- S06 preflight logic runs through the S05 command executor only.
- Hard-stop reason codes are deterministic and machine-verifiable.
- AT-S06-02 and AT-S06-03 pass with operator-grade receipts.
- Docs/backlog/sprint-index reflect S06 scope and evidence bundle paths.

## Evidence Paths
- Proof bundle: `/tmp/promptops/S06/<RUN_ID>/`
- Key receipts: `08_at_s06_02_branch_noncompliance.md`, `09_at_s06_03_out_of_sync.md`, `07_gates_receipts.txt`, `10_stoplight_greps.md`
