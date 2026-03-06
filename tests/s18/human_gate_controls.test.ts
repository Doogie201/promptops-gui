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
  });

  assert.strictEqual(pending.currentGateId, 'requirements_approval');
  assert.strictEqual(pending.currentGateSatisfied, false);
  assert.match(pending.rendered, /\[Requirements approval: pending\]/);
  assert.throws(
    () => transitionWithHumanGate(machine, 'prompt_ready', []),
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
  assert.strictEqual(transitionWithHumanGate(machine, 'prompt_ready', [approval]), 'prompt_ready');
});

test('S18-UXQ-03 human gates: latest recorded delta approval governs loop-back', () => {
  const rejected = recordHumanGateDecision({
    gateId: 'delta_approval',
    decision: 'rejected',
    actor: 'operator',
    sequence: 1,
    rationale: 'delta needs refinement',
  });
  const approved = recordHumanGateDecision({
    gateId: 'delta_approval',
    decision: 'approved',
    actor: 'operator',
    sequence: 2,
    rationale: 'delta accepted after review',
  });

  const machine = new BuildModeStateMachine('delta_required');
  assert.throws(
    () => transitionWithHumanGate(machine, 'prompt_ready', [rejected]),
    /HUMAN_GATE_APPROVAL_REQUIRED:delta_approval/,
  );

  const model = buildHumanGateControlModel({
    currentState: 'delta_required',
    records: [rejected, approved],
  });

  assert.strictEqual(model.currentGateId, 'delta_approval');
  assert.strictEqual(model.currentGateSatisfied, true);
  assert.match(model.rendered, /\[Delta approval: approved\]/);
  assert.strictEqual(transitionWithHumanGate(machine, 'prompt_ready', [rejected, approved]), 'prompt_ready');
});

test('S18-UXQ-03 human gates: auto-advance approval remains explicit at done state', () => {
  const pending = buildHumanGateControlModel({
    currentState: 'done',
    records: [],
  });

  assert.strictEqual(pending.currentGateId, 'auto_advance_approval');
  assert.strictEqual(pending.currentGateSatisfied, false);
  assert.match(pending.rendered, /\[Auto-advance approval: pending\]/);
  assert.throws(() => assertAutoAdvanceApproved([]), /HUMAN_GATE_APPROVAL_REQUIRED:auto_advance_approval/);

  const approved = recordHumanGateDecision({
    gateId: 'auto_advance_approval',
    decision: 'approved',
    actor: 'operator',
    sequence: 1,
    rationale: 'advance to next sprint',
  });

  const recorded = assertAutoAdvanceApproved([approved]);
  assert.strictEqual(recorded.decision, 'approved');
  assert.strictEqual(recorded.actor, 'operator');
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
