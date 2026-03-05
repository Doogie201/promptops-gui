import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runOutOfSyncTool, operatorExecutorAllowedSpecs } from '../../src/s10/operator_tools.ts';
import type { CommandRunner, CommandSpec, ToolOptions } from '../../src/s10/operator_types.ts';
import {
  buildGoldenFixture,
  compareGoldenReplay,
  evaluateAdapterResilience,
  evaluateLongRunStability,
  recoveryActionSpecs,
  runRecoveryAction,
  type AdapterAttempt,
  type GoldenRunArtifacts,
  type LongRunSample,
} from '../../src/s16/hardening.ts';

const ROOT = '/tmp/promptops/S16';
const REGRESSION_ROOT = path.join(ROOT, 'regression', 'AT-S16-01');
const HARDENING_ROOT = path.join(ROOT, 'hardening', 'AT-S16-02');
const RECOVERY_ROOT = path.join(ROOT, 'hardening', 'AT-S16-03');
const WORKSPACE_ROOT = path.join(ROOT, 'test_workspace');
const STAGING_BASE = path.join(WORKSPACE_ROOT, 'staging');
const DURABLE_BASE = path.join(WORKSPACE_ROOT, 'durable');
const MOCK_REPO = path.join(WORKSPACE_ROOT, 'mock-repo');

const BASE_OPTIONS: ToolOptions = {
  sprintId: 'S16-hardening-regression',
  runId: 'AT-S16',
  repoRoot: MOCK_REPO,
  stagingBase: STAGING_BASE,
  durableBase: DURABLE_BASE,
  timestamp: '20260305T180000Z',
};

test('AT-S16-01 deterministic replay fixtures produce byte-stable hashes', () => {
  ensureDir(REGRESSION_ROOT);
  const baseline: GoldenRunArtifacts = {
    runId: 'run-s16-001',
    verdict: 'PASS',
    ticket: { sprintId: 'S16', objective: 'hardening' },
    narrationLines: ['phase:preflight', 'phase:gates', 'phase:closeout'],
    events: [{ seq: 1, type: 'phase_start' }, { seq: 2, type: 'phase_end' }],
    ledger: { done: ['AT-S16-01'], pending: [] },
    receipts: [{ id: 'fetch', exit: 0 }, { id: 'status', exit: 0 }],
  };
  const fixtureA = buildGoldenFixture(baseline);
  const fixtureB = buildGoldenFixture(baseline);
  assert.strictEqual(fixtureA.hash, fixtureB.hash);

  const replay = compareGoldenReplay(fixtureA, baseline);
  assert.strictEqual(replay.pass, true);

  const drifted: GoldenRunArtifacts = {
    ...baseline,
    events: [...baseline.events, { seq: 3, type: 'health_signal', severity: 'WARN' }],
  };
  const replayDrifted = compareGoldenReplay(fixtureA, drifted);
  assert.strictEqual(replayDrifted.pass, false);
  assert.ok(replayDrifted.mismatches.includes('events'));

  writeJson(path.join(REGRESSION_ROOT, 'fixture_hashes.json'), {
    baseline_hash: fixtureA.hash,
    replay_pass: replay,
    replay_drifted: replayDrifted,
    output_hashes: fixtureA.outputHashes,
  });
});

test('AT-S16-02 long-run stability and adapter resilience are bounded and deterministic', () => {
  ensureDir(HARDENING_ROOT);
  const stableSamples: LongRunSample[] = [
    { iteration: 1, heapUsedBytes: 4_000_000, logBytes: 12_000, uiLatencyMs: 16, fatalErrors: 0 },
    { iteration: 2, heapUsedBytes: 4_060_000, logBytes: 12_400, uiLatencyMs: 17, fatalErrors: 0 },
    { iteration: 3, heapUsedBytes: 4_120_000, logBytes: 12_700, uiLatencyMs: 18, fatalErrors: 0 },
    { iteration: 4, heapUsedBytes: 4_160_000, logBytes: 13_000, uiLatencyMs: 18, fatalErrors: 0 },
  ];
  const stableEval = evaluateLongRunStability(stableSamples, {
    maxHeapGrowthBytes: 250_000,
    maxLogGrowthBytes: 1_500,
    maxUiLatencyMs: 30,
    maxFatalErrors: 0,
  });
  assert.strictEqual(stableEval.pass, true);

  const unstableEval = evaluateLongRunStability(stableSamples, {
    maxHeapGrowthBytes: 50_000,
    maxLogGrowthBytes: 300,
    maxUiLatencyMs: 10,
    maxFatalErrors: 0,
  });
  assert.strictEqual(unstableEval.pass, false);
  assert.ok(unstableEval.failures.length > 0);

  const successAttempts: AdapterAttempt[] = [
    { attempt: 1, status: 'timeout', elapsedMs: 2000, partialOutput: 'partial-' },
    { attempt: 2, status: 'error', elapsedMs: 700, partialOutput: 'output', errorType: 'ECONNRESET' },
    { attempt: 3, status: 'success', elapsedMs: 500 },
  ];
  const resilienceSuccess = evaluateAdapterResilience(successAttempts);
  assert.strictEqual(resilienceSuccess.status, 'SUCCESS');
  assert.deepStrictEqual(resilienceSuccess.retryScheduleMs, [0, 50]);
  assert.strictEqual(resilienceSuccess.salvagedOutput, 'partial-output');

  const switchAttempts: AdapterAttempt[] = [
    { attempt: 1, status: 'timeout', elapsedMs: 3000 },
    { attempt: 2, status: 'error', elapsedMs: 900, errorType: 'EPIPE' },
    { attempt: 3, status: 'error', elapsedMs: 880, errorType: 'EPIPE' },
  ];
  const resilienceSwitch = evaluateAdapterResilience(switchAttempts);
  assert.strictEqual(resilienceSwitch.status, 'SWITCH_AGENT');
  assert.deepStrictEqual(resilienceSwitch.retryScheduleMs, [0, 50]);
  assert.ok(resilienceSwitch.events.some((event) => event.type === 'agent_switch'));

  writeJson(path.join(HARDENING_ROOT, 'stability_adapter_eval.json'), {
    stable_eval: stableEval,
    unstable_eval: unstableEval,
    adapter_success: resilienceSuccess,
    adapter_switch: resilienceSwitch,
  });
});

test('AT-S16-03 recovery actions run through shared executor/whitelist and produce receipts', () => {
  resetDir(WORKSPACE_ROOT);
  ensureDir(RECOVERY_ROOT);
  fs.mkdirSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S16'), { recursive: true });
  fs.writeFileSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S16', 'README.md'), '# S16\n', 'utf8');
  fs.mkdirSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S10'), { recursive: true });
  fs.writeFileSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S10', 'README.md'), '# S10\n', 'utf8');

  const invoked: string[] = [];
  const runner = createRunner(
    {
      pwd: response(MOCK_REPO),
      show_toplevel: response(MOCK_REPO),
      worktree_list: response(`worktree ${MOCK_REPO}\nbranch refs/heads/sprint/S16-hardening-regression\n`),
      branch: response('sprint/S16-hardening-regression\n'),
      log: response('abc123 replay\n'),
      status: response('## sprint/S16-hardening-regression...origin/sprint/S16-hardening-regression\n'),
      fetch: response(''),
      ahead_behind: response('0\t0\n'),
      prune_dry_run: response(''),
      fsck: response('dangling commit deadbeef\n'),
      radar_status: response('## sprint/S16-hardening-regression...origin/sprint/S16-hardening-regression\n'),
      radar_head: response('abc123\n'),
      radar_ahead_behind: response('0\t0\n'),
    },
    invoked,
  );

  const recovery = runRecoveryAction({ ...BASE_OPTIONS, runId: 'AT-S16-03-reindex' }, 'reindex_artifacts', runner);
  const diagnosis = runRecoveryAction({ ...BASE_OPTIONS, runId: 'AT-S16-03-diagnose' }, 'generate_diagnosis_report', runner);
  const syncTool = runOutOfSyncTool(
    { ...BASE_OPTIONS, runId: 'AT-S16-03-radar' },
    { expectedHead: 'abc123', expectedEvidencePaths: [] },
    runner,
  );

  assert.strictEqual(recovery.status, 'PASS');
  assert.strictEqual(diagnosis.status, 'PASS');
  assert.strictEqual(syncTool.result.status, 'PASS');
  assert.deepStrictEqual(
    Object.keys(recovery.records[0]).sort(),
    Object.keys(syncTool.records[0]).sort(),
    'Recovery and operator tools must share command receipt schema keys.',
  );

  const allowed = new Set(operatorExecutorAllowedSpecs().map((spec) => signature(spec.command, spec.args)));
  const requested = [
    ...recoveryActionSpecs('reindex_artifacts'),
    ...recoveryActionSpecs('generate_diagnosis_report'),
  ];
  for (const spec of requested) {
    assert.ok(allowed.has(signature(spec.command, spec.args)), `Spec not in shared allowlist: ${spec.id}`);
  }
  assert.ok(!invoked.includes('terminal_command'));

  writeJson(path.join(RECOVERY_ROOT, 'recovery_receipts.json'), {
    recovery_result: recovery.status,
    diagnosis_result: diagnosis.status,
    sync_result: syncTool.result.status,
    recovery_receipt_paths: recovery.receiptPaths,
    diagnosis_receipt_paths: diagnosis.receiptPaths,
    invoked_ids: invoked,
    requested_specs: requested,
  });
});

function signature(command: string, args: string[]): string {
  return `${command} ${args.join(' ')}`.trim();
}

function createRunner(map: Record<string, MockResponse>, invoked: string[]): CommandRunner {
  return (spec: CommandSpec, _cwd: string, _env: Record<string, string>, outStd: string, outErr: string) => {
    invoked.push(spec.id);
    const selected = map[spec.id] ?? response('');
    fs.mkdirSync(path.dirname(outStd), { recursive: true });
    fs.writeFileSync(outStd, selected.stdout, 'utf8');
    fs.writeFileSync(outErr, selected.stderr ?? '', 'utf8');
    return {
      stdout: selected.stdout,
      stderr: selected.stderr ?? '',
      exit_code: selected.exitCode ?? 0,
      start_ts: '2026-03-05T18:00:00Z',
      end_ts: '2026-03-05T18:00:01Z',
    };
  };
}

function response(stdout: string, exitCode = 0, stderr = ''): MockResponse {
  return { stdout, exitCode, stderr };
}

function writeJson(target: string, payload: unknown): void {
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function ensureDir(target: string): void {
  fs.mkdirSync(target, { recursive: true });
}

function resetDir(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
}

interface MockResponse {
  stdout: string;
  exitCode?: number;
  stderr?: string;
}
