import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommandRunner, CommandSpec } from '../../src/s10/operator_types.ts';
import { createNodeOperatorApi } from '../../src/s17/operator_api_node.ts';
import { findForbiddenUiImports, guardUiImportDirection } from '../../src/s17/import_guard.ts';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROOT = '/tmp/promptops/S17/tests';
const MOCK_REPO = path.join(ROOT, 'mock-repo');

test('AT-S17-02: preflight action flows through façade to operator pathway with deterministic envelope', async () => {
  resetDir(ROOT);
  fs.mkdirSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S10'), { recursive: true });
  fs.writeFileSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S10', 'README.md'), '# s10\n', 'utf8');

  const invoked: string[] = [];
  const api = createNodeOperatorApi(
    {
      repoRoot: MOCK_REPO,
      stagingBase: path.join(ROOT, 'staging'),
      durableBase: path.join(ROOT, 'durable'),
      sprintId: 'S17-gui-entrypoint-dashboard',
    },
    createRunner(
      {
        pwd: response(`${MOCK_REPO}\n`),
        echo_promptops_repo: response(`${MOCK_REPO}\n`),
        show_toplevel: response(`${MOCK_REPO}\n`),
        worktree_list: response(`worktree ${MOCK_REPO}\nbranch refs/heads/main\n`),
        status: response('## main...origin/main\n'),
        fetch: response(''),
        ahead_behind: response('0\t0\n'),
        branch: response('main\n'),
        log: response('abc123 test\n'),
        prune_dry_run: response(''),
        fsck: response('dangling commit deadbeef\n'),
      },
      invoked,
    ),
  );

  const req = { requestId: 'preflight_001', timestamp: 'S17_preflight_001' };
  const first = await api.runPreflight(req);
  const second = await api.runPreflight(req);

  assert.strictEqual(first.status, 'PASS');
  assert.strictEqual(second.status, 'PASS');
  assert.strictEqual(first.resultHash, second.resultHash);
  assert.deepStrictEqual(
    invoked,
    [
      'pwd',
      'echo_promptops_repo',
      'show_toplevel',
      'worktree_list',
      'status',
      'fetch',
      'ahead_behind',
      'branch',
      'log',
      'prune_dry_run',
      'fsck',
      'pwd',
      'echo_promptops_repo',
      'show_toplevel',
      'worktree_list',
      'status',
      'fetch',
      'ahead_behind',
      'branch',
      'log',
      'prune_dry_run',
      'fsck',
    ],
  );
  assert.ok(first.receipts.length >= 11);
});

test('AT-S17-03: gates action returns FAIL deterministically on non-zero command', async () => {
  const api = createNodeOperatorApi(
    {
      repoRoot: MOCK_REPO,
      stagingBase: path.join(ROOT, 'staging-gates'),
      durableBase: path.join(ROOT, 'durable-gates'),
    },
    createRunner({
      gate_readiness_status: response('## sprint/S17-gui-entrypoint-dashboard\n'),
      gate_verify: response('verify failed\n', 2, 'verify failure\n'),
      gate_gates_sh: response('gates skipped\n'),
    }),
  );

  const result = await api.runGates({ requestId: 'gates_001', timestamp: 'S17_gates_001' });
  assert.strictEqual(result.status, 'FAIL');
  assert.strictEqual(result.reasonCode, 'PR_NOT_READY');
  assert.strictEqual(result.exitCode, 2);
});

test('AT-S17-04: S17 code has no mount-specific absolute paths and repo-root can come from env', async () => {
  process.env.PROMPTOPS_REPO = MOCK_REPO;
  const api = createNodeOperatorApi(
    {
      stagingBase: path.join(ROOT, 'staging-status'),
      durableBase: path.join(ROOT, 'durable-status'),
    },
    createRunner({
      radar_status: response('## main...origin/main\n'),
      radar_head: response('abc123\n'),
      radar_ahead_behind: response('0\t0\n'),
    }),
  );

  const status = await api.getRunStatus({ requestId: 'status_001', timestamp: 'S17_status_001' });
  assert.strictEqual(status.request.repoRootStrategy, 'env_PROMPTOPS_REPO');
  assert.strictEqual(status.status, 'PASS');

  const files = ['src/s17/main.ts', 'src/s17/dashboard_app.ts', 'src/s17/operator_api_node.ts'];
  for (const file of files) {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    assert.ok(!/\/Volumes\//.test(content));
    assert.ok(!/\/Users\//.test(content));
  }
});

test('AT-S17-05: import-direction guard catches forbidden deep imports', () => {
  const badSource = `import { runPreflightTool } from "../s10/operator_tools.ts";`;
  const direct = findForbiddenUiImports(badSource);
  assert.strictEqual(direct.length, 1);

  const appSource = fs.readFileSync(path.join(REPO_ROOT, 'src/s17/dashboard_app.ts'), 'utf8');
  const mainSource = fs.readFileSync(path.join(REPO_ROOT, 'src/s17/main.ts'), 'utf8');
  const violations = guardUiImportDirection([
    { filePath: 'src/s17/dashboard_app.ts', source: appSource },
    { filePath: 'src/s17/main.ts', source: mainSource },
  ]);
  assert.strictEqual(violations.length, 0);
});

test('AT-S17-05b: dashboard uses delegated click handling to preserve actions across re-renders', () => {
  const dashboardSource = fs.readFileSync(path.join(REPO_ROOT, 'src/s17/dashboard_app.ts'), 'utf8');
  assert.ok(dashboardSource.includes("root.addEventListener('click'"));
  assert.ok(!dashboardSource.includes('querySelector<HTMLButtonElement>('));
});

function createRunner(map: Record<string, MockResponse>, invoked?: string[]): CommandRunner {
  return (spec: CommandSpec, _cwd: string, _env: Record<string, string>, outStd: string, outErr: string) => {
    if (invoked) invoked.push(spec.id);
    const value = map[spec.id] ?? response('');
    fs.mkdirSync(path.dirname(outStd), { recursive: true });
    fs.writeFileSync(outStd, value.stdout, 'utf8');
    fs.writeFileSync(outErr, value.stderr ?? '', 'utf8');
    return {
      stdout: value.stdout,
      stderr: value.stderr ?? '',
      exit_code: value.exitCode ?? 0,
      start_ts: '2026-03-05T17:00:00Z',
      end_ts: '2026-03-05T17:00:01Z',
    };
  };
}

function response(stdout: string, exitCode = 0, stderr = ''): MockResponse {
  return { stdout, exitCode, stderr };
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
