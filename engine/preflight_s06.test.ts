import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { runS06PreflightAutomation } from './preflight_s06.ts';

const TMP_ROOT = `/tmp/promptops/S06/tests/${process.pid}`;

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function runCmd(cwd: string, args: string[]): string {
  const proc = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.strictEqual(proc.status, 0, `git ${args.join(' ')} failed:\n${proc.stderr}`);
  return (proc.stdout ?? '').trim();
}

function initRepo(repoPath: string): void {
  ensureDir(repoPath);
  runCmd(repoPath, ['init', '--initial-branch=main']);
  runCmd(repoPath, ['config', 'user.name', 'S06 Test']);
  runCmd(repoPath, ['config', 'user.email', 's06@test.local']);
}

function commitTrackedFile(repoPath: string, relativePath: string, content: string, message: string): void {
  const filePath = path.join(repoPath, relativePath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
  runCmd(repoPath, ['add', relativePath]);
  runCmd(repoPath, ['commit', '-m', message]);
}

function setupPrimaryRepo(testId: string): { root: string; primaryPath: string } {
  const root = path.join(TMP_ROOT, testId);
  const primaryPath = path.join(root, 'primary');
  const remotePath = path.join(root, 'origin.git');

  fs.rmSync(root, { recursive: true, force: true });
  ensureDir(root);
  initRepo(primaryPath);
  commitTrackedFile(primaryPath, 'README.md', `fixture ${testId}\n`, 'fixture: seed primary repo');
  runCmd(root, ['init', '--bare', remotePath]);
  runCmd(primaryPath, ['remote', 'add', 'origin', remotePath]);
  runCmd(primaryPath, ['push', '-u', 'origin', 'main']);

  return { root, primaryPath };
}

function setupLocalRepo(root: string, branchName: string): string {
  const localPath = path.join(root, 'local');
  initRepo(localPath);
  commitTrackedFile(localPath, 'tracked.txt', 'initial\n', 'fixture: seed local repo');
  runCmd(localPath, ['checkout', '-b', branchName]);
  return localPath;
}

test('AT-S06-02 branch noncompliance triggers hard stop with deterministic remediation', () => {
  const fixture = setupPrimaryRepo('at-s06-02');
  const localPath = setupLocalRepo(fixture.root, 'feature/not-sprint');

  const result = runS06PreflightAutomation({
    primaryWorktreePath: fixture.primaryPath,
    localWorktreePath: localPath,
    baseBranch: 'main',
    branchPrefixRegexGeneric: '^sprint/S\\d{2}-',
    branchPrefixRegexSprint: '^sprint/S06-',
    receiptDir: path.join(fixture.root, 'receipts-at-s06-02'),
    allowedRoots: [fixture.root, '/tmp/promptops/S06'],
    prunePolicy: 'OFF',
  });

  assert.strictEqual(result.status, 'HARD_STOP');
  assert.strictEqual(result.hard_stop_code, 'HARD_STOP_BRANCH_NONCOMPLIANCE');
  assert.strictEqual(result.branch_name, 'feature/not-sprint');
  assert.ok(result.remediation?.some((line) => line.includes('git branch -m feature/not-sprint sprint/S06-git-worktree-preflight-automation')));
  assert.ok(result.remediation?.some((line) => line.includes('git push -u origin sprint/S06-git-worktree-preflight-automation')));
  assert.ok(result.events.some((event) => event.code === 'HARD_STOP_BRANCH_NONCOMPLIANCE'));

  const requiredPrimaryArgs = [
    'rev-parse --show-toplevel',
    'worktree list --porcelain',
    'status --porcelain=v1 --branch',
    'fetch --all --prune --tags',
    'rev-list --left-right --count HEAD...origin/main',
    'rev-parse --abbrev-ref HEAD',
    'log --oneline -5',
  ];
  for (const args of requiredPrimaryArgs) {
    assert.ok(
      result.receipts.some((receipt) => receipt.command === 'git' && receipt.cwd === fixture.primaryPath && receipt.args.join(' ') === args),
      `missing primary receipt for: ${args}`,
    );
  }
});

test('AT-S06-03 out-of-sync state change emits deterministic OUT_OF_SYNC hard stop', () => {
  const fixture = setupPrimaryRepo('at-s06-03');
  const localPath = setupLocalRepo(fixture.root, 'sprint/S06-out-of-sync');
  const trackedPath = path.join(localPath, 'tracked.txt');

  const result = runS06PreflightAutomation({
    primaryWorktreePath: fixture.primaryPath,
    localWorktreePath: localPath,
    baseBranch: 'main',
    branchPrefixRegexGeneric: '^sprint/S\\d{2}-',
    branchPrefixRegexSprint: '^sprint/S06-',
    receiptDir: path.join(fixture.root, 'receipts-at-s06-03'),
    allowedRoots: [fixture.root, '/tmp/promptops/S06'],
    prunePolicy: 'OFF',
    onBeforePostBatchCheck: () => {
      fs.appendFileSync(trackedPath, 'changed during run\n', 'utf8');
    },
  });

  assert.strictEqual(result.status, 'HARD_STOP');
  assert.strictEqual(result.hard_stop_code, 'OUT_OF_SYNC');
  const outOfSyncEvent = result.events.find((event) => event.code === 'OUT_OF_SYNC');
  assert.ok(outOfSyncEvent, 'OUT_OF_SYNC event missing');

  const details = outOfSyncEvent?.details as {
    before?: { status_hash?: string; status_raw?: string };
    after?: { status_hash?: string; status_raw?: string };
  };

  assert.ok(details.before?.status_hash);
  assert.ok(details.after?.status_hash);
  assert.notStrictEqual(details.before?.status_hash, details.after?.status_hash);
  assert.notStrictEqual(details.before?.status_raw, details.after?.status_raw);
});
