import test from 'node:test';
import assert from 'node:assert';
import { buildLoopStepperModel } from '../../src/s18/build_mode/loop_stepper.ts';

test('S18-UXQ-02 stepper: renders canonical sequence with planning pinned first', () => {
  const model = buildLoopStepperModel({ currentState: 'planning' });

  assert.deepStrictEqual(
    model.steps.map((step) => step.id),
    ['planning', 'requirements', 'prompt', 'run', 'evaluate', 'outcome'],
  );
  assert.strictEqual(model.currentStepId, 'planning');
  assert.strictEqual(model.currentPinLabel, '[Planning]');
  assert.strictEqual(model.rendered, '[Planning] -> Requirements -> Prompt -> Run -> Evaluate -> Delta/Done');
});

test('S18-UXQ-02 stepper: pins requirements and prompt states deterministically', () => {
  const requirements = buildLoopStepperModel({ currentState: 'requirements_ready' });
  const prompt = buildLoopStepperModel({ currentState: 'prompt_ready' });

  assert.strictEqual(requirements.currentStepId, 'requirements');
  assert.strictEqual(requirements.rendered, 'Planning -> [Requirements] -> Prompt -> Run -> Evaluate -> Delta/Done');
  assert.strictEqual(prompt.currentStepId, 'prompt');
  assert.strictEqual(prompt.rendered, 'Planning -> Requirements -> [Prompt] -> Run -> Evaluate -> Delta/Done');
});

test('S18-UXQ-02 stepper: pins delta outcome and exposes loop-back target', () => {
  const model = buildLoopStepperModel({ currentState: 'delta_required' });

  assert.strictEqual(model.currentStepId, 'outcome');
  assert.strictEqual(model.outcome, 'delta');
  assert.strictEqual(model.loopBackTarget, 'prompt');
  assert.strictEqual(model.rendered, 'Planning -> Requirements -> Prompt -> Run -> Evaluate -> [Delta]/Done');
});

test('S18-UXQ-02 stepper: pins done outcome without delta loop-back', () => {
  const model = buildLoopStepperModel({ currentState: 'done' });

  assert.strictEqual(model.currentStepId, 'outcome');
  assert.strictEqual(model.outcome, 'done');
  assert.strictEqual(model.loopBackTarget, null);
  assert.strictEqual(model.rendered, 'Planning -> Requirements -> Prompt -> Run -> Evaluate -> Delta/[Done]');
});

test('S18-UXQ-02 stepper: blocked state requires context and preserves current-state pin', () => {
  assert.throws(() => buildLoopStepperModel({ currentState: 'blocked' }), /LOOP_STEPPER_BLOCKED_CONTEXT_REQUIRED/);

  const blocked = buildLoopStepperModel({
    currentState: 'blocked',
    blockedFromState: 'evaluating',
  });

  assert.strictEqual(blocked.blocked, true);
  assert.strictEqual(blocked.currentStepId, 'evaluate');
  assert.strictEqual(blocked.currentPinLabel, '[Evaluate]');
  assert.strictEqual(blocked.rendered, 'Planning -> Requirements -> Prompt -> Run -> [Evaluate] -> Delta/Done | BLOCKED');
});
