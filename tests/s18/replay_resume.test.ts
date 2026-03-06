import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { loadCheckpoint, writeCheckpoint } from '../../src/s18/build_mode/checkpoints.ts';
import { stableHash } from '../../src/s18/build_mode/hash.ts';

const ROOT = '/tmp/promptops/S18/tests/replay_resume';

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
