# S15 — Terminal Panel

## Sprint Header

| Field | Value |
|---|---|
| Sprint ID | S15 |
| Branch | sprint/S15-terminal-panel |
| Base | main |
| Objective | Add an optional in-app terminal panel that uses the exact same command executor, whitelists, and receipts/event pipeline as existing GUI actions so terminal usage cannot drift or bypass safeguards. |

## Work Plan

### S15.A Terminal panel UI (optional, off by default)
- Add panel state with explicit enable toggle and visible enabled indicator.
- Keep panel output plain text only and deterministic.

### S15.A1 Same executor, same whitelist, same receipts
- Route terminal commands through existing `createToolRunContext` + `executeCommandSet` + `copyBundleToDurable`.
- Reuse command-family policy derived from existing GUI operator tool specs.

### S15.A2 Deterministic command templates
- Add fixed templates for git, gh, npm, and gates operations.
- Parameterize PR number safely for `gh pr checks` template.

### S15.B Drift prevention + safety
- Enforce out-of-sync gate before terminal command execution.
- Block disallowed/dangerous commands and emit security events in terminal event stream.

## Acceptance Tests

- [x] AT-S15-01: Terminal panel commands produce receipt schema parity with GUI tool runs.
- [x] AT-S15-02: Disallowed commands are blocked and recorded as security events.
- [x] AT-S15-03: Terminal command path does not bypass out-of-sync hard-stop behavior.

## Evidence Bundles

- `docs/sprints/S15/evidence/preflight/` — repo-root and sprint-start preflight receipts.
- `docs/sprints/S15/evidence/gates/` — pre-commit/lint/test/build receipts.
- `docs/sprints/S15/evidence/at/` — AT-S15-01..03 receipts.
- `docs/sprints/S15/evidence/scope/` — diff whitelist + budget checks.
- `docs/sprints/S15/evidence/stoplight/` — marker list + grep receipts.
- `docs/sprints/S15/evidence/pr/` — PR readiness and label/check/thread receipts.
- `docs/sprints/S15/evidence/maintainability/` — touched-file budget receipts.

## Definition of Done

- All AT-S15 tests pass with durable evidence.
- Terminal panel remains optional/off by default.
- Terminal execution cannot bypass existing executor or sync gate safeguards.
- No file outside sprint whitelist is touched.
- Required gates pass.
