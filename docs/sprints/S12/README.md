# S12 - Health & Drift Detection + Guided Self-Healing + Safe Mode

## Sprint Header
- Sprint ID: `S12-health-drift-detection`
- Branch: `sprint/S12-health-drift-detection`
- Objective: Detect drift/breakage/out-of-sync conditions deterministically, surface them in GUI with severity/root-cause/evidence links, and provide GUI-only repair actions (including Safe Mode) that restore stable state without terminal access.

## Work Plan
1. Implement `src/s12/health_drift.ts` with deterministic Health Signal schema, drift detectors, bounded remediation actions, Safe Mode diagnosis, loop-stuck detection, and adapter retry/auto-switch decisions.
2. Implement AT-focused tests in `src/s12/s12.test.ts` for repo drift, adapter crash/switch, missing pinned template hard-stop+restore, and deterministic Safe Mode diagnosis behavior.
3. Capture sprint receipts under `/tmp/promptops/S12/run_<ts>/` and copy durable evidence to `docs/sprints/S12/evidence/`.
4. Run gates (`build`, `test:all`, `lint`) and S12 AT tests, then open one PR with marker lists and evidence references.

## Acceptance Tests
- `AT-S12-01`: Simulated repo drift emits `REPO_DRIFT` with explicit delta evidence; checkpoint restore + preflight action path returns stable state.
- `AT-S12-02`: Simulated adapter crash emits `ADAPTER_DOWN`; bounded deterministic retries occur; auto-switch to secondary agent records continuity hash.
- `AT-S12-03`: Missing pinned template emits `TEMPLATE_DRIFT` hard-stop; restore path clears signal and allows deterministic resume.
- `AT-S12-04`: Safe Mode diagnosis report is deterministic and proves no agent invocation in diagnosis-only mode.

## Definition of Done
- Health signals support severity ordering (`OK/WARN/FAIL`) and deterministic IDs/evidence references.
- Drift detectors cover repo/worktree/template/ledger/receipt integrity checks.
- Repair actions are GUI-safe, bounded, and explicit about mutation/confirmation requirements.
- Safe Mode report is canonicalized + hashed, and flags agent invocation violations.
- Durable evidence exists under `docs/sprints/S12/evidence/`.

## Evidence Paths
- Staging: `/tmp/promptops/S12/run_<ts>/*`
- Durable: `docs/sprints/S12/evidence/**`
- Required: `INDEX.md`, AT receipts, gate receipts, stoplight marker/grep receipts, scope/maintainability receipts, PR receipts.
