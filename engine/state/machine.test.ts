import test from 'node:test';
import * as assert from 'node:assert';
import { RunStateMachine } from './machine';

test('valid transitions', () => {
  const machine = new RunStateMachine();
  assert.strictEqual(machine.currentPhase, 'IDLE');
  machine.transition('START');
  assert.strictEqual(machine.currentPhase, 'RUNNING');
  machine.transition('COMPLETE');
  assert.strictEqual(machine.currentPhase, 'DONE');
  machine.transition('RESET');
  assert.strictEqual(machine.currentPhase, 'IDLE');
});

test('illegal transitions throw explicitly', () => {
  const machine = new RunStateMachine();
  assert.throws(() => {
    machine.transition('COMPLETE');
  }, /Illegal transition: cannot process event 'COMPLETE' while in phase 'IDLE'/);
});
