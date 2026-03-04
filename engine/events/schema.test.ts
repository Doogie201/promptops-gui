import test from 'node:test';
import assert from 'node:assert';
import { canonicalSerialize, idForEvent } from './schema.ts';
import type { BaseEvent } from './schema.ts';

test('canonicalSerialize sorts keys deterministically', () => {
  const left = {
    b: 2,
    a: {
      z: true,
      m: ['x', { k: 1, j: 0 }]
    }
  };
  const right = {
    a: {
      m: ['x', { j: 0, k: 1 }],
      z: true
    },
    b: 2
  };

  assert.strictEqual(canonicalSerialize(left), canonicalSerialize(right));
  assert.strictEqual(canonicalSerialize(left), '{"a":{"m":["x",{"j":0,"k":1}],"z":true},"b":2}');
});

test('idForEvent is stable across payload key ordering', () => {
  const eventA: BaseEvent = {
    type: 'USER_ACTION',
    version: '1.0',
    payload: { y: 'two', x: 'one' }
  };
  const eventB: BaseEvent = {
    type: 'USER_ACTION',
    version: '1.0',
    payload: { x: 'one', y: 'two' }
  };

  assert.strictEqual(idForEvent(eventA), idForEvent(eventB));
});
