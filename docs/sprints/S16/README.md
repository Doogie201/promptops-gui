# S16 — Hardening + Regression Suite

## Sprint Header

| Field | Value |
|---|---|
| Sprint ID | S16 |
| Branch | sprint/S16-hardening-regression |
| Base | main |
| Objective | Harden the system for real-world release: deterministic replay/regression fixtures, long-run stability checks, adapter resilience behaviors, and GUI recovery tooling. |

## Work Plan

### S16.A Golden fixture suite
- Build canonical fixture hashing for run artifacts.
- Compare replay outputs against frozen fixture hashes.

### S16.B Long-run stability checks
- Evaluate bounded growth (heap/log/latency/fatal errors).
- Emit deterministic pass/fail summary from sampled runs.

### S16.C Adapter resilience
- Deterministic retry schedule with bounded retries.
- Emit switch-agent escalation after configured failure threshold.
- Preserve partial output salvage across failed attempts.

### S16.D Recovery tooling
- Add recovery actions: repair run store, reindex artifacts, resume checkpoint, diagnosis report.
- Route all actions through shared S10 executor/receipt pipeline.

## Acceptance Tests

- [x] AT-S16-01 Deterministic replay and hash parity for fixture replays.
- [x] AT-S16-02 Long-run stability evaluation + adapter resilience behavior.
- [x] AT-S16-03 Recovery actions run through shared executor/whitelist with receipts.

## Evidence Bundles

- `docs/sprints/S16/evidence/preflight/` — repo root + sprint start + git hygiene receipts.
- `docs/sprints/S16/evidence/at/` — acceptance-test receipts.
- `docs/sprints/S16/evidence/gates/` — pre-commit/lint/test/build receipts.
- `docs/sprints/S16/evidence/scope/` — whitelist + budget checks.
- `docs/sprints/S16/evidence/stoplight/` — marker list + grep outputs.
- `docs/sprints/S16/evidence/maintainability/` — touched-file and function-size checks.
- `docs/sprints/S16/evidence/pr/` — PR creation/checks/threads/stability receipts.
- `docs/sprints/S16/evidence/regression/` — deterministic replay artifacts.
- `docs/sprints/S16/evidence/hardening/` — long-run and recovery artifacts.

## Definition of Done

- All S16 ATs pass with durable evidence.
- Required gates pass (`pre-commit`, `lint`, `test`, `build`).
- No file outside whitelist touched.
- PR readiness proven with checks green + threads resolved + 190s stability watch.
