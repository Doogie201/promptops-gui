import test from 'node:test';
import assert from 'node:assert';
import {
  assertScopeGuardReadyForDispatch,
  buildScopeGuardModel,
} from '../../src/s18/build_mode/scope_guard.ts';

test('S18-UXQ-06 scope guard: in-scope paths render clear pre-dispatch signal', () => {
  const model = buildScopeGuardModel({
    requestedPaths: ['tests/s18/orchestration_loop.test.ts', 'src/s18/build_mode/orchestrator.ts'],
    allowedPaths: ['src/s18/**', 'tests/s18/**', 'docs/sprints/S18/**'],
  });

  assert.strictEqual(model.status, 'in_scope');
  assert.strictEqual(model.scopeChangeRequestStatus, 'not_required');
  assert.strictEqual(model.dispatchAllowed, true);
  assert.strictEqual(model.outOfScopePaths.length, 0);
  assert.match(model.rendered, /Scope guard: IN SCOPE/);
});

test('S18-UXQ-06 scope guard: out-of-scope paths require approved SCR before dispatch', () => {
  const model = buildScopeGuardModel({
    requestedPaths: ['src/s18/build_mode/orchestrator.ts', 'docs/sprints/S17/README.md'],
    allowedPaths: ['src/s18/**', 'tests/s18/**', 'docs/sprints/S18/**'],
  });

  assert.strictEqual(model.status, 'out_of_scope');
  assert.strictEqual(model.scopeChangeRequestStatus, 'missing');
  assert.deepStrictEqual(model.outOfScopePaths, ['docs/sprints/S17/README.md']);
  assert.strictEqual(model.dispatchAllowed, false);
  assert.throws(() => assertScopeGuardReadyForDispatch(model), /SCOPE_GUARD_DISPATCH_BLOCKED/);
});

test('S18-UXQ-06 scope guard: approved SCR preserves out-of-scope warning but allows dispatch', () => {
  const model = buildScopeGuardModel({
    requestedPaths: ['docs/sprints/S17/README.md'],
    allowedPaths: ['src/s18/**', 'tests/s18/**', 'docs/sprints/S18/**'],
    scopeChangeRequest: {
      change_id: 'SCR-S18-001',
      requested_by: 'operator',
      reason: 'Carry a legacy sprint dependency',
      impact_on_scope: 'Single evidence reference',
      files_affected: ['docs/sprints/S17/README.md'],
      risk_level: 'low',
      approval_decision: 'approved',
    },
  });

  assert.strictEqual(model.status, 'out_of_scope');
  assert.strictEqual(model.scopeChangeRequestStatus, 'approved');
  assert.strictEqual(model.scopeChangeRequired, true);
  assert.strictEqual(model.dispatchAllowed, true);
  assert.match(model.summary, /approved SCR SCR-S18-001/);
});
