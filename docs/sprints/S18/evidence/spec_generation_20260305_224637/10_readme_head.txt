CMD: sed -n '1,220p' docs/sprints/S18/README.md
# S18 — Build Mode Orchestration (North-Star Loop)

## Sprint Header

| Field | Value |
|---|---|
| Sprint ID | S18 |
| Branch | sprint/S18-build-mode-orchestrator |
| Base | main |
| Objective | Make Build Mode the primary product path: `Idea -> Sprint Requirements -> JSON Prompt -> Agent Run -> Evaluation -> Delta/Done -> Next Sprint`, while retaining Diagnostics Mode as secondary tooling. |

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

### Primary Mode: Build Mode

Build Mode must execute the product loop end-to-end:

1. User provides `Idea`.
2. System generates `Sprint Requirements` from `Idea + Sprint Template`.
3. System compiles `JSON Prompt` from `Sprint Requirements + Template`.
4. System dispatches prompt to configured agent path.
5. System evaluates `Agent Output` against `Sprint Requirements`.
6. If incomplete, system generates `Delta Prompt` from `Template` and loops.
7. If complete, marks sprint done and requests next sprint input/approval.

### Secondary Mode: Diagnostics Mode

Keep preflight/drift/gates/repair features available, but they must not replace Build Mode as primary UX.

## Deterministic Invariants (Mandatory)

- No decision depends on chat memory.
- Every transition must be reconstructible from persisted artifacts.
- All critical payloads are canonical JSON with SHA256.
- Same input hashes + same template versions + same state snapshot must produce byte-identical outputs.
- No `Date.now`/`Math.random` in decision-critical transforms.

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

export interface SprintRequirementsArtifact {
  sprintId: string;
  templateVersionHash: string;
  requirements: Array<{ id: string; text: string; acceptance: string[] }>;
  canonicalJson: string;
  sha256: string;
}

export interface PromptArtifact {
  sprintId: string;
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

## Acceptance Tests (Sprint Gate)

- [ ] **AT-S18-01 Deterministic Requirements Generation**
  - Same `Idea + Sprint Template` yields byte-identical `Sprint Requirements` and same hash.
- [ ] **AT-S18-02 Deterministic Prompt Compilation**
  - Same `Sprint Requirements + Template` yields byte-identical JSON prompt and same hash.
- [ ] **AT-S18-03 Loop Completion Semantics**
  - Evaluation produces `done` when complete; otherwise emits deterministic delta prompt and transitions to `delta_required`.
- [ ] **AT-S18-04 Replay/Resume Without Memory**
  - Rebuild state from checkpoint artifacts only; result equals original run verdict/hash.
EXIT_CODE: 0
