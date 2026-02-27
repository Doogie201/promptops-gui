import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { EngineRun } from './store';
import { BaseEvent } from './events/schema';

const TEST_RUNS_DIR = '/tmp/promptops/S02/runs';
const TEST_RESUME_DIR = '/tmp/promptops/S02/resume';

function clearDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('AT-S02-01: Run Store correctly tracks and retrieves append-only events', async () => {
  clearDir(TEST_RUNS_DIR);
  const run = new EngineRun('run-1', TEST_RUNS_DIR);
  const ev: BaseEvent = { type: 'SYS_START', version: '1.0', payload: { ts: 1 } };

  const result = run.dispatch(ev);
  assert.strictEqual(result.newAction, true);
  assert.strictEqual(run.eventLog.length, 1);
  assert.strictEqual(run.machine.currentPhase, 'RUNNING');

  const logPath = path.join(TEST_RUNS_DIR, 'run-1.jsonl');
  assert.strictEqual(fs.existsSync(logPath), true);
  const content = fs.readFileSync(logPath, 'utf8');
  assert.ok(content.includes('SYS_START'));
});

test('AT-S02-02: Idempotency is preserved (identical inputs yield no new duplicated actions)', async () => {
  clearDir(TEST_RUNS_DIR);
  const run = new EngineRun('run-idem', TEST_RUNS_DIR);
  const ev1: BaseEvent = { type: 'SYS_START', version: '1.0', payload: { fixed: true } };
  const ev2: BaseEvent = { type: 'USER_ACTION', version: '1.0', payload: { action: 'click' } };

  // Dispatch first time
  const res1 = run.dispatch(ev1);
  assert.strictEqual(res1.newAction, true);

  // Dispatch identical event
  const res2 = run.dispatch(ev1);
  assert.strictEqual(res2.newAction, false); // Idempotent
  assert.strictEqual(run.eventLog.length, 1);

  // Dispatch different event
  const res3 = run.dispatch(ev2);
  assert.strictEqual(res3.newAction, true);
  assert.strictEqual(run.eventLog.length, 2);
});

test('AT-S02-03: Crash-safe resume restores state precisely and completes workflow successfully', async () => {
  clearDir(TEST_RESUME_DIR);

  // Phase 1: Initial run crashes midway
  const run1 = new EngineRun('run-resume', TEST_RESUME_DIR);
  run1.dispatch({ type: 'SYS_START', version: '1.0', payload: { step: 1 } });
  run1.dispatch({ type: 'USER_ACTION', version: '1.0', payload: { step: 2 } });

  assert.strictEqual(run1.eventLog.length, 2);
  assert.strictEqual(run1.machine.currentPhase, 'RUNNING');
  // Simulate mid-write crash by manually appending a truncated JSON fragment to the log
  const logPath = path.join(TEST_RESUME_DIR, 'run-resume.jsonl');
  fs.appendFileSync(logPath, '{"type":"USER_ACTION","version":"1.0","payload":{"step":3}'); // missing closing brace and newline

  // Simulation of crash -> New instance rehydrates from disk (tolerates truncated log)
  const run2 = new EngineRun('run-resume', TEST_RESUME_DIR);

  // Verify state is precisely restored without re-running dispatch
  assert.strictEqual(run2.eventLog.length, 2);
  assert.strictEqual(run2.machine.currentPhase, 'RUNNING');

  // Complete workflow
  const res = run2.dispatch({ type: 'SYS_STOP', version: '1.0', payload: { step: 3 } });
  assert.strictEqual(res.newAction, true);
  assert.strictEqual(run2.eventLog.length, 3);
  assert.strictEqual(run2.machine.currentPhase, 'DONE');
});
