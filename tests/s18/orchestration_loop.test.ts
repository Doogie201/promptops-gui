import test from 'node:test';
import assert from 'node:assert';
import { BuildModeStateMachine } from '../../src/s18/build_mode/state_machine.ts';
import { applyEvaluationVerdict } from '../../src/s18/build_mode/orchestrator.ts';

function moveToEvaluating(machine: BuildModeStateMachine): void {
  machine.transition('project_bootstrapped');
  machine.transition('requirements_ready');
  machine.transition('prompt_ready');
  machine.transition('awaiting_agent_output');
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
