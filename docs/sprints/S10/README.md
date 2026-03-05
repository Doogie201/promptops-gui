# S10 - GUI Operator Tools v1

## Sprint Header
- Sprint ID: `S10-gui-operator-tools-v1`
- Branch: `sprint/S10-gui-operator-tools-v1`
- Objective: Put the full operator workflow inside the GUI (preflight, PR protocol, gates, diff review, out-of-sync detection/repair, closeout assistant) with operator-grade evidence and hard stops.

## Work Plan
1. Add `Operator Tools` modules for preflight, PR protocol, gates, diff review, out-of-sync radar/repair, and closeout assistant.
2. Enforce migration-safe root resolution from `PROMPTOPS_REPO` and deterministic hard-stop codes.
3. Emit deterministic receipt bundles per tool run under `/tmp/promptops/S10/...` and durable copies under `docs/sprints/S10/evidence/...`.
4. Expose GUI-facing snapshot payloads for tool cards, run timeline state, and wizard-root mismatch guardrail.

## Acceptance Tests
- `AT-S10-01`: Preflight tool executes the mandatory command set and enforces `MISSING_REPO_ROOT`, `REPO_ROOT_MISMATCH`, `REPO_ROOT_NOT_ON_MAIN/NOT_SYNCED`, and `GIT_OBJECT_INTEGRITY` stops.
- `AT-S10-02`: PR Protocol tool inventories open PRs, evaluates merge readiness, and captures codex before/mutation/after thread proof.
- `AT-S10-03`: Gates + Diff + Out-of-sync + Closeout tools produce deterministic receipts and a GUI-ready operator snapshot.

## Definition of Done
- Required receipt files are generated per tool in staging:
  - Preflight: `preflight_commands.json`, `preflight_outputs.ndjson`, `preflight_eval.md`
  - PR protocol: `open_pr_list.json`, `pr_view.json`, `pr_threads_before.json`, `pr_threads_after.json`, `graphql_resolve_mutations.jsonl`, `pr_protocol_eval.md`
  - Gates: `gates_commands.json`, `gates_outputs.ndjson`, `gates_eval.md`
  - Diff: `diff_files.json`, `diffstat.txt`, `whitelist_eval.md`, `budget_eval.md`
  - Out-of-sync: `radar_signals.json`, `repair_actions.json`, `diagnosis_report.md`
  - Closeout: `closeout_summary.md`, `closeout_manifest.json`
- Durable copy exists under `docs/sprints/S10/evidence/`.
- S10 AT receipts are present in `/tmp/promptops/S10/tests/` and copied into sprint evidence.
