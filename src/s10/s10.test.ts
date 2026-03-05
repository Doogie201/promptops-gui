import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createOperatorToolsSnapshot } from '../../apps/s10_gui_operator_tools_v1.ts';
import { createShellState } from '../s09/shell_state.ts';
import { createWizardState } from '../s09/setup_wizard.ts';
import { runCloseoutTool, runDiffReviewTool, runGatesTool, runOutOfSyncTool, runPreflightTool, runPrProtocolTool } from './operator_tools.ts';
import type { CommandRunner, CommandSpec, ToolOptions } from './operator_types.ts';

const TEST_ROOT = '/tmp/promptops/S10/tests';
const SANDBOX_ROOT = '/tmp/promptops/S10/test_workspace';
const STAGING_BASE = '/tmp/promptops/S10/test_workspace/tools';
const DURABLE_BASE = '/tmp/promptops/S10/test_workspace/durable';
const MOCK_REPO = '/tmp/promptops/S10/test_workspace/mock-repo';

const BASE_OPTIONS: ToolOptions = {
  sprintId: 'S10-gui-operator-tools-v1',
  runId: 'AT',
  repoRoot: MOCK_REPO,
  stagingBase: STAGING_BASE,
  durableBase: DURABLE_BASE,
  timestamp: '20260304T190000Z',
};

test('AT-S10-01 preflight tool writes mandatory receipts and enforces hard-stop rules', () => {
  resetDir(SANDBOX_ROOT);
  fs.mkdirSync(MOCK_REPO, { recursive: true });

  const runner = createRunner({
    pwd: response(MOCK_REPO),
    echo_promptops_repo: response(MOCK_REPO),
    show_toplevel: response(MOCK_REPO),
    worktree_list: response('worktree /tmp/promptops/S10/mock-repo\nbranch refs/heads/main\n'),
    status: response('## main...origin/main\n'),
    fetch: response(''),
    ahead_behind: response('0\t0\n'),
    branch: response('main\n'),
    log: response('abc1234 sample\n'),
    prune_dry_run: response(''),
    fsck: response('dangling commit 1111111\n'),
  });

  const pass = runPreflightTool({ ...BASE_OPTIONS, runId: 'AT-S10-01' }, runner);
  assert.strictEqual(pass.result.status, 'PASS');
  assert.ok(fileExists(pass.result.receiptPaths.preflight_commands));
  assert.ok(fileExists(pass.result.receiptPaths.preflight_outputs));
  assert.ok(fileExists(pass.result.receiptPaths.preflight_eval));

  const missingEnvRunner = createRunner({
    ...runnerMapFrom(runner),
    echo_promptops_repo: response(''),
  });
  const hardStop = runPreflightTool({ ...BASE_OPTIONS, runId: 'AT-S10-01b' }, missingEnvRunner);
  assert.strictEqual(hardStop.result.status, 'HARD_STOP');
  assert.strictEqual(hardStop.result.reasonCode, 'MISSING_REPO_ROOT');

  writeEvidence('AT-S10-01_run.json', {
    pass_result: pass.result,
    hard_stop_result: hardStop.result,
    durable_paths: [pass.durablePath, hardStop.durablePath],
  });
});

test('AT-S10-01c preflight hard-stops when ahead>0 and when fetch/sync probes fail', () => {
  resetDir(SANDBOX_ROOT);
  fs.mkdirSync(MOCK_REPO, { recursive: true });
  const baseMap = runnerMapFrom(createRunner({}));

  const aheadRunner = createRunner({
    ...baseMap,
    status: response('## main...origin/main [ahead 1]\n'),
    ahead_behind: response('1\t0\n'),
  });
  const aheadStop = runPreflightTool({ ...BASE_OPTIONS, runId: 'AT-S10-01c-ahead' }, aheadRunner);
  assert.strictEqual(aheadStop.result.status, 'HARD_STOP');
  assert.strictEqual(aheadStop.result.reasonCode, 'REPO_ROOT_NOT_ON_MAIN_NOT_SYNCED');
  assert.match(aheadStop.result.message, /ahead=1/);

  const fetchFailRunner = createRunner({
    ...baseMap,
    fetch: response('', 128, 'fatal: auth failed\n'),
  });
  const fetchStop = runPreflightTool({ ...BASE_OPTIONS, runId: 'AT-S10-01c-fetch' }, fetchFailRunner);
  assert.strictEqual(fetchStop.result.status, 'HARD_STOP');
  assert.strictEqual(fetchStop.result.reasonCode, 'REPO_ROOT_NOT_ON_MAIN_NOT_SYNCED');
  assert.match(fetchStop.result.message, /fetch probe failed/);

  const syncFailRunner = createRunner({
    ...baseMap,
    ahead_behind: response('', 2, 'fatal: probe failed\n'),
  });
  const syncStop = runPreflightTool({ ...BASE_OPTIONS, runId: 'AT-S10-01c-sync' }, syncFailRunner);
  assert.strictEqual(syncStop.result.status, 'HARD_STOP');
  assert.strictEqual(syncStop.result.reasonCode, 'REPO_ROOT_NOT_ON_MAIN_NOT_SYNCED');
  assert.match(syncStop.result.message, /ahead\/behind probe failed/);

  writeEvidence('AT-S10-01c_run.json', {
    ahead_stop: aheadStop.result,
    fetch_stop: fetchStop.result,
    sync_stop: syncStop.result,
  });
});

test('AT-S10-02 PR protocol tool evaluates readiness and codex thread resolution with receipts', () => {
  resetDir(SANDBOX_ROOT);
  fs.mkdirSync(MOCK_REPO, { recursive: true });

  const runner = createRunner({
    open_pr_list: response(
      JSON.stringify([
        {
          number: 21,
          title: '[S09] nav : gui shell v1 + setup wizard + agent switching',
          headRefName: 'sprint/S09-gui-shell-setup-wizard-agent-switching',
          baseRefName: 'main',
          url: 'https://example/pr/21',
          updatedAt: '2026-03-04T19:00:00Z',
        },
      ]),
    ),
    pr_view: response(
      JSON.stringify({
        number: 21,
        state: 'OPEN',
        mergeable: 'MERGEABLE',
        mergeStateStatus: 'CLEAN',
        reviewDecision: 'APPROVED',
        statusCheckRollup: [{ name: 'ci', status: 'COMPLETED', conclusion: 'SUCCESS' }],
      }),
    ),
    pr_threads_before: response(
      JSON.stringify({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    id: 'thread-1',
                    isResolved: false,
                    comments: { nodes: [{ author: { login: 'chatgpt-codex' }, bodyText: 'please fix' }] },
                  },
                ],
              },
              comments: { nodes: [] },
            },
          },
        },
      }),
    ),
    'resolve_thread-1': response(JSON.stringify({ data: { resolveReviewThread: { thread: { id: 'thread-1', isResolved: true } } } })),
    pr_threads_after: response(
      JSON.stringify({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [
                  {
                    id: 'thread-1',
                    isResolved: true,
                    comments: { nodes: [{ author: { login: 'chatgpt-codex' } }] },
                  },
                ],
              },
              comments: { nodes: [] },
            },
          },
        },
      }),
    ),
  });

  const run = runPrProtocolTool(
    { ...BASE_OPTIONS, runId: 'AT-S10-02' },
    { repo: 'Doogie201/promptops-gui', previousSprintPrefix: 'S09', resolveCodexThreads: true },
    runner,
  );
  assert.strictEqual(run.result.status, 'PASS');
  assert.ok(fileExists(run.result.receiptPaths.open_pr_list));
  assert.ok(fileExists(run.result.receiptPaths.pr_view));
  assert.ok(fileExists(run.result.receiptPaths.pr_threads_before));
  assert.ok(fileExists(run.result.receiptPaths.pr_threads_after));
  assert.ok(fileExists(run.result.receiptPaths.graphql_resolve_mutations));

  writeEvidence('AT-S10-02_run.json', {
    result: run.result,
    receipt_paths: run.result.receiptPaths,
    durable_path: run.durablePath,
  });
});

test('AT-S10-03 gates + diff + out-of-sync + closeout assistant form deterministic GUI workflow', () => {
  resetDir(SANDBOX_ROOT);
  fs.mkdirSync(MOCK_REPO, { recursive: true });
  fs.mkdirSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S10'), { recursive: true });
  fs.writeFileSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S10', 'README.md'), '# mock\\n', 'utf8');

  const gatesRunner = createRunner({
    gate_readiness_status: response('## main...origin/main\n'),
    gate_verify: response('[verify] ok\n'),
    gate_gates_sh: response('Gates passed.\n'),
  });
  const gates = runGatesTool({ ...BASE_OPTIONS, runId: 'AT-S10-03-gates' }, gatesRunner);
  assert.strictEqual(gates.result.status, 'PASS');

  const diffRunner = createRunner({
    diff_files: response('src/s10/operator_tools.ts\ndocs/sprints/S10/README.md\n'),
    diffstat: response(' src/s10/operator_tools.ts | 12 ++++++++++--\n 1 file changed, 10 insertions(+), 2 deletions(-)\n'),
    diff_numstat: response('10\t2\tsrc/s10/operator_tools.ts\n'),
  });
  const diff = runDiffReviewTool(
    { ...BASE_OPTIONS, runId: 'AT-S10-03-diff' },
    { whitelist: ['src/**', 'docs/sprints/S10/**'], maxNetNewLinesPerFile: 120 },
    diffRunner,
  );
  assert.strictEqual(diff.result.status, 'PASS');

  const outRunner = createRunner({
    radar_status: response('## main...origin/main\n'),
    radar_head: response('abc123\n'),
    radar_ahead_behind: response('0\t0\n'),
  });
  const out = runOutOfSyncTool(
    { ...BASE_OPTIONS, runId: 'AT-S10-03-out' },
    { expectedHead: 'abc123', expectedEvidencePaths: [diff.result.receiptPaths.diff_files] },
    outRunner,
  );
  assert.strictEqual(out.result.status, 'PASS');

  const closeout = runCloseoutTool(
    { ...BASE_OPTIONS, runId: 'AT-S10-03-closeout' },
    [
      { id: 'AT-S10-01', label: 'Preflight tool', done: true },
      { id: 'AT-S10-02', label: 'PR protocol tool', done: true },
      { id: 'AT-S10-03', label: 'Workflow tools', done: true },
    ],
    [gates.result.receiptPaths.gates_eval, diff.result.receiptPaths.whitelist_eval, out.result.receiptPaths.diagnosis_report],
    createRunner({
      closeout_status_before: response('## sprint/S10...origin/sprint/S10\n?? docs/sprints/S10/evidence/closeout/AT-S10-03-closeout/bundle/run_context.json\n'),
      closeout_add_evidence: response(''),
      closeout_commit: response('[sprint/S10 123abc] docs: atomic closeout evidence sync\n 3 files changed\n'),
      closeout_push: response('To origin\n   abc..def  sprint/S10 -> sprint/S10\n'),
      closeout_status_after_push: response('## sprint/S10...origin/sprint/S10\n'),
    }),
  );
  assert.strictEqual(closeout.result.status, 'PASS');
  assert.ok(fileExists(closeout.result.receiptPaths.closeout_atomic_commands));
  assert.ok(fileExists(closeout.result.receiptPaths.closeout_atomic_outputs));
  assert.ok(fileExists(closeout.result.receiptPaths.closeout_atomic_eval));

  const shell = createShellState(createWizardState('2026-03-04T19:00:00Z'));
  const snapshot = createOperatorToolsSnapshot(shell, MOCK_REPO, MOCK_REPO, [gates.result, diff.result, out.result, closeout.result]);
  assert.strictEqual(snapshot.guardrail.matches, true);
  assert.strictEqual(snapshot.nav.items.length, 6);

  writeEvidence('AT-S10-03_run.json', {
    gates_result: gates.result,
    diff_result: diff.result,
    out_result: out.result,
    closeout_result: closeout.result,
    snapshot,
  });
});

test('AT-S10-03b diff budget uses net line change (added - deleted)', () => {
  resetDir(SANDBOX_ROOT);
  fs.mkdirSync(MOCK_REPO, { recursive: true });

  const neutralRunner = createRunner({
    diff_files: response('src/s10/operator_tools.ts\n'),
    diffstat: response(' src/s10/operator_tools.ts | 400 ++++++++++++++++++------------------\n'),
    diff_numstat: response('200\t200\tsrc/s10/operator_tools.ts\n'),
  });
  const neutral = runDiffReviewTool(
    { ...BASE_OPTIONS, runId: 'AT-S10-03b-neutral' },
    { whitelist: ['src/**'], maxNetNewLinesPerFile: 120 },
    neutralRunner,
  );
  assert.strictEqual(neutral.result.status, 'PASS');

  const breachRunner = createRunner({
    diff_files: response('src/s10/operator_tools.ts\n'),
    diffstat: response(' src/s10/operator_tools.ts | 240 ++++++++++++++++++++++--\n'),
    diff_numstat: response('200\t10\tsrc/s10/operator_tools.ts\n'),
  });
  const breach = runDiffReviewTool(
    { ...BASE_OPTIONS, runId: 'AT-S10-03b-breach' },
    { whitelist: ['src/**'], maxNetNewLinesPerFile: 120 },
    breachRunner,
  );
  assert.strictEqual(breach.result.status, 'HARD_STOP');
  assert.match(breach.result.message, /Budget breaches/);

  writeEvidence('AT-S10-03b_run.json', {
    neutral_result: neutral.result,
    breach_result: breach.result,
  });
});

test('AT-S10-03c closeout hard-stops when untracked evidence remains after atomic sync', () => {
  resetDir(SANDBOX_ROOT);
  fs.mkdirSync(MOCK_REPO, { recursive: true });

  const closeout = runCloseoutTool(
    { ...BASE_OPTIONS, runId: 'AT-S10-03c-closeout' },
    [{ id: 'AT-S10-03c', label: 'Atomic closeout gate', done: true }],
    [],
    createRunner({
      closeout_status_before: response('## sprint/S10...origin/sprint/S10\n?? docs/sprints/S10/evidence/closeout/AT-S10-03c-closeout/bundle/run_context.json\n'),
      closeout_add_evidence: response(''),
      closeout_commit: response('[sprint/S10 456def] docs: atomic closeout evidence sync\n 1 file changed\n'),
      closeout_push: response('To origin\n   def..ghi  sprint/S10 -> sprint/S10\n'),
      closeout_status_after_push: response('## sprint/S10...origin/sprint/S10\n?? docs/sprints/S10/evidence/closeout/AT-S10-03c-closeout/bundle/run_context.json\n'),
    }),
  );

  assert.strictEqual(closeout.result.status, 'HARD_STOP');
  assert.strictEqual(closeout.result.reasonCode, 'UNTRACKED_EVIDENCE');
  assert.match(closeout.result.message, /untracked durable evidence remains/);

  writeEvidence('AT-S10-03c_run.json', {
    closeout_result: closeout.result,
    durable_path: closeout.durablePath,
  });
});

function createRunner(map: Record<string, MockResponse>): CommandRunner {
  return (spec: CommandSpec, _cwd: string, _env: Record<string, string>, outStd: string, outErr: string) => {
    const selected = map[spec.id] ?? response('');
    fs.mkdirSync(path.dirname(outStd), { recursive: true });
    fs.writeFileSync(outStd, selected.stdout, 'utf8');
    fs.writeFileSync(outErr, selected.stderr ?? '', 'utf8');
    return {
      stdout: selected.stdout,
      stderr: selected.stderr ?? '',
      exit_code: selected.exitCode ?? 0,
      start_ts: '2026-03-04T19:00:00Z',
      end_ts: '2026-03-04T19:00:01Z',
    };
  };
}

function runnerMapFrom(_runner: CommandRunner): Record<string, MockResponse> {
  return {
    pwd: response(MOCK_REPO),
    echo_promptops_repo: response(MOCK_REPO),
    show_toplevel: response(MOCK_REPO),
    worktree_list: response('worktree /tmp/promptops/S10/mock-repo\nbranch refs/heads/main\n'),
    status: response('## main...origin/main\n'),
    fetch: response(''),
    ahead_behind: response('0\t0\n'),
    branch: response('main\n'),
    log: response('abc1234 sample\n'),
    prune_dry_run: response(''),
    fsck: response(''),
  };
}

function response(stdout: string, exitCode = 0, stderr = ''): MockResponse {
  return { stdout, exitCode, stderr };
}

function writeEvidence(fileName: string, payload: Record<string, unknown>): void {
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  fs.writeFileSync(path.join(TEST_ROOT, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function fileExists(filePath: string): boolean {
  return fs.existsSync(path.resolve(filePath));
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
