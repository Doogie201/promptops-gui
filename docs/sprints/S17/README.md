# S17 — GUI Entrypoint + Dashboard

## Sprint Header

| Field | Value |
|---|---|
| Sprint ID | S17 |
| Branch | sprint/S17-gui-entrypoint-dashboard |
| Base | main |
| Objective | Create a real Vite GUI entrypoint (`npm run dev`) that boots a deterministic Dashboard route and calls existing operator modules only through a strict façade boundary. |

## Work Plan

### S17.A Real GUI entrypoint
- Add a runnable Vite `dev` entrypoint using `src/s17/vite.config.ts`.
- Serve a deterministic single-route Dashboard page (`src/s17/index.html`).

### S17.B UI↔Operator façade
- Add typed façade contracts in `src/s17/contracts.ts`.
- Add Node façade implementation in `src/s17/operator_api_node.ts` that reuses S10 operator modules and receipts.
- Keep dashboard UI imports constrained to S17 façade modules.

### S17.C Dashboard actions
- Preflight card (`runPreflight`)
- Gates card (`runGates`)
- PR status card (`listOpenPrs`)
- Run artifacts card (`getRunStatus`)

### S17.D Guardrails
- Import-direction guard in `src/s17/import_guard.ts`.
- Deterministic action envelopes (request, receipts, exitCode, hash, reasonCode).

## Acceptance Tests

- [x] AT-S17-01 Vite dev entrypoint starts and dashboard loads.
- [x] AT-S17-02 Dashboard preflight action goes through façade→operator pipeline with deterministic envelopes.
- [x] AT-S17-03 Gates action goes through façade→operator pipeline with deterministic pass/fail envelopes.
- [x] AT-S17-04 No hardcoded absolute paths introduced; repo root strategy resolved at runtime.
- [x] AT-S17-05 Import-direction guard catches forbidden deep imports.

## Evidence Bundles

- `docs/sprints/S17/evidence/preflight/`
- `docs/sprints/S17/evidence/at/`
- `docs/sprints/S17/evidence/gates/`
- `docs/sprints/S17/evidence/scope/`
- `docs/sprints/S17/evidence/stoplight/`
- `docs/sprints/S17/evidence/maintainability/`
- `docs/sprints/S17/evidence/pr/`
- `docs/sprints/S17/evidence/ui/`

## Definition of Done

- All S17 ATs pass with durable evidence.
- Required gates pass (`pre-commit`, `lint`, `test`, `build`).
- No security regressions (no new endpoints/deps/unsafe sinks).
- PR checks green with resolved review threads.
