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

test('S18 contracts: UXQ-01 status and evidence path are tracked once implemented', () => {
  const contracts = readContracts();
  const queue = (contracts.governance as { workflow_experience_queue?: Array<Record<string, unknown>> })
    ?.workflow_experience_queue;
  const item = queue?.find((entry) => entry.id === 'S18-UXQ-01');

  assert.ok(item);
  assert.strictEqual(item?.status, 'implemented');
  assert.match(String(item?.acceptance_evidence_path ?? ''), /^docs\/sprints\/S18\/evidence\/work_items\/S18-UXQ-01_/);
  assert.ok(Array.isArray(item?.implementation_paths));
  assert.ok((item?.implementation_paths as string[]).includes('src/s18/build_mode/first_run_wizard.ts'));
  assert.ok((item?.implementation_paths as string[]).includes('tests/s18/first_run_wizard.test.ts'));
});

test('S18 contracts: UXQ-02 status, test registration, and evidence path are tracked once implemented', () => {
  const contracts = readContracts();
  const queue = (contracts.governance as { workflow_experience_queue?: Array<Record<string, unknown>> })
    ?.workflow_experience_queue;
  const item = queue?.find((entry) => entry.id === 'S18-UXQ-02');
  const requiredTests = (contracts.ci_enforcement as { required_tests?: string[] })?.required_tests ?? [];

  assert.ok(item);
  assert.strictEqual(item?.status, 'implemented');
  assert.match(String(item?.acceptance_evidence_path ?? ''), /^docs\/sprints\/S18\/evidence\/work_items\/S18-UXQ-02_/);
  assert.ok((item?.implementation_paths as string[]).includes('src/s18/build_mode/loop_stepper.ts'));
  assert.ok((item?.implementation_paths as string[]).includes('tests/s18/loop_stepper.test.ts'));
  assert.ok(requiredTests.includes('tests/s18/loop_stepper.test.ts'));
});

test('S18 contracts: UXQ-03 status, test registration, and evidence path are tracked once implemented', () => {
  const contracts = readContracts();
  const queue = (contracts.governance as { workflow_experience_queue?: Array<Record<string, unknown>> })
    ?.workflow_experience_queue;
  const item = queue?.find((entry) => entry.id === 'S18-UXQ-03');
  const requiredTests = (contracts.ci_enforcement as { required_tests?: string[] })?.required_tests ?? [];

  assert.ok(item);
  assert.strictEqual(item?.status, 'implemented');
  assert.match(String(item?.acceptance_evidence_path ?? ''), /^docs\/sprints\/S18\/evidence\/work_items\/S18-UXQ-03_/);
  assert.ok((item?.implementation_paths as string[]).includes('src/s18/build_mode/human_gate_controls.ts'));
  assert.ok((item?.implementation_paths as string[]).includes('tests/s18/human_gate_controls.test.ts'));
  assert.ok(requiredTests.includes('tests/s18/human_gate_controls.test.ts'));
});

test('S18 contracts: UXQ-04 status, test registration, and evidence path are tracked once implemented', () => {
  const contracts = readContracts();
  const queue = (contracts.governance as { workflow_experience_queue?: Array<Record<string, unknown>> })
    ?.workflow_experience_queue;
  const item = queue?.find((entry) => entry.id === 'S18-UXQ-04');
  const requiredTests = (contracts.ci_enforcement as { required_tests?: string[] })?.required_tests ?? [];

  assert.ok(item);
  assert.strictEqual(item?.status, 'implemented');
  assert.match(String(item?.acceptance_evidence_path ?? ''), /^docs\/sprints\/S18\/evidence\/work_items\/S18-UXQ-04_/);
  assert.ok((item?.implementation_paths as string[]).includes('src/s18/build_mode/delta_review.ts'));
  assert.ok((item?.implementation_paths as string[]).includes('tests/s18/delta_review.test.ts'));
  assert.ok(requiredTests.includes('tests/s18/delta_review.test.ts'));
});

test('S18 contracts: UXQ-05 status, test registration, and evidence path are tracked once implemented', () => {
  const contracts = readContracts();
  const queue = (contracts.governance as { workflow_experience_queue?: Array<Record<string, unknown>> })
    ?.workflow_experience_queue;
  const item = queue?.find((entry) => entry.id === 'S18-UXQ-05');
  const requiredTests = (contracts.ci_enforcement as { required_tests?: string[] })?.required_tests ?? [];

  assert.ok(item);
  assert.strictEqual(item?.status, 'implemented');
  assert.match(String(item?.acceptance_evidence_path ?? ''), /^docs\/sprints\/S18\/evidence\/work_items\/S18-UXQ-05_/);
  assert.ok((item?.implementation_paths as string[]).includes('src/s18/build_mode/replay_resume.ts'));
  assert.ok((item?.implementation_paths as string[]).includes('tests/s18/replay_resume.test.ts'));
  assert.ok(requiredTests.includes('tests/s18/replay_resume.test.ts'));
});

test('S18 contracts: UXQ-06 status, test registration, and evidence path are tracked once implemented', () => {
  const contracts = readContracts();
  const queue = (contracts.governance as { workflow_experience_queue?: Array<Record<string, unknown>> })
    ?.workflow_experience_queue;
  const item = queue?.find((entry) => entry.id === 'S18-UXQ-06');
  const requiredTests = (contracts.ci_enforcement as { required_tests?: string[] })?.required_tests ?? [];

  assert.ok(item);
  assert.strictEqual(item?.status, 'implemented');
  assert.match(String(item?.acceptance_evidence_path ?? ''), /^docs\/sprints\/S18\/evidence\/work_items\/S18-UXQ-06_/);
  assert.ok((item?.implementation_paths as string[]).includes('src/s18/build_mode/scope_guard.ts'));
  assert.ok((item?.implementation_paths as string[]).includes('src/s18/build_mode/orchestrator.ts'));
  assert.ok((item?.implementation_paths as string[]).includes('tests/s18/scope_guard.test.ts'));
  assert.ok((item?.implementation_paths as string[]).includes('tests/s18/orchestration_loop.test.ts'));
  assert.ok(requiredTests.includes('tests/s18/scope_guard.test.ts'));
});
