import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONTRACT_PATH = path.join(REPO_ROOT, 'docs/sprints/S18/contracts_v1.json');

function readContracts(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8')) as Record<string, unknown>;
}

test('S18 contracts: schema file is valid and includes core loop/state guarantees', () => {
  const contracts = readContracts();
  assert.strictEqual(contracts.version, 's18.contracts.v1');

  const loop = contracts.north_star_loop as string[];
  const states = contracts.states as string[];
  assert.ok(loop.includes('project_bootstrap'));
  assert.ok(loop.includes('delta_repeat_until_done'));
  assert.ok(states.includes('project_bootstrapped'));
  assert.ok(states.includes('delta_required'));
});

test('S18 contracts: CI required tests list exists and files are present', () => {
  const contracts = readContracts();
  const ci = contracts.ci_enforcement as { required_tests?: string[] };
  assert.ok(Array.isArray(ci.required_tests));
  assert.ok((ci.required_tests?.length ?? 0) >= 9);

  for (const file of ci.required_tests ?? []) {
    const abs = path.join(REPO_ROOT, file);
    assert.ok(fs.existsSync(abs), `missing required test file: ${file}`);
  }
});

test('S18 contracts: blocked transition coverage includes project_bootstrapped', () => {
  const contracts = readContracts();
  const transitions = (contracts.allowed_transitions ?? []) as Array<[string, string]>;
  const hasTransition = transitions.some(([from, to]) => from === 'project_bootstrapped' && to === 'blocked');
  assert.strictEqual(hasTransition, true);
});
