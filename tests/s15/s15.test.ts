import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runOutOfSyncTool } from '../../src/s10/operator_tools.ts';
import type { CommandRunner, CommandSpec, ToolOptions } from '../../src/s10/operator_types.ts';
import {
  createTerminalPanelState,
  runTerminalPanelCommand,
  setTerminalPanelEnabled,
  terminalCommandTemplates,
  renderTemplateCommand,
} from '../../src/s15/terminal_panel.ts';

const TEST_ROOT = '/tmp/promptops/S15/tests';
const WORKSPACE_ROOT = '/tmp/promptops/S15/test_workspace';
const STAGING_BASE = path.join(WORKSPACE_ROOT, 'staging');
const DURABLE_BASE = path.join(WORKSPACE_ROOT, 'durable');
const MOCK_REPO = path.join(WORKSPACE_ROOT, 'mock-repo');
const TERMINAL_EVIDENCE = '/tmp/promptops/S15/terminal';
const DRIFT_EVIDENCE = '/tmp/promptops/S15/drift';

const BASE_OPTIONS: ToolOptions = {
  sprintId: 'S15-terminal-panel',
  runId: 'AT-S15',
  repoRoot: MOCK_REPO,
  stagingBase: STAGING_BASE,
  durableBase: DURABLE_BASE,
  timestamp: '20260305T040000Z',
};

test('AT-S15-01: terminal command uses same receipt schema as GUI executor path', () => {
  resetDir(WORKSPACE_ROOT);
  ensureDir(TEST_ROOT);
  prepareMockRepo();
  ensureDir(TERMINAL_EVIDENCE);

  const invoked: string[] = [];
  const runner = createRunner(
    {
      radar_status: response('## sprint/S15-terminal-panel...origin/sprint/S15-terminal-panel\n'),
      radar_head: response('abc123\n'),
      radar_ahead_behind: response('0\t0\n'),
      terminal_command: response('## sprint/S15-terminal-panel...origin/sprint/S15-terminal-panel\n'),
    },
    invoked,
  );

  const state = setTerminalPanelEnabled(createTerminalPanelState(), true);
  const terminal = runTerminalPanelCommand(
    { ...BASE_OPTIONS, runId: 'AT-S15-01-terminal' },
    state,
    { commandLine: 'git status --porcelain=v1 --branch', expectedHead: 'abc123' },
    runner,
  );

  const gui = runOutOfSyncTool(
    { ...BASE_OPTIONS, runId: 'AT-S15-01-gui' },
    { expectedHead: 'abc123', expectedEvidencePaths: [] },
    runner,
  );

  assert.strictEqual(terminal.result.status, 'PASS');
  assert.strictEqual(gui.result.status, 'PASS');
  assert.strictEqual(terminal.records.length, 1);
  assert.strictEqual(gui.records.length, 3);
  assert.deepStrictEqual(
    Object.keys(terminal.records[0]).sort(),
    Object.keys(gui.records[0]).sort(),
    'Terminal and GUI must emit the same command receipt schema keys.',
  );
  assert.ok(invoked.includes('terminal_command'));

  writeEvidence(
    TERMINAL_EVIDENCE,
    'AT-S15-01_receipt_schema.json',
    {
      terminal_result: terminal.result,
      gui_result: gui.result,
      terminal_record_keys: Object.keys(terminal.records[0]).sort(),
      gui_record_keys: Object.keys(gui.records[0]).sort(),
      terminal_durable: terminal.durablePath,
      gui_durable: gui.durablePath,
      invoked,
    },
  );
});

test('AT-S15-02: disallowed commands are blocked and recorded as security events', () => {
  prepareMockRepo();
  ensureDir(TERMINAL_EVIDENCE);

  const state = setTerminalPanelEnabled(createTerminalPanelState(), true);
  const blocked = runTerminalPanelCommand(
    { ...BASE_OPTIONS, runId: 'AT-S15-02-blocked' },
    state,
    { commandLine: 'rm -rf /tmp/unsafe' },
  );

  assert.strictEqual(blocked.result.status, 'HARD_STOP');
  assert.strictEqual(blocked.result.reasonCode, 'WHITELIST_VIOLATION');
  assert.strictEqual(blocked.records[0].exit_code, 126);
  assert.strictEqual(blocked.events.length, 1);
  assert.strictEqual(blocked.events[0].type, 'terminal_command_blocked');
  assert.match(blocked.events[0].reason, /Disallowed command class|not in the shared executor allowlist/);

  writeEvidence(
    TERMINAL_EVIDENCE,
    'AT-S15-02_blocked_security_event.json',
    {
      result: blocked.result,
      event: blocked.events[0],
      record: blocked.records[0],
      durable: blocked.durablePath,
    },
  );
});

test('AT-S15-02b: command must match full shared argument signature', () => {
  prepareMockRepo();

  const state = setTerminalPanelEnabled(createTerminalPanelState(), true);
  const blocked = runTerminalPanelCommand(
    { ...BASE_OPTIONS, runId: 'AT-S15-02b-blocked' },
    state,
    { commandLine: 'git prune --expire now' },
  );

  assert.strictEqual(blocked.result.status, 'HARD_STOP');
  assert.strictEqual(blocked.result.reasonCode, 'WHITELIST_VIOLATION');
  assert.match(blocked.result.message, /outside shared GUI policy/);
});

test('AT-S15-03: terminal command path cannot bypass out-of-sync hard stop', () => {
  prepareMockRepo();
  ensureDir(DRIFT_EVIDENCE);

  const invoked: string[] = [];
  const syncFailRunner = createRunner(
    {
      radar_status: response('## sprint/S15-terminal-panel...origin/sprint/S15-terminal-panel\n'),
      radar_head: response('abc123\n'),
      radar_ahead_behind: response('0\t1\n'),
      terminal_command: response('this should not run\n'),
    },
    invoked,
  );

  const state = setTerminalPanelEnabled(createTerminalPanelState(), true);
  const terminal = runTerminalPanelCommand(
    { ...BASE_OPTIONS, runId: 'AT-S15-03-terminal' },
    state,
    { commandLine: 'git status --porcelain=v1 --branch', expectedHead: 'abc123' },
    syncFailRunner,
  );

  assert.strictEqual(terminal.result.status, 'HARD_STOP');
  assert.strictEqual(terminal.result.reasonCode, 'OUT_OF_SYNC');
  assert.strictEqual(terminal.events.length, 1);
  assert.strictEqual(terminal.events[0].type, 'terminal_sync_blocked');
  assert.ok(!invoked.includes('terminal_command'), 'Command execution must be blocked before terminal command dispatch.');

  const gui = runOutOfSyncTool(
    { ...BASE_OPTIONS, runId: 'AT-S15-03-gui' },
    { expectedHead: 'abc123', expectedEvidencePaths: [] },
    createRunner(
      {
        radar_status: response('## sprint/S15-terminal-panel...origin/sprint/S15-terminal-panel\n'),
        radar_head: response('abc123\n'),
        radar_ahead_behind: response('0\t1\n'),
      },
      [],
    ),
  );
  assert.strictEqual(gui.result.status, 'FAIL');
  assert.strictEqual(gui.result.reasonCode, 'OUT_OF_SYNC');

  writeEvidence(
    DRIFT_EVIDENCE,
    'AT-S15-03_sync_gate.json',
    {
      terminal_result: terminal.result,
      terminal_events: terminal.events,
      gui_result: gui.result,
      invoked,
      terminal_durable: terminal.durablePath,
      gui_durable: gui.durablePath,
    },
  );
});

test('S15 templates are deterministic and parameterized safely', () => {
  const templates = terminalCommandTemplates();
  assert.ok(templates.length >= 5);
  assert.strictEqual(renderTemplateCommand('git_status'), 'git status --porcelain=v1 --branch');
  assert.strictEqual(
    renderTemplateCommand('gh_pr_checks'),
    'gh pr list --repo Doogie201/promptops-gui --state open --json number,title,headRefName,baseRefName,url,updatedAt',
  );
  assert.strictEqual(renderTemplateCommand('npm_test_all'), 'npm run -s verify');
});

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
      start_ts: '2026-03-05T04:00:00Z',
      end_ts: '2026-03-05T04:00:01Z',
    };
  };
}

function response(stdout: string, exitCode = 0, stderr = ''): MockResponse {
  return { stdout, exitCode, stderr };
}

function writeEvidence(dir: string, fileName: string, payload: Record<string, unknown>): void {
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function resetDir(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
}

function prepareMockRepo(): void {
  fs.mkdirSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S10'), { recursive: true });
  fs.writeFileSync(path.join(MOCK_REPO, 'docs', 'sprints', 'S10', 'README.md'), '# mock\\n', 'utf8');
}

interface MockResponse {
  stdout: string;
  exitCode?: number;
  stderr?: string;
}

const _unused = TEST_ROOT;
