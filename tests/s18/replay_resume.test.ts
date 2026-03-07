import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { loadCheckpoint, writeCheckpoint } from '../../src/s18/build_mode/checkpoints.ts';
import { stableHash } from '../../src/s18/build_mode/hash.ts';
import {
  buildReplayResumeModel,
  resumeStateMachineFromArtifactBundle,
} from '../../src/s18/build_mode/replay_resume.ts';

const ROOT = '/tmp/promptops/S18/tests/replay_resume';

function resetRoot(name: string): string {
  const root = path.join(ROOT, name);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });
  return root;
}

test('S18 replay/resume: checkpoint round-trip preserves payload hash', () => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });

  const payload = {
    state: 'evaluating',
    sprintId: 'S18',
    artifacts: {
      requirementsHash: 'abc',
      promptHash: 'def',
    },
  };

  const artifact = writeCheckpoint(ROOT, 'cp-001', payload);
  assert.ok(fs.existsSync(artifact.checkpointPath));
  assert.ok(fs.existsSync(artifact.hashPath));

  const loaded = loadCheckpoint(artifact.checkpointPath);
  assert.deepStrictEqual(loaded, payload);
  assert.strictEqual(stableHash(loaded), artifact.sha256);

  const hashFile = fs.readFileSync(artifact.hashPath, 'utf8');
  assert.ok(hashFile.includes(`${artifact.sha256}  checkpoint.json`));
});

test('S18 replay/resume: payload drift changes deterministic hash', () => {
  const original = { state: 'done', sprintId: 'S18', verdict: 'complete' };
  const changed = { state: 'done', sprintId: 'S18', verdict: 'delta' };
  assert.notStrictEqual(stableHash(original), stableHash(changed));
  assert.strictEqual(path.basename(ROOT), 'replay_resume');
});

test('S18-UXQ-05 replay/resume: latest checkpoint from bundle shows hash parity badge and resumes state', () => {
  const root = resetRoot('latest_bundle');
  writeCheckpoint(root, 'cp-001', { state: 'requirements_ready', sprintId: 'S18' });
  writeCheckpoint(root, 'cp-002', { state: 'delta_required', sprintId: 'S18', runId: 'run-2' });

  const modelA = buildReplayResumeModel({ bundleRoot: root });
  const modelB = buildReplayResumeModel({ bundleRoot: root });
  assert.strictEqual(modelA.checkpointId, 'cp-002');
  assert.strictEqual(modelA.selectionMode, 'latest');
  assert.strictEqual(modelA.parityBadge.status, 'match');
  assert.strictEqual(modelA.parityBadge.label, 'HASH MATCH');
  assert.strictEqual(modelA.resumeActionEnabled, true);
  assert.strictEqual(modelA.rendered, 'Resume latest checkpoint (cp-002) | delta_required | [HASH MATCH]');
  assert.strictEqual(modelA.sha256, modelB.sha256);

  const resumed = resumeStateMachineFromArtifactBundle({ bundleRoot: root });
  assert.strictEqual(resumed.machine.currentState, 'delta_required');
  assert.strictEqual(resumed.model.checkpointId, 'cp-002');
});

test('S18-UXQ-05 replay/resume: latest checkpoint prefers highest numeric sequence over lexicographic order', () => {
  const root = resetRoot('latest_bundle_sequence');
  writeCheckpoint(root, 'cp-9', { state: 'requirements_ready', sprintId: 'S18', runId: 'run-9' });
  writeCheckpoint(root, 'cp-10', { state: 'done', sprintId: 'S18', runId: 'run-10' });

  const model = buildReplayResumeModel({ bundleRoot: root });
  assert.strictEqual(model.selectionMode, 'latest');
  assert.strictEqual(model.checkpointId, 'cp-10');
  assert.strictEqual(model.checkpointState, 'done');
  assert.strictEqual(model.resumeActionEnabled, true);
});

test('S18-UXQ-05 replay/resume: hash drift blocks resume and exposes drift badge', () => {
  const root = resetRoot('drift_bundle');
  const artifact = writeCheckpoint(root, 'cp-003', { state: 'prompt_ready', sprintId: 'S18' });
  fs.writeFileSync(artifact.checkpointPath, JSON.stringify({ state: 'done', sprintId: 'S18' }), 'utf8');

  const model = buildReplayResumeModel({ bundleRoot: root, checkpointId: 'cp-003' });
  assert.strictEqual(model.selectionMode, 'explicit');
  assert.strictEqual(model.parityBadge.status, 'drift');
  assert.strictEqual(model.parityBadge.label, 'HASH DRIFT');
  assert.strictEqual(model.resumeActionEnabled, false);
  assert.throws(
    () => resumeStateMachineFromArtifactBundle({ bundleRoot: root, checkpointId: 'cp-003' }),
    /REPLAY_RESUME_BLOCKED:drift/,
  );
});

test('S18-UXQ-05 replay/resume: missing hash file blocks resume and exposes missing badge', () => {
  const root = resetRoot('missing_hash_bundle');
  const artifact = writeCheckpoint(root, 'cp-004', { state: 'evaluating', sprintId: 'S18' });
  fs.rmSync(artifact.hashPath);

  const model = buildReplayResumeModel({ bundleRoot: root, checkpointId: 'cp-004' });
  assert.strictEqual(model.parityBadge.status, 'missing');
  assert.strictEqual(model.parityBadge.label, 'HASH MISSING');
  assert.strictEqual(model.resumeActionEnabled, false);
  assert.throws(
    () => resumeStateMachineFromArtifactBundle({ bundleRoot: root, checkpointId: 'cp-004' }),
    /REPLAY_RESUME_BLOCKED:missing/,
  );
});
