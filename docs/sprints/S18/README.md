# S18 — Build Mode Orchestration (North-Star Loop)

## Sprint Header

| Field | Value |
|---|---|
| Sprint ID | S18 |
| Branch | sprint/S18-build-mode-orchestrator |
| Base | main |
| Objective | Make Build Mode primary for `Idea -> Sprint Requirements -> JSON Prompt -> Agent Run -> Evaluation -> Delta/Done -> Next Sprint`; keep Diagnostics Mode secondary. |

## Evidence Basis (Current-State Proof)

This spec is based on current code behavior, not assumptions:

- Browser entrypoint mounts blocked browser façade: `src/s17/main.ts`, `src/s17/operator_api_browser.ts`.
- S17 dashboard cards are diagnostic actions (`preflight`, `gates`, `pr_inventory`, `run_status`): `src/s17/dashboard_app.ts`.
- Node façade routes to S10 operator tools (diagnostic/control-plane focus): `src/s17/operator_api_node.ts`, `src/s10/operator_tools.ts`.
- Existing deterministic building blocks already exist and must be reused:
  - Template compile/validation/registry safety: `engine/templates/compiler.ts`, `engine/templates/validator.ts`, `engine/templates/registry.ts`, `engine/templates/safety.ts`.
  - Deterministic run store + event hashing: `engine/store.ts`, `engine/events/schema.ts`.
  - Evaluator + delta ticketing: `engine/evaluator.ts`.
  - Continuity packet + checkpoint handoff: `src/s08/contract.ts`, `src/s08/continuity_packet.ts`, `src/s08/switching.ts`.

## Product Shape (North Star)

### Project Bootstrap (Before Loop)

Before any sprint loop starts, PromptOps must establish deterministic project context:

1. Generate a default `projectName` from idea text (deterministic slugging).
2. Allow user override for `projectName`.
3. Require user confirmation of project working directory (`repoRoot`) for this project.
4. Persist `projectName + repoRoot + repoRootStrategy` as first-class artifacts.
5. Inject project working directory context into every generated JSON prompt sent to agent tooling.

### Primary Mode: Build Mode

Build Mode must execute the product loop end-to-end:

1. User provides `Idea`.
2. System establishes project bootstrap context (`projectName`, `repoRoot`, strategy).
3. System generates `Sprint Requirements` from `Idea + Sprint Template`.
4. System compiles `JSON Prompt` from `Sprint Requirements + Template`.
5. System dispatches prompt to configured agent path.
6. System evaluates `Agent Output` against `Sprint Requirements`.
7. If incomplete, system generates `Delta Prompt` from `Template` and loops.
8. If complete, marks sprint done and requests next sprint input/approval.

### Secondary Mode: Diagnostics Mode

Keep preflight/drift/gates/repair features available, but they must not replace Build Mode as primary UX.

## Queued Workflow UX Additions (Requested)

The following items are now explicitly queued under S18 governance so they are not lost and can be executed as tracked work items when prioritized:

1. `S18-UXQ-01` Guided first-run wizard
   - Capture idea input, project name (auto + manual override), and repo-root confirmation in one deterministic onboarding flow.
   - Status: implemented.
   - Evidence: `docs/sprints/S18/evidence/work_items/S18-UXQ-01_20260306_153142/`.
2. `S18-UXQ-02` Visual loop stepper
   - Render `planning -> requirements -> prompt -> run -> evaluate -> delta/done` with a pinned current state.
   - Status: implemented.
   - Evidence: `docs/sprints/S18/evidence/work_items/S18-UXQ-02_20260306_162409/`.
3. `S18-UXQ-03` Human gates in-flow
   - Implemented in `src/s18/build_mode/human_gate_controls.ts` with evidence at `docs/sprints/S18/evidence/work_items/S18-UXQ-03_20260306_172212/`.
4. `S18-UXQ-04` Diff-first delta review
   - Implemented in `src/s18/build_mode/delta_review.ts`.
   - Dispatch enforcement lives in `src/s18/build_mode/orchestrator.ts`.
   - Evidence: `docs/sprints/S18/evidence/work_items/S18-UXQ-04_20260306_194829/`.
5. `S18-UXQ-05` One-click replay/resume
   - Implemented in `src/s18/build_mode/replay_resume.ts` with evidence at `docs/sprints/S18/evidence/work_items/S18-UXQ-05_20260306_202359/`.
6. `S18-UXQ-06` Scope guard UX
   - Implemented in `src/s18/build_mode/scope_guard.ts`.
   - Dispatch enforcement lives in `src/s18/build_mode/orchestrator.ts`.
   - Evidence: `docs/sprints/S18/evidence/work_items/S18-UXQ-06_20260306_210115/`.
7. `S18-UXQ-07` Deterministic timeline pane
   - Implemented in `src/s18/build_mode/timeline_pane.ts`.
   - Evidence: `docs/sprints/S18/evidence/work_items/S18-UXQ-07_20260306_222746/`.

Execution policy:

- These items are queued in machine-readable contract metadata (`workflow_experience_queue`) with owner, milestone target, and acceptance hooks.
- No item is considered complete unless associated acceptance tests and evidence artifacts are present.
- `S18-UXQ-01` is the first completed queue item and is now enforced by code via `tests/s18/first_run_wizard.test.ts`.

## App Development Milestones (Product Roadmap)

### M0 — Deterministic Foundation

- Contracts, state machine, artifact schema, hash policy, replay policy.
- Exit criteria:
  - Contracts compile and validate.
  - Illegal transitions rejected.
  - Replay hash parity tests pass.

### M1 — Build Mode Vertical Slice

- Idea intake, project bootstrap, requirements generation, prompt compile.
- Exit criteria:
  - `Idea -> Sprint Requirements -> JSON Prompt` runs in GUI.
  - Project context is persisted and visible.
  - JSON prompt includes explicit working-directory context.

### M2 — Agent Loop + Delta Automation

- Agent run dispatch, output ingestion, evaluator verdict, delta generation loop.
- Exit criteria:
  - `complete` and `delta_required` both exercised by tests.
  - Delta generation is deterministic and evidence-backed.

### M3 — Resume/Migration Safety

- Checkpoint restore, continuity packet replay, run resume without memory.
- Exit criteria:
  - Resume from artifacts only reproduces prior verdict/hash.
  - Explicit migration event required for repo-root/template changes.

### M4 — UX/PM Operator Console

- Build Mode cockpit, roadmap progress, guardrail transparency, approval gates.
- Exit criteria:
  - User can see milestone status, sprint status, blockers, next action.
  - Human approval checkpoints are explicit and recorded.

### M5 — Release Hardening

- CI enforcement complete, regression packs, release checklist and rollback.
- Exit criteria:
  - Required CI gates all enforce contracts.
  - Release candidate can be replayed deterministically.

## Versioning Strategy

### App Versioning

- Use SemVer for app release tags (`MAJOR.MINOR.PATCH`).
- `MAJOR`: breaking contract/state changes.
- `MINOR`: new backward-compatible workflow capabilities.
- `PATCH`: bug fixes/no contract break.

### Contract Versioning

- Contract file is versioned (`s18.contracts.v1`).
- Any breaking schema/state transition changes require `v2+` contract and migration notes.

### Template Versioning

- Sprint Template and Ticket Template are immutable-by-version with content hash pinning.
- Runs/sprints reference template version hash; no silent float.

### Evidence Versioning

- Evidence bundles are immutable snapshots by timestamp.
- Replay/certification references exact bundle path + hash.

## Scope Control / Anti-Creep Policy

### In-Scope Lock

- Each sprint has a locked scope map (features + paths + tests + receipts).
- Any work outside lock requires explicit Scope Change Request (SCR) artifact.

### Scope Change Request (SCR) Contract

- Required fields:
  - `change_id`
  - `requested_by`
  - `reason`
  - `impact_on_scope`
  - `files_affected`
  - `risk_level`
  - `approval_decision`
- Without approved SCR, out-of-scope changes are hard-stop failures.

### Scope Drift Detection

- CI compares diff names against allowlist.
- Any unexpected file touch fails with scope violation.
- Scope exceptions must be documented in sprint README + PR body + receipts.

## Operator Control Locks (Enforced)

S18 now codifies hard controls to prevent low-quality or memory-driven execution patterns:

1. Gap-proof before net-new code:
   - A gap-proof artifact is required before claiming net-new implementation work.
   - Claims must be grounded in repository evidence, not chat memory.
2. Scope allowlist lock:
   - Commit-level scope is checked against machine allowlist from contracts.
   - Out-of-scope file changes require approved SCR evidence.
3. No-god-file and maintainability budgets:
   - Max file LOC and max function length are enforced for `src/s18/**`.
   - Human-readable guardrails are enforced (no excessive line length / nested ternary abuse).
4. Receipt-index lock:
   - PASS/FAIL style status claims require an evidence index with command receipts.
5. Determinism lock:
   - Non-deterministic APIs (`Date.now`, `Math.random`) fail policy checks in S18 code.

## Definition of Done (Layered)

### Sprint DoD

- Acceptance tests pass with durable evidence.
- Required gates pass (lint/test/build/verify).
- Scope and maintainability budgets pass.
- PR checks green and review threads resolved.

### Milestone DoD

- All milestone exit criteria met.
- Regression suite includes milestone features.
- Replay and migration tests pass for impacted workflows.

### Release DoD

- Contract/version compatibility documented.
- Rollback plan and restore test validated.
- Operator runbook updated for Build Mode lifecycle.

## Deterministic Invariants (Mandatory)

- No decision depends on chat memory.
- Every transition must be reconstructible from persisted artifacts.
- All critical payloads are canonical JSON with SHA256.
- Same input hashes + same template versions + same state snapshot must produce byte-identical outputs.
- No `Date.now`/`Math.random` in decision-critical transforms.
- Project context is explicit and immutable per run unless migration is explicitly recorded.
- Generated agent JSON prompts must carry migration-safe repo-root metadata (`repoRoot` + strategy), never inferred from memory.

## Contracts (To Implement)

Machine-readable contract baseline: `docs/sprints/S18/contracts_v1.json`.

Code contracts to add:

- `src/s18/contracts/workflow.ts`
- `src/s18/contracts/artifacts.ts`
- `src/s18/contracts/state.ts`

Required contract surface:

```ts
export type BuildModeState =
  | 'planning'
  | 'project_bootstrapped'
  | 'requirements_ready'
  | 'prompt_ready'
  | 'awaiting_agent_output'
  | 'evaluating'
  | 'delta_required'
  | 'done'
  | 'blocked';

export interface IdeaInput {
  ideaId: string;
  text: string;
  constraints: string[];
}

export interface ProjectContextArtifact {
  projectId: string;
  projectName: string;
  projectNameSource: 'auto' | 'manual';
  repoRoot: string;
  repoRootStrategy: 'explicit_input' | 'env_PROMPTOPS_REPO';
  sha256: string;
}

export interface SprintRequirementsArtifact {
  sprintId: string;
  projectId: string;
  projectName: string;
  repoRoot: string;
  templateVersionHash: string;
  requirements: Array<{ id: string; text: string; acceptance: string[] }>;
  canonicalJson: string;
  sha256: string;
}

export interface PromptArtifact {
  sprintId: string;
  projectId: string;
  projectName: string;
  repoRoot: string;
  repoRootStrategy: 'explicit_input' | 'env_PROMPTOPS_REPO';
  requirementsHash: string;
  templateVersionHash: string;
  promptJson: string;
  sha256: string;
}

export interface AgentRunArtifact {
  runId: string;
  sprintId: string;
  promptHash: string;
  adapter: 'codex' | 'claude';
  rawOutputPath: string;
  normalizedOutputPath: string;
  sha256: string;
}

export interface EvaluationArtifact {
  sprintId: string;
  runId: string;
  verdict: 'complete' | 'delta' | 'needs_input';
  ledgerPath: string;
  deltaPromptPath?: string;
  sha256: string;
}

export interface TransitionReceipt {
  transitionId: string;
  from: BuildModeState;
  to: BuildModeState;
  inputHashes: string[];
  outputHashes: string[];
  receiptPaths: string[];
  exitCode: number;
}
```

## Folder Layout (Target)

```text
src/s18/
  build_mode/
    project_bootstrap.ts       # projectName + repoRoot capture and validation
    planner.ts                 # Idea -> Sprint Requirements
    prompt_compiler.ts         # Sprint Requirements + Template -> JSON Prompt
    orchestrator.ts            # dispatch/evaluate/loop controller
    state_machine.ts           # explicit BuildModeState transitions
    checkpoints.ts             # checkpoint writer/loader
    hash.ts                    # canonical hashing wrappers
  contracts/
    workflow.ts
    artifacts.ts
    state.ts
  ui/
    build_mode_app.ts          # primary product UX
    components/
      idea_intake.ts
      requirements_review.ts
      prompt_preview.ts
      run_loop_panel.ts
      verdict_panel.ts
  facade/
    operator_bridge.ts         # strict boundary to existing executor/tools

tests/s18/
  project_bootstrap.test.ts
  repo_root_injection.test.ts
  contracts.test.ts
  state_machine.test.ts
  planner_determinism.test.ts
  compiler_determinism.test.ts
  orchestration_loop.test.ts
  replay_resume.test.ts
  ci_policy.test.ts

docs/sprints/S18/
  README.md
  contracts_v1.json
  evidence/
    preflight/
    at/
    gates/
    scope/
    stoplight/
    maintainability/
    pr/
```

## Reuse Plan (No Parallel Universe)

S18 must reuse and wrap existing modules:

- Template compile/validation: `engine/templates/*`
- Evaluator and delta generation: `engine/evaluator.ts`
- Run store/event serialization: `engine/store.ts`, `engine/events/schema.ts`
- Continuity packet/handoff semantics: `src/s08/*`
- Command receipts + policy checks: `src/s10/*`

No duplicate evaluator/compiler paths are allowed.

## CI Enforcement Plan (Required in S18 Implementation)

### Package Scripts

Add these scripts in implementation:

- `test:s18`: run all `tests/s18/*.test.ts`
- `verify:s18`: run deterministic policy checks for Build Mode contracts + replay parity

### Verify Pipeline

Update `scripts/verify.sh` to include S18 contract/replay checks in `all` mode.

### GitHub Actions

Update `.github/workflows/verify.yml` to ensure S18 checks execute on PR and push.

### Failing Conditions (Must Break CI)

- Non-deterministic replay hash mismatch.
- Illegal state transition accepted by state machine.
- Delta generated without evaluator evidence.
- Build Mode output missing required artifact hash/receipt paths.
- Forbidden direct UI imports bypassing façade.
- Missing `projectName`/`repoRoot`/`repoRootStrategy` in required Build Mode artifacts.
- Generated JSON prompt missing explicit working-directory context for agent execution.
- Milestone exit criteria not met for targeted milestone.
- Scope change without approved SCR artifact.

## Acceptance Tests (Sprint Gate)

- [ ] **AT-S18-01 Deterministic Requirements Generation**
  - Same `Idea + Sprint Template` yields byte-identical `Sprint Requirements` and same hash.
- [ ] **AT-S18-02 Deterministic Prompt Compilation**
  - Same `Sprint Requirements + Template` yields byte-identical JSON prompt and same hash.
- [ ] **AT-S18-03 Loop Completion Semantics**
  - Evaluation produces `done` when complete; otherwise emits deterministic delta prompt and transitions to `delta_required`.
- [ ] **AT-S18-04 Replay/Resume Without Memory**
  - Rebuild state from checkpoint artifacts only; result equals original run verdict/hash.
- [ ] **AT-S18-05 Diagnostics Isolation**
  - Diagnostics actions remain available but cannot mutate Build Mode decision state without explicit recorded transition.
- [ ] **AT-S18-06 CI Enforcement**
  - Introduce deliberate contract violation fixture; CI fails deterministically.
- [ ] **AT-S18-07 Project Bootstrap**
  - Deterministic auto-generated project name from idea, with auditable manual override path.
- [ ] **AT-S18-08 Working Directory Propagation**
  - Generated JSON prompt includes explicit project working-directory context and repo-root strategy.

## Stoplight / Policy Checks (S18 additions)

Add S18-specific checks:

- Forbidden direct imports from UI into deep engine/adapters except allowed façade.
- `Date.now|Math.random` in `src/s18/**` decision code.
- Hardcoded absolute paths in `src/s18/**`.
- Missing hash/receipt fields in persisted S18 artifacts.
- Missing milestone metadata in sprint status artifacts.
- Scope changes lacking SCR evidence entry.

## Meta Operator-Grade Additions (UX + Product Management)

### UX Additions

- Build Mode onboarding wizard with explicit project bootstrap and template selection.
- Progress map view: Idea -> Requirements -> Prompt -> Agent -> Evaluate -> Delta/Done.
- Human gate panel with approve/reject, rationale capture, and audit trail.
- Deterministic activity timeline with artifact hash links and replay entrypoint.
- Side-by-side diff views for requirements, prompt, and delta prompt evolution.
- Visual design system pass: theme tokens, typography scale, spacing rhythm, motion reduced-mode parity.

### PM Additions

- Milestone burndown and sprint progress KPI panel (cycle time, delta count, pass ratio).
- Risk register per sprint (blocking risks, owner, mitigation, due date).
- Change log generated from transition receipts (not manual notes).
- Forecasting panel for remaining sprint backlog from current delta velocity.
- Release readiness checklist auto-generated from DoD and CI state.

## Evidence Plan

Durable evidence root: `docs/sprints/S18/evidence/`

- `preflight/` repo-root + git hygiene receipts
- `at/` AT-S18-01..06 receipts
- `gates/` lint/test/build/s18 checks
- `scope/` whitelist + budget checks
- `stoplight/` marker lists + grep outputs
- `pr/` readiness/checks/threads/stability receipts

## Definition of Done

- Build Mode loop is primary UX path and executes end-to-end with receipts.
- All S18 ATs pass with durable evidence.
- CI enforces deterministic contracts and replay checks.
- Diagnostics Mode remains functional as secondary support path.
