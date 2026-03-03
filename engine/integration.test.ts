import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { EngineRun } from './store.ts';
import { Evaluator } from './evaluator.ts';
import type { Requirement } from './evaluator.ts';

const root = path.join('/tmp', 'promptops', 'integration');

function resetDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

test('integration: store plus evaluator remains deterministic', () => {
  const runDir = path.join(root, 'run');
  const evalDir = path.join(root, 'eval');
  resetDir(runDir);
  resetDir(evalDir);

  const run = new EngineRun('integration-run', runDir);
  run.dispatch({ type: 'SYS_START', version: '1.0', payload: { source: 'integration' } });
  run.dispatch({ type: 'USER_ACTION', version: '1.0', payload: { requirement: 'REQ-001' } });

  assert.strictEqual(run.machine.currentPhase, 'RUNNING');
  assert.strictEqual(run.eventLog.length, 2);

  const ledgerPath = path.join(evalDir, 'ledger.json');
  const deltaPath = path.join(evalDir, 'delta.json');
  const requirements: Requirement[] = [
    { id: 'REQ-001', description: 'integration requirement is present' },
    { id: 'REQ-002', description: 'second requirement is missing' }
  ];
  const output = 'REQ-001 integration requirement is present via USER_ACTION evidence';

  const evaluator = new Evaluator({ ledgerPath, deltaTicketPath: deltaPath });
  const reportA = evaluator.evaluate(output, requirements);
  const ledgerA = fs.readFileSync(ledgerPath, 'utf8');
  const deltaA = fs.readFileSync(deltaPath, 'utf8');

  const reportB = evaluator.evaluate(output, requirements);
  const ledgerB = fs.readFileSync(ledgerPath, 'utf8');
  const deltaB = fs.readFileSync(deltaPath, 'utf8');

  assert.strictEqual(reportA.verdict, 'delta');
  assert.strictEqual(reportB.verdict, 'delta');
  assert.strictEqual(ledgerA, ledgerB);
  assert.strictEqual(deltaA, deltaB);
  assert.deepStrictEqual(reportA.deltaTicket?.outstanding.map((item) => item.requirementId), ['REQ-002']);
});

test('integration: complete flow removes stale delta ticket', () => {
  const evalDir = path.join(root, 'complete');
  resetDir(evalDir);

  const ledgerPath = path.join(evalDir, 'ledger.json');
  const deltaPath = path.join(evalDir, 'delta.json');
  fs.writeFileSync(deltaPath, '{"stale":true}\n', 'utf8');

  const evaluator = new Evaluator({ ledgerPath, deltaTicketPath: deltaPath });
  const requirements: Requirement[] = [{ id: 'REQ-COMPLETE', description: 'completion evidence exists' }];
  const output = 'REQ-COMPLETE completion evidence exists';

  const report = evaluator.evaluate(output, requirements);
  assert.strictEqual(report.verdict, 'complete');
  assert.strictEqual(report.deltaTicket, undefined);
  assert.ok(!fs.existsSync(deltaPath));
});
