import test from 'node:test';
import assert from 'node:assert';
import * as path from 'node:path';
import type { CommandReceipt, CommandRequest } from '../../engine/command_executor.ts';
import { runOpenPrProtocol, type ProtocolConfig } from './open_pr_protocol.ts';

const MOCK_CANONICAL_ROOT = '/tmp/promptops/S07/mock-repo';
const MOCK_COMMON_DIR = '/tmp/promptops/S07/mock-common/.git';

function makeReceipt(stdout: string, stderr = '', exitCode = 0): CommandReceipt {
  const now = new Date().toISOString();
  return {
    command: '',
    args: [],
    cwd: '',
    env_allowlist: [],
    start_ts: now,
    end_ts: now,
    stdout,
    stderr,
    exit_code: exitCode,
    timeout: false,
    policy_decision: 'executed',
    normalized_hash: 'mock',
    raw_artifact_paths: { receipt: '/tmp/mock/receipt.json', stdout: '/tmp/mock/stdout.log', stderr: '/tmp/mock/stderr.log' },
  };
}

function preflightReceipt(command: string, args: string[]): CommandReceipt {
  if (command === 'pwd') return makeReceipt(`${MOCK_CANONICAL_ROOT}\n`);
  if (command !== 'git') return makeReceipt('');
  const joined = args.join(' ');
  if (joined === 'rev-parse --show-toplevel') return makeReceipt(`${MOCK_CANONICAL_ROOT}\n`);
  if (joined === 'rev-parse --git-common-dir') return makeReceipt(`${MOCK_COMMON_DIR}\n`);
  if (joined === 'worktree list --porcelain') return makeReceipt(`worktree ${MOCK_CANONICAL_ROOT}\n`);
  if (joined === 'status --porcelain=v1 --branch') return makeReceipt('## main...origin/main\n');
  if (joined.startsWith('fetch --all --prune --tags')) return makeReceipt('');
  if (joined.startsWith('rev-list --left-right --count')) return makeReceipt('0\t0\n');
  if (joined === 'rev-parse --abbrev-ref HEAD') return makeReceipt('main\n');
  if (joined === 'log --oneline -5') return makeReceipt('fe432b3 test\n');
  if (joined === 'prune --dry-run') return makeReceipt('');
  if (joined === 'fsck --full') return makeReceipt('');
  return makeReceipt('');
}

function runWithMock(config: Partial<ProtocolConfig>, executor: (req: CommandRequest) => CommandReceipt) {
  return runOpenPrProtocol({
    cwd: MOCK_CANONICAL_ROOT,
    repo: 'Doogie201/promptops-gui',
    stagingRoot: `/tmp/promptops/S07/tests/${process.pid}/${Math.random().toString(16).slice(2)}`,
    canonicalRootEnv: MOCK_CANONICAL_ROOT,
    enforceMainPreflight: true,
    operatorApprovedMerge: false,
    resolveCodexThreads: true,
    previousSprintPrefix: 'S06',
    ...config,
    commandExecutor: executor,
  });
}

test('AT-S07-01 stops on unrelated open PR inventory', () => {
  const result = runWithMock({}, (req) => {
    const pre = preflightReceipt(req.command, req.args);
    if (pre.stdout || req.command !== 'gh') return pre;
    if (req.args[0] === 'pr' && req.args[1] === 'list') {
      return makeReceipt(
        JSON.stringify([
          {
            number: 101,
            title: '[S05] security : command executor + receipts engine',
            headRefName: 'sprint/S05-command-executor-receipts-engine',
            baseRefName: 'main',
            url: 'https://example/pr/101',
            updatedAt: '2026-03-04T00:00:00Z',
          },
          {
            number: 102,
            title: '[S99] unrelated',
            headRefName: 'feature/random',
            baseRefName: 'main',
            url: 'https://example/pr/102',
            updatedAt: '2026-03-04T00:00:00Z',
          },
        ]),
      );
    }
    return makeReceipt('');
  });

  assert.strictEqual(result.status, 'HARD_STOP');
  assert.strictEqual(result.reason_code, 'STOP_UNRELATED_OPEN_PRS');
  assert.ok(result.message.includes('Unrelated open PRs'));
});

test('AT-S07-02 readiness gate fails with explicit failing checks', () => {
  const result = runWithMock({}, (req) => {
    const pre = preflightReceipt(req.command, req.args);
    if (pre.stdout || req.command !== 'gh') return pre;
    if (req.args[0] === 'pr' && req.args[1] === 'list') {
      return makeReceipt(
        JSON.stringify([
          {
            number: 200,
            title: '[S06] chore : git + worktree preflight automation',
            headRefName: 'sprint/S06-git-worktree-preflight-automation',
            baseRefName: 'main',
            url: 'https://example/pr/200',
            updatedAt: '2026-03-04T00:00:00Z',
          },
        ]),
      );
    }
    if (req.args[0] === 'pr' && req.args[1] === 'view') {
      return makeReceipt(
        JSON.stringify({
          number: 200,
          mergeable: 'MERGEABLE',
          mergeStateStatus: 'CLEAN',
          reviewDecision: 'APPROVED',
          statusCheckRollup: [{ name: 'verify', status: 'IN_PROGRESS', conclusion: '' }],
          comments: [],
        }),
      );
    }
    if (req.args[0] === 'api' && req.args[1] === 'graphql') {
      return makeReceipt(
        JSON.stringify({
          data: {
            repository: {
              pullRequest: { reviewThreads: { nodes: [] }, comments: { nodes: [] } },
            },
          },
        }),
      );
    }
    return makeReceipt('');
  });

  assert.strictEqual(result.status, 'HARD_STOP');
  assert.strictEqual(result.reason_code, 'PR_NOT_MERGE_READY');
  const failing = (result.details?.failing_conditions ?? []) as Array<{ id: string }>;
  assert.ok(failing.some((item) => item.id === 'check:verify'));
});

test('AT-S07-03 codex unresolved thread resolves via GraphQL and passes', () => {
  let threadQueryCount = 0;
  const result = runWithMock({}, (req) => {
    const pre = preflightReceipt(req.command, req.args);
    if (pre.stdout || req.command !== 'gh') return pre;

    if (req.args[0] === 'pr' && req.args[1] === 'list') {
      return makeReceipt(
        JSON.stringify([
          {
            number: 300,
            title: '[S06] chore : git + worktree preflight automation',
            headRefName: 'sprint/S06-git-worktree-preflight-automation',
            baseRefName: 'main',
            url: 'https://example/pr/300',
            updatedAt: '2026-03-04T00:00:00Z',
          },
        ]),
      );
    }
    if (req.args[0] === 'pr' && req.args[1] === 'view') {
      return makeReceipt(
        JSON.stringify({
          number: 300,
          mergeable: 'MERGEABLE',
          mergeStateStatus: 'CLEAN',
          reviewDecision: 'APPROVED',
          statusCheckRollup: [{ name: 'verify', status: 'COMPLETED', conclusion: 'SUCCESS' }],
          comments: [],
        }),
      );
    }
    if (req.args[0] === 'api' && req.args[1] === 'graphql') {
      const queryArg = req.args.find((arg) => arg.startsWith('query=@')) ?? '';
      if (queryArg.includes('threads_query.graphql')) {
        threadQueryCount += 1;
        if (threadQueryCount <= 2) {
          return makeReceipt(
            JSON.stringify({
              data: {
                repository: {
                  pullRequest: {
                    reviewThreads: {
                      nodes: [
                        {
                          id: 'THREAD_1',
                          isResolved: false,
                          comments: { nodes: [{ id: 'C1', author: { login: 'chatgpt-codex' } }] },
                        },
                      ],
                    },
                    comments: { nodes: [] },
                  },
                },
              },
            }),
          );
        }
        return makeReceipt(
          JSON.stringify({
            data: {
              repository: {
                pullRequest: {
                  reviewThreads: {
                    nodes: [
                      {
                        id: 'THREAD_1',
                        isResolved: true,
                        comments: { nodes: [{ id: 'C1', author: { login: 'chatgpt-codex' } }] },
                      },
                    ],
                  },
                  comments: { nodes: [] },
                },
              },
            },
          }),
        );
      }
      return makeReceipt(JSON.stringify({ data: { resolveReviewThread: { thread: { id: 'THREAD_1', isResolved: true } } } }));
    }
    return makeReceipt('');
  });

  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.reason_code, 'MERGE_SKIPPED_NOT_APPROVED');
  assert.ok(result.timeline.some((item) => item.stage === 'CODEX_RESOLVE'));
  assert.ok(path.isAbsolute(result.canonical_root));
});
