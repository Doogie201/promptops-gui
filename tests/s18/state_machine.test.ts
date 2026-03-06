import test from 'node:test';
import assert from 'node:assert';
import { applyEvaluationVerdict } from '../../src/s18/build_mode/orchestrator.ts';
import { BuildModeStateMachine, isAllowedTransition } from '../../src/s18/build_mode/state_machine.ts';

test('S18 state machine: legal path reaches done', () => {
  const machine = new BuildModeStateMachine('planning');
  machine.transition('project_bootstrapped');
  machine.transition('requirements_ready');
  machine.transition('prompt_ready');
  machine.transition('awaiting_agent_output');
  machine.transition('evaluating');
  const state = applyEvaluationVerdict(machine, 'complete');
  assert.strictEqual(state, 'done');
});

test('S18 state machine: delta verdict loops back via delta_required', () => {
  const machine = new BuildModeStateMachine('planning');
  machine.transition('project_bootstrapped');
  machine.transition('requirements_ready');
  machine.transition('prompt_ready');
  machine.transition('awaiting_agent_output');
  machine.transition('evaluating');

  const state = applyEvaluationVerdict(machine, 'delta');
  assert.strictEqual(state, 'delta_required');
  machine.transition('prompt_ready');
  assert.strictEqual(machine.currentState, 'prompt_ready');
});

test('S18 state machine: illegal transitions are rejected', () => {
  assert.strictEqual(isAllowedTransition('planning', 'done'), false);
  const machine = new BuildModeStateMachine('planning');
  assert.throws(() => machine.transition('done'), /Illegal transition/);
});
