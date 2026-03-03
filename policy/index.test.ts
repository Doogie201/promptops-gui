import test from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { GlobalPolicy, assertPolicyInvariants } from './index.ts';

test('policy defaults satisfy invariants', () => {
  assert.doesNotThrow(() => assertPolicyInvariants());
});

test('policy rejects duplicate whitelist entries', () => {
  assert.throws(
    () =>
      assertPolicyInvariants({
        ...GlobalPolicy,
        whitelist: [...GlobalPolicy.whitelist, GlobalPolicy.whitelist[0]]
      }),
    /duplicate entries/
  );
});

test('policy enforces positive line and function budgets', () => {
  assert.throws(
    () =>
      assertPolicyInvariants({
        ...GlobalPolicy,
        budgets: {
          ...GlobalPolicy.budgets,
          maxFunctionLength: 0
        }
      }),
    /must be positive/
  );
});

test('policy whitelist root is absolute', () => {
  assert.ok(path.isAbsolute(GlobalPolicy.whitelist[0]));
  assert.ok(GlobalPolicy.whitelist[0].endsWith(path.sep));
});
