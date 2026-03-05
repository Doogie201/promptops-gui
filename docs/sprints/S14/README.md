# S14 — Jarvis Mode

## Sprint Header

| Field | Value |
|---|---|
| Sprint ID | S14-jarvis-mode |
| Branch | sprint/S14-jarvis-mode |
| Base | main |
| Objective | Deliver Jarvis Mode: deterministic human one-way narration driven purely by event stream + a live mission-control dashboard showing phases, progress, evidence count, last checkpoint, and agent switching events, without affecting any decisions. |

## Work Plan

### S14.A — Event-to-narration mapper
- Deterministic mapper: `renderNarration(events, settings)` as pure function
- Phrase library keyed by (phase, eventType)
- Settings: Quiet/Verbose + Operator tone toggle (affect phrasing only)
- No Date.now(), no Math.random(), no env variance

### S14.B — Live dashboard (mission control)
- Read-only view consuming event stream
- Displays: phase progress, evidence counter, last checkpoint, active agent, agent switching timeline
- Agent switching events first-class (manual vs auto)

### S14.C — Safety and accessibility
- Reduced motion: disable animations under prefers-reduced-motion
- Screen reader: aria-live for narration, semantic structure for dashboard
- View-layer boundary enforcement: no decision-state mutation

## Acceptance Tests

- [ ] AT-S14-01: Same event stream -> identical narration output
- [ ] AT-S14-02: Agent switching events render correctly and do not alter loop behavior
- [ ] AT-S14-03: Reduced motion mode passes and eliminates risky animations

## Evidence Bundles

- `docs/sprints/S14/evidence/jarvis/` — Narration determinism receipts
- `docs/sprints/S14/evidence/ui/` — Dashboard + agent switching receipts
- `docs/sprints/S14/evidence/a11y/` — Reduced motion receipts
- `docs/sprints/S14/evidence/untracked/` — Untracked files inventory + disposition

## Definition of Done

- All ATs pass with durable evidence
- All code within whitelist
- No new dependencies
- Narration is pure function of event stream + settings
- Dashboard is view-layer only (no decision mutation)
- Reduced motion deterministically handled
- PR merged to main
