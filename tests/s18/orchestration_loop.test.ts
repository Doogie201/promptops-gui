import test from 'node:test';
import assert from 'node:assert';
import { buildProjectContextArtifact } from '../../src/s18/build_mode/project_bootstrap.ts';
import { generateSprintRequirements } from '../../src/s18/build_mode/planner.ts';
import { compilePromptFromRequirements } from '../../src/s18/build_mode/prompt_compiler.ts';
import { buildDiffFirstDeltaReview } from '../../src/s18/build_mode/delta_review.ts';
import { applyEvaluationVerdict, dispatchPromptWithDeltaReview } from '../../src/s18/build_mode/orchestrator.ts';
import { BuildModeStateMachine } from '../../src/s18/build_mode/state_machine.ts';

const TICKET_TEMPLATE = JSON.stringify({
  sprint_id: '{{sprint_id}}',
  project_name: '{{project_name}}',
  repo_root: '{{repo_root}}',
  repo_root_strategy: '{{repo_root_strategy}}',
  requirements_json: '{{requirements_json}}',
  requirements_hash: '{{requirements_hash}}',
});

function buildArtifacts(repoRoot: string, sprintTemplateText: string) {
  const projectContext = buildProjectContextArtifact({
    ideaText: 'PromptOps orchestration dispatch',
    explicitRepoRoot: repoRoot,
  });
  const requirements = generateSprintRequirements({
    sprintId: 'S18',
    ideaText: 'Ship dispatch gate',
    sprintTemplateText,
    templateVersionHash: 'tmpl-orch-v1',
    projectContext,
  });
  const prompt = compilePromptFromRequirements({
    sprintId: 'S18',
    ticketTemplateBody: TICKET_TEMPLATE,
    ticketTemplateVersionHash: 'ticket-orch-v1',
    requirements,
    projectContext,
  });

  return { requirements, prompt };
}

function moveToEvaluating(machine: BuildModeStateMachine): void {
  const initial = buildArtifacts('/tmp/promptops/repo-l', '- Initial prompt');
  machine.transition('project_bootstrapped');
  machine.transition('requirements_ready');
  machine.transition('prompt_ready');
  dispatchPromptWithDeltaReview(
    machine,
    buildDiffFirstDeltaReview({
      currentRequirements: initial.requirements,
      currentPrompt: initial.prompt,
    }),
  );
  machine.transition('evaluating');
}

test('S18 orchestration: complete verdict reaches done', () => {
  const machine = new BuildModeStateMachine('planning');
  moveToEvaluating(machine);
  assert.strictEqual(applyEvaluationVerdict(machine, 'complete'), 'done');
});

test('S18 orchestration: delta verdict routes to delta_required then prompt_ready', () => {
  const machine = new BuildModeStateMachine('planning');
  moveToEvaluating(machine);
  assert.strictEqual(applyEvaluationVerdict(machine, 'delta'), 'delta_required');
  machine.transition('prompt_ready');
  assert.strictEqual(machine.currentState, 'prompt_ready');
});

test('S18 orchestration: needs_input verdict routes to blocked', () => {
  const machine = new BuildModeStateMachine('planning');
  moveToEvaluating(machine);
  assert.strictEqual(applyEvaluationVerdict(machine, 'needs_input'), 'blocked');
});

test('S18 orchestration: no-op delta review blocks dispatch before awaiting_agent_output', () => {
  const machine = new BuildModeStateMachine('planning');
  machine.transition('project_bootstrapped');
  machine.transition('requirements_ready');
  machine.transition('prompt_ready');

  const previous = buildArtifacts('/tmp/promptops/repo-m', '- Keep current requirement set');
  const noopReview = buildDiffFirstDeltaReview({
    previousRequirements: previous.requirements,
    currentRequirements: previous.requirements,
    previousPrompt: previous.prompt,
    currentPrompt: previous.prompt,
  });

  assert.throws(
    () => dispatchPromptWithDeltaReview(machine, noopReview),
    /DELTA_REVIEW_DISPATCH_BLOCKED/,
  );
  assert.strictEqual(machine.currentState, 'prompt_ready');
});
