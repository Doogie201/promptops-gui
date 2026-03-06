import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readText(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

test('S18 CI policy: package scripts expose governance verification commands', () => {
  const pkg = JSON.parse(readText('package.json')) as {
    scripts?: Record<string, string>;
  };
  assert.strictEqual(pkg.scripts?.['test:s18'], 'node --test --experimental-transform-types tests/s18/*.test.ts');
  assert.strictEqual(pkg.scripts?.['verify:s18'], 'bash scripts/verify_s18.sh');
});

test('S18 CI policy: verify workflow executes S18 governance gate', () => {
  const workflow = readText('.github/workflows/verify.yml');
  assert.match(workflow, /name:\s+Verify S18 governance/);
  assert.match(workflow, /npm run -s verify:s18/);
});

test('S18 CI policy: verify_s18 enforces determinism and hardpath stoplights', () => {
  const script = readText('scripts/verify_s18.sh');
  assert.match(script, /Date\\\.now\\\(\|Math\\\.random\\\(/);
  assert.match(script, /\/Users\/\|\/Volumes\/\|\[A-Za-z\]:\\\\\\\\/);
  assert.match(script, /required_tests_count=/);
  assert.match(script, /npm run -s test:s18/);
});

test('S18 CI policy: contract gate outcomes include milestone and scope controls', () => {
  const contracts = JSON.parse(readText('docs/sprints/S18/contracts_v1.json')) as {
    ci_enforcement?: { required_gate_outcomes?: string[]; required_tests?: string[] };
  };

  const outcomes = contracts.ci_enforcement?.required_gate_outcomes ?? [];
  assert.ok(outcomes.includes('milestone_exit_criteria_met'));
  assert.ok(outcomes.includes('scope_change_control_enforced'));

  const tests = contracts.ci_enforcement?.required_tests ?? [];
  assert.ok(tests.every((name) => name.startsWith('tests/s18/')));
});
