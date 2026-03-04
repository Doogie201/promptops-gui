# Sprint S09: GUI Shell v1 + Setup Wizard + Agent Switching

## Objective
Deliver macOS GUI shell v1 with Setup Wizard that pins Template/Task via versioned edits, plus Run controls and agent auto/manual switching UI with an operator-console navigation skeleton.

## Work Plan
- S09.A App shell + navigation skeleton: Home, Run, History, Evidence, Templates, Agents, Settings, Diagnostics with deterministic back/forward behavior.
- S09.B/S09.C Setup Wizard: capture repo/operator defaults, policy bundle, versioned template/task pins, sprint requirements intake with sprint ID inference and sprint-scoped placeholder prompts.
- S09.D Run controls: Start/Pause/Resume/Cancel/Safe Mode with active phase, current agent, checkpoint, continuity hash, and waiting reason.
- S09.E Agent switching UI model: manual switch checkpoint + continuity hash chain, auto-switch triggers and reason log, and adapter health indicators.
- S09.F Evidence viewer model: receipts list with command + exit code + open raw output path + durable evidence links.

## Acceptance Tests
- AT-S09-01: Fresh install -> wizard -> paste Sprint Requirements only -> Run reaches agent invocation step without asking Template/Task again.
- AT-S09-02: Manual switch UI produces continuity packet/hash and resumes on secondary agent without rework.
- AT-S09-03: Cancel + resume determinism from last checkpoint with byte-stable resume payload.

## Definition of Done
- Repo-root preflight receipts prove migration-safe root resolution and git integrity checks.
- Open PR protocol disposition is recorded before sprint changes.
- S09 model code and tests pass with receipts, including navigation determinism, wizard gating, run controls, switching, and evidence-view behavior.
- Durable evidence is stored under `docs/sprints/S09/evidence/` (EVD-S09-01 + EVD-S09-02).

## Evidence Paths
- EVD-S09-01: `docs/sprints/S09/evidence/EVD-S09-01/`
- EVD-S09-02: `docs/sprints/S09/evidence/EVD-S09-02/`
- Staging: `/tmp/promptops/S09/<RUN_ID>/`
