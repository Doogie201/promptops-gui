import test from 'node:test';
import assert from 'node:assert';
import { BuildModeStateMachine } from '../../src/s18/build_mode/state_machine.ts';
import {
  assertAutoAdvanceApproved,
  buildHumanGateControlModel,
  recordHumanGateDecision,
  transitionWithHumanGate,
} from '../../src/s18/build_mode/human_gate_controls.ts';

test('S18-UXQ-03 human gates: requirements approval is explicit, recorded, and gates prompt transition', () => {
  const machine = new BuildModeStateMachine('planning');
  machine.transition('project_bootstrapped');
  machine.transition('requirements_ready');

  const pending = buildHumanGateControlModel({
    currentState: machine.currentState,
    records: [],
    requiredSequenceByGate: { requirements_approval: 1 },
  });

  assert.strictEqual(pending.currentGateId, 'requirements_approval');
  assert.strictEqual(pending.currentGateRequiredSequence, 1);
  assert.strictEqual(pending.currentGateSatisfied, false);
  assert.match(pending.rendered, /\[Requirements approval: pending\]/);
  assert.throws(
    () => transitionWithHumanGate(machine, 'prompt_ready', [], 1),
    /HUMAN_GATE_APPROVAL_REQUIRED:requirements_approval/,
  );

  const approval = recordHumanGateDecision({
    gateId: 'requirements_approval',
    decision: 'approved',
    actor: 'operator',
    sequence: 1,
    rationale: 'requirements reviewed',
    evidenceRefs: ['docs/sprints/S18/evidence/work_items/S18-UXQ-03_20260306_172212/23_acceptance_summary.json'],
  });

  assert.strictEqual(approval.gateId, 'requirements_approval');
  assert.strictEqual(approval.decision, 'approved');
  assert.ok(approval.sha256);
  assert.strictEqual(transitionWithHumanGate(machine, 'prompt_ready', [approval], 1), 'prompt_ready');
});

test('S18-UXQ-03 human gates: fresh delta approval is required for each loop-back cycle', () => {
  const priorApproval = recordHumanGateDecision({
    gateId: 'delta_approval',
    decision: 'approved',
    actor: 'operator',
    sequence: 1,
    rationale: 'delta accepted for cycle one',
  });
  const currentApproval = recordHumanGateDecision({
    gateId: 'delta_approval',
    decision: 'approved',
    actor: 'operator',
    sequence: 2,
    rationale: 'delta accepted for cycle two',
  });

  const machine = new BuildModeStateMachine('delta_required');
  assert.throws(
    () => transitionWithHumanGate(machine, 'prompt_ready', [priorApproval], 2),
    /HUMAN_GATE_APPROVAL_REQUIRED:delta_approval/,
  );

  const model = buildHumanGateControlModel({
    currentState: 'delta_required',
    records: [priorApproval],
    requiredSequenceByGate: { delta_approval: 2 },
  });

  assert.strictEqual(model.currentGateId, 'delta_approval');
  assert.strictEqual(model.currentGateRequiredSequence, 2);
  assert.strictEqual(model.currentGateSatisfied, false);
  assert.match(model.rendered, /\[Delta approval: pending\]/);
  assert.strictEqual(transitionWithHumanGate(machine, 'prompt_ready', [priorApproval, currentApproval], 2), 'prompt_ready');
});

test('S18-UXQ-03 human gates: auto-advance approval remains explicit at done state', () => {
  const pending = buildHumanGateControlModel({
    currentState: 'done',
    records: [],
    requiredSequenceByGate: { auto_advance_approval: 1 },
  });

  assert.strictEqual(pending.currentGateId, 'auto_advance_approval');
  assert.strictEqual(pending.currentGateRequiredSequence, 1);
  assert.strictEqual(pending.currentGateSatisfied, false);
  assert.match(pending.rendered, /\[Auto-advance approval: pending\]/);
  assert.throws(() => assertAutoAdvanceApproved([], 1), /HUMAN_GATE_APPROVAL_REQUIRED:auto_advance_approval/);

  const approved = recordHumanGateDecision({
    gateId: 'auto_advance_approval',
    decision: 'approved',
    actor: 'operator',
    sequence: 1,
    rationale: 'advance to next sprint',
  });

  const recorded = assertAutoAdvanceApproved([approved], 1);
  assert.strictEqual(recorded.decision, 'approved');
  assert.strictEqual(recorded.actor, 'operator');
  assert.throws(
    () => assertAutoAdvanceApproved([approved], 2),
    /HUMAN_GATE_APPROVAL_REQUIRED:auto_advance_approval/,
  );
});

test('S18-UXQ-03 human gates: duplicate gate sequence values are rejected as ambiguous', () => {
  const first = recordHumanGateDecision({
    gateId: 'requirements_approval',
    decision: 'approved',
    actor: 'operator',
    sequence: 1,
  });
  const duplicate = recordHumanGateDecision({
    gateId: 'requirements_approval',
    decision: 'rejected',
    actor: 'operator',
    sequence: 1,
  });

  assert.throws(
    () =>
      buildHumanGateControlModel({
        currentState: 'requirements_ready',
        records: [first, duplicate],
      }),
    /HUMAN_GATE_SEQUENCE_COLLISION:requirements_approval:1/,
  );
});
