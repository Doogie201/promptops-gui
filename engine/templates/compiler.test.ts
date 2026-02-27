import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateRegistry, TemplateVersion } from './registry';
import { compileTemplate } from './compiler';
import { validateTicketOutput } from './validator';
import { assertSafeActivation } from './safety';

const TEST_TICKETS_DIR = '/tmp/promptops/S03/tickets';
const TEST_VALIDATE_DIR = '/tmp/promptops/S03/validate';

function clearDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

test('AT-S03-01: Compiler emits schema-valid ticket deterministically', () => {
  clearDir(TEST_TICKETS_DIR);
  const registry = new TemplateRegistry();
  const rawBody = `{"title": "{{TITLE}}", "scope": "{{SCOPE}}", "priority": "high", "dynamic": "{{DYN}}"}`;

  const v1 = registry.register('ticket', 'v1', rawBody, [], 'active');
  const context = { TITLE: 'S03 Fix', SCOPE: 'backend', DYN: 'stable-val' };

  const res1 = compileTemplate(v1, context);
  const res2 = compileTemplate(v1, context);

  assert.strictEqual(res1.state, 'ready');
  assert.strictEqual(res2.state, 'ready');
  // Deterministic byte output
  assert.strictEqual(res1.outputJson, res2.outputJson);

  // Save evidence
  fs.writeFileSync(path.join(TEST_TICKETS_DIR, 'ticket-1.json'), res1.outputJson!);

  // Validate
  const val = validateTicketOutput(res1.outputJson!, ['title', 'scope', 'priority']);
  assert.strictEqual(val.valid, true);
});

test('AT-S03-02: Missing placeholder triggers "needs input" state deterministically', () => {
  clearDir(TEST_VALIDATE_DIR);
  const registry = new TemplateRegistry();
  const rawBody = `{"task": "{{TASK_NAME}}", "user": "{{USER_ID}}", "date": "{{NOT_GIVEN}}"}`;
  const v1 = registry.register('ticket', 'v1', rawBody);

  const ctx = { TASK_NAME: 'test' };
  const res = compileTemplate(v1, ctx);

  assert.strictEqual(res.state, 'needs_input');
  assert.deepStrictEqual(res.missingKeys, ['NOT_GIVEN', 'USER_ID']); // Sorted alphabetically

  fs.writeFileSync(path.join(TEST_VALIDATE_DIR, 'missing-keys-evidence.json'), JSON.stringify(res.missingKeys));
});

test('AT-S03-03: Template version pinning keeps older sprints stable', () => {
  const registry = new TemplateRegistry();
  const v1 = registry.register('ticket', 'v1', `{"ver": 1}`);
  const v2 = registry.register('ticket', 'v2', `{"ver": 2, "new": true}`);

  const oldSprintContext = {};

  // Old sprint explicitly pinned to v1 despite v2 being active
  const pinnedV1 = registry.getVersion('ticket', 'v1')!;
  const resOld = compileTemplate(pinnedV1, oldSprintContext);

  const activeV = registry.getActiveVersion('ticket')!;
  const resNew = compileTemplate(activeV, oldSprintContext);

  assert.strictEqual(resOld.outputJson, '{"ver":1}');
  assert.strictEqual(resNew.outputJson, '{"new":true,"ver":2}'); // canonical sorting puts 'new' before 'ver'
});

test('S03.D Safety Diff test (Protected sections)', () => {
  const registry = new TemplateRegistry();
  const v1 = registry.register('ticket', 'v1', `body { SECURE_BLOCK }`, ['SECURE_BLOCK']);

  assert.throws(() => {
    const v2Raw = registry.register('ticket', 'v2', `body { NOPE }`, [], 'archived');
    // We already check this in AT-S03-05 directly against registry.register
    assertSafeActivation(v1, v2Raw);
  }, /Safety violation/);
});

test('AT-S03-04: JSON-safe placeholder injection with quotes and newlines', () => {
  const registry = new TemplateRegistry();
  const rawBody = `{"title": "{{TITLE}}", "description": "{{DESC}}"}`;
  const v1 = registry.register('ticket', 'v1', rawBody);

  const ctx = {
    TITLE: 'He said "hi"',
    DESC: 'Line 1\nLine 2\nWith \\backslash'
  };

  const res = compileTemplate(v1, ctx);
  assert.strictEqual(res.state, 'ready');
  assert.strictEqual(res.outputJson, '{"description":"Line 1\\nLine 2\\nWith \\\\backslash","title":"He said \\"hi\\""}');
});

test('AT-S03-05: Safety enforcement on activation (with and without override)', () => {
  const registry = new TemplateRegistry();
  const rawBodyV1 = `{"content": "abc SECURE_MARKER xyz"}`;

  // Register v1 as active with protected section
  registry.register('ticket', 'v1', rawBodyV1, ['SECURE_MARKER'], 'active');

  const rawBodyV2 = `{"content": "unsafe removed marker"}`;

  // Attempt to register v2 as active (fails because it drops SECURE_MARKER)
  assert.throws(() => {
    registry.register('ticket', 'v2', rawBodyV2, [], 'active');
  }, /Safety violation/);

  // Active version remains v1
  let active = registry.getActiveVersion('ticket');
  assert.strictEqual(active?.versionId, 'v1');

  // Register v2 as active with override flag
  registry.register('ticket', 'v2', rawBodyV2, [], 'active', true);

  // Active version is now v2
  active = registry.getActiveVersion('ticket');
  assert.strictEqual(active?.versionId, 'v2');
});
