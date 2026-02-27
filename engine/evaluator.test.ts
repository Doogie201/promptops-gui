import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { Evaluator } from './evaluator.ts';
import type { DeltaTicket, Requirement } from './evaluator.ts';

const fixturesRoot = path.join('/tmp', 'promptops', 'S04', 'fixtures');
const deltaRoot = path.join('/tmp', 'promptops', 'S04', 'delta');

function cleanFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function loadFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

test('AT-S04-01: ledger marks done/partial/todo with stable citations', () => {
  fs.mkdirSync(fixturesRoot, { recursive: true });
  fs.mkdirSync(deltaRoot, { recursive: true });
  const ledgerPath = path.join(fixturesRoot, 'at-s04-01-ledger.json');
  const deltaPath = path.join(deltaRoot, 'at-s04-01-delta.json');
  cleanFile(ledgerPath);
  cleanFile(deltaPath);

  const requirements: Requirement[] = [
    { id: 'A-DONE', description: 'Stable evidence pointer is present', evidencePath: 'docs/sprints/S04/evidence/a-done.txt' },
    { id: 'B-PARTIAL', description: 'Generate delta ticket for outstanding requirement', evidencePath: 'docs/sprints/S04/evidence/b-partial.txt' },
    { id: 'C-TODO', description: 'Synthesize websocket retry policy artifact', evidencePath: 'docs/sprints/S04/evidence/c-todo.txt' }
  ];
  const output = 'A-DONE completed with stable evidence pointer and we generate delta ticket now.';
  const report = new Evaluator({ ledgerPath, deltaTicketPath: deltaPath }).evaluate(output, requirements);

  assert.strictEqual(report.ledger.length, 3);
  assert.strictEqual(report.verdict, 'delta');
  assert.deepStrictEqual(
    report.ledger.map((entry) => `${entry.requirementId}:${entry.status}`),
    ['A-DONE:done', 'B-PARTIAL:partial', 'C-TODO:todo']
  );
  assert.ok(report.ledger[0].citations.includes('agent_output:match:A-DONE'));
  assert.ok(report.ledger[1].citations.includes('agent_output:keyword:delta'));
  assert.ok(report.ledger[2].citations.includes('requirement:docs/sprints/S04/evidence/c-todo.txt'));
});

test('AT-S04-02: delta ticket includes only outstanding items and is deterministic', () => {
  fs.mkdirSync(fixturesRoot, { recursive: true });
  fs.mkdirSync(deltaRoot, { recursive: true });
  const ledgerPathA = path.join(fixturesRoot, 'at-s04-02-ledger-a.json');
  const ledgerPathB = path.join(fixturesRoot, 'at-s04-02-ledger-b.json');
  const deltaPathA = path.join(deltaRoot, 'at-s04-02-delta-a.json');
  const deltaPathB = path.join(deltaRoot, 'at-s04-02-delta-b.json');
  [ledgerPathA, ledgerPathB, deltaPathA, deltaPathB].forEach(cleanFile);

  const requirements: Requirement[] = [
    { id: 'REQ-01', description: 'done requirement marker' },
    { id: 'REQ-02', description: 'partial outstanding marker' },
    { id: 'REQ-03', description: 'missing item marker' }
  ];
  const output = 'REQ-01 done requirement marker plus partial outstanding details.';

  const evaluatorA = new Evaluator({ ledgerPath: ledgerPathA, deltaTicketPath: deltaPathA });
  const evaluatorB = new Evaluator({ ledgerPath: ledgerPathB, deltaTicketPath: deltaPathB });
  const reportA = evaluatorA.evaluate(output, requirements);
  const reportB = evaluatorB.evaluate(output, requirements);

  assert.strictEqual(reportA.complete, false);
  assert.strictEqual(reportB.complete, false);
  assert.strictEqual(reportA.verdict, 'delta');
  assert.strictEqual(reportB.verdict, 'delta');
  assert.strictEqual(loadFile(ledgerPathA), loadFile(ledgerPathB));
  assert.strictEqual(loadFile(deltaPathA), loadFile(deltaPathB));

  const ticket = JSON.parse(loadFile(deltaPathA)) as DeltaTicket;
  assert.ok(ticket.ticketId.length > 0);
  assert.deepStrictEqual(
    ticket.outstanding.map((item) => item.requirementId),
    ['REQ-02', 'REQ-03']
  );
});

test('AT-S04-03: done items are never re-asked in delta ticket', () => {
  fs.mkdirSync(fixturesRoot, { recursive: true });
  fs.mkdirSync(deltaRoot, { recursive: true });
  const ledgerPath = path.join(fixturesRoot, 'at-s04-03-ledger.json');
  const deltaPath = path.join(deltaRoot, 'at-s04-03-delta.json');
  cleanFile(ledgerPath);
  cleanFile(deltaPath);

  const requirements: Requirement[] = [
    { id: 'DONE-01', description: 'already evidenced requirement' },
    { id: 'TODO-01', description: 'remaining requirement' }
  ];
  const output = 'DONE-01 already evidenced requirement is complete.';
  const report = new Evaluator({ ledgerPath, deltaTicketPath: deltaPath }).evaluate(output, requirements);

  assert.strictEqual(report.complete, false);
  assert.strictEqual(report.verdict, 'delta');
  assert.ok(report.deltaTicket);
  assert.deepStrictEqual(
    report.deltaTicket?.outstanding.map((item) => item.requirementId),
    ['TODO-01']
  );
  assert.ok(!report.deltaTicket?.outstanding.some((item) => item.requirementId === 'DONE-01'));
});

test('AT-S04-05: repeat request is blocked/needs_input and emits no looping delta ticket', () => {
  fs.mkdirSync(fixturesRoot, { recursive: true });
  fs.mkdirSync(deltaRoot, { recursive: true });
  const ledgerPath = path.join(fixturesRoot, 'at-s04-05-ledger.json');
  const deltaPath = path.join(deltaRoot, 'at-s04-05-delta.json');
  cleanFile(ledgerPath);
  cleanFile(deltaPath);

  const priorLedger = [
    {
      requirementId: 'REQ-DONE',
      status: 'done',
      reason: 'Previously completed with evidence.',
      citations: ['requirement:docs/sprints/S04/evidence/req-done.txt', 'agent_output:match:REQ-DONE']
    }
  ];
  fs.writeFileSync(ledgerPath, `${JSON.stringify(priorLedger, null, 2)}\n`, 'utf8');

  const requirements: Requirement[] = [
    { id: 'REQ-DONE', description: 'already done requirement' }
  ];
  const output = 'Request repeats this work without adding new evidence.';
  const evaluator = new Evaluator({ ledgerPath, deltaTicketPath: deltaPath });
  const report1 = evaluator.evaluate(output, requirements);

  assert.strictEqual(report1.complete, false);
  assert.strictEqual(report1.verdict, 'needs_input');
  assert.strictEqual(report1.deltaTicket, undefined);
  assert.ok(!fs.existsSync(deltaPath));
  assert.deepStrictEqual(report1.needsInput?.map((entry) => entry.requirementId), ['REQ-DONE']);
  assert.strictEqual(report1.ledger[0].status, 'blocked');

  const ledgerRun1 = loadFile(ledgerPath);
  const report2 = evaluator.evaluate(output, requirements);
  const ledgerRun2 = loadFile(ledgerPath);
  assert.strictEqual(report2.verdict, 'needs_input');
  assert.strictEqual(report2.deltaTicket, undefined);
  assert.strictEqual(ledgerRun2, ledgerRun1);
});

test('AT-S04-06: when complete, evaluator emits no delta ticket file', () => {
  fs.mkdirSync(fixturesRoot, { recursive: true });
  fs.mkdirSync(deltaRoot, { recursive: true });
  const ledgerPath = path.join(fixturesRoot, 'at-s04-06-ledger.json');
  const deltaPath = path.join(deltaRoot, 'at-s04-06-delta.json');
  cleanFile(ledgerPath);
  fs.writeFileSync(deltaPath, '{\"stale\":true}\n', 'utf8');

  const requirements: Requirement[] = [
    { id: 'REQ-COMPLETE', description: 'complete evidence present' }
  ];
  const output = 'REQ-COMPLETE complete evidence present';
  const report = new Evaluator({ ledgerPath, deltaTicketPath: deltaPath }).evaluate(output, requirements);

  assert.strictEqual(report.complete, true);
  assert.strictEqual(report.verdict, 'complete');
  assert.strictEqual(report.deltaTicket, undefined);
  assert.ok(!fs.existsSync(deltaPath));
  assert.deepStrictEqual(report.ledger.map((entry) => entry.status), ['done']);
});
