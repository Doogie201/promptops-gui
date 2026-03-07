import test from 'node:test';
import assert from 'node:assert';
import { buildDeterministicTimelinePane } from '../../src/s18/build_mode/timeline_pane.ts';

function buildTransitions() {
  return [
    {
      transitionId: 'tr-001',
      from: 'planning',
      to: 'project_bootstrapped',
      inputHashes: ['idea-a'],
      outputHashes: ['project-a'],
      receiptPaths: ['docs/sprints/S18/evidence/preflight/01_preflight.txt'],
      evidencePaths: ['docs/sprints/S18/evidence/at/AT-S18-01.json'],
      checkpointId: 'cp-001',
      checkpointPath: './artifacts/checkpoints/cp-001/checkpoint.json',
      exitCode: 0,
    },
    {
      transitionId: 'tr-002',
      from: 'project_bootstrapped',
      to: 'requirements_ready',
      inputHashes: ['project-a'],
      outputHashes: ['requirements-a'],
      receiptPaths: [
        './docs/sprints/S18/evidence/gates/verify.txt',
        'docs/sprints/S18/evidence/gates/verify.txt',
      ],
      evidencePaths: [
        'docs/sprints/S18/evidence/at/AT-S18-02.json',
        './docs/sprints/S18/evidence/at/AT-S18-02.json',
      ],
      checkpointId: 'cp-002',
      checkpointPath: './artifacts/checkpoints/cp-002/checkpoint.json',
      exitCode: 0,
    },
    {
      transitionId: 'tr-003',
      from: 'requirements_ready',
      to: 'blocked',
      inputHashes: ['requirements-a'],
      outputHashes: ['blocked-a'],
      receiptPaths: ['docs/sprints/S18/evidence/gates/verify_fail.txt'],
      evidencePaths: ['docs/sprints/S18/evidence/at/AT-S18-03.json'],
      exitCode: 17,
    },
  ] as const;
}

test('S18-UXQ-07 timeline pane: repeated input yields identical hash and rendered output', () => {
  const first = buildDeterministicTimelinePane({
    currentState: 'blocked',
    transitions: buildTransitions(),
  });
  const second = buildDeterministicTimelinePane({
    currentState: 'blocked',
    transitions: buildTransitions(),
  });

  assert.strictEqual(first.sha256, second.sha256);
  assert.strictEqual(first.rendered, second.rendered);
  assert.strictEqual(first.currentTransitionId, 'tr-003');
  assert.strictEqual(first.currentSequence, 3);
  assert.strictEqual(first.lastCheckpointId, 'cp-002');
});

test('S18-UXQ-07 timeline pane: each transition links receipts, evidence paths, and checkpoints', () => {
  const model = buildDeterministicTimelinePane({
    currentState: 'requirements_ready',
    transitions: buildTransitions().slice(0, 2),
  });

  assert.strictEqual(model.totalTransitions, 2);
  assert.strictEqual(model.currentTransitionId, 'tr-002');
  assert.strictEqual(model.currentSequence, 2);
  assert.strictEqual(model.lastCheckpointId, 'cp-002');

  const latest = model.entries[1];
  assert.deepStrictEqual(latest.receiptPaths, ['docs/sprints/S18/evidence/gates/verify.txt']);
  assert.deepStrictEqual(latest.evidencePaths, ['docs/sprints/S18/evidence/at/AT-S18-02.json']);
  assert.deepStrictEqual(
    latest.links.map((entry) => `${entry.kind}:${entry.path}`),
    [
      'receipt:docs/sprints/S18/evidence/gates/verify.txt',
      'evidence:docs/sprints/S18/evidence/at/AT-S18-02.json',
      'checkpoint:artifacts/checkpoints/cp-002/checkpoint.json',
    ],
  );
  assert.match(latest.rendered, /receipts: docs\/sprints\/S18\/evidence\/gates\/verify\.txt/);
  assert.match(model.rendered, /checkpoint: artifacts\/checkpoints\/cp-002\/checkpoint\.json/);
});

test('S18-UXQ-07 timeline pane: empty transitions remain deterministic and explicit', () => {
  const model = buildDeterministicTimelinePane({
    currentState: 'planning',
    transitions: [],
  });

  assert.strictEqual(model.currentTransitionId, null);
  assert.strictEqual(model.currentSequence, null);
  assert.strictEqual(model.lastCheckpointId, null);
  assert.strictEqual(model.totalLinks, 0);
  assert.strictEqual(model.rendered, 'Timeline empty | current=planning');
});

test('S18-UXQ-07 timeline pane: invalid transition inputs are rejected deterministically', () => {
  assert.throws(
    () =>
      buildDeterministicTimelinePane({
        currentState: 'requirements_ready',
        transitions: [
          {
            transitionId: 'dup',
            from: 'planning',
            to: 'project_bootstrapped',
            inputHashes: [],
            outputHashes: [],
            receiptPaths: ['docs/sprints/S18/evidence/preflight/01.txt'],
            exitCode: 0,
          },
          {
            transitionId: 'dup',
            from: 'project_bootstrapped',
            to: 'requirements_ready',
            inputHashes: [],
            outputHashes: [],
            receiptPaths: ['docs/sprints/S18/evidence/preflight/02.txt'],
            exitCode: 0,
          },
        ],
      }),
    /TIMELINE_PANE_TRANSITION_ID_COLLISION:dup/,
  );

  assert.throws(
    () =>
      buildDeterministicTimelinePane({
        currentState: 'project_bootstrapped',
        transitions: [
          {
            transitionId: 'missing-receipts',
            from: 'planning',
            to: 'project_bootstrapped',
            inputHashes: [],
            outputHashes: [],
            receiptPaths: [],
            exitCode: 0,
          },
        ],
      }),
    /TIMELINE_PANE_RECEIPTS_REQUIRED:missing-receipts/,
  );
});
