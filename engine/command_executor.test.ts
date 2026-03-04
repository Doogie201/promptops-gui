import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defaultAllowedRoots, executeSandboxedCommand } from './command_executor.ts';

const REPO_ROOT = process.cwd();
const TMP_ROOT = '/tmp/promptops/S05';

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function appendJsonl(filePath: string, data: unknown): void {
  fs.appendFileSync(filePath, `${JSON.stringify(data)}\n`);
}

test('AT-S05-01 disallowed command/path is blocked with clear error and recorded event', () => {
  const securityDir = path.join(TMP_ROOT, 'security', 'at-s05-01');
  ensureDir(securityDir);

  const blockedCommand = executeSandboxedCommand({
    command: 'cat',
    args: ['/etc/passwd'],
    cwd: REPO_ROOT,
    repoRoot: REPO_ROOT,
    allowedRoots: defaultAllowedRoots(REPO_ROOT),
    receiptDir: securityDir,
  });

  assert.strictEqual(blockedCommand.policy_decision, 'blocked');
  assert.strictEqual(blockedCommand.exit_code, 126);
  assert.match(blockedCommand.stderr, /not allowlisted/);
  assert.ok(fs.existsSync(blockedCommand.raw_artifact_paths.receipt));

  const blockedPath = executeSandboxedCommand({
    command: 'git',
    args: ['status', '--', '/etc/passwd'],
    cwd: REPO_ROOT,
    repoRoot: REPO_ROOT,
    allowedRoots: defaultAllowedRoots(REPO_ROOT),
    receiptDir: securityDir,
  });

  assert.strictEqual(blockedPath.policy_decision, 'blocked');
  assert.strictEqual(blockedPath.exit_code, 126);
  assert.match(blockedPath.stderr, /escapes allowlisted roots|outside allowlisted roots/);
  assert.ok(fs.existsSync(blockedPath.raw_artifact_paths.receipt));

  appendJsonl(path.join(securityDir, 'EVD-S05-02_whitelist_violation_proofs.jsonl'), blockedCommand);
  appendJsonl(path.join(securityDir, 'EVD-S05-02_whitelist_violation_proofs.jsonl'), blockedPath);
});

test('AT-S05-02 allowed command captures stdout/stderr/exit code receipts', () => {
  const receiptsDir = path.join(TMP_ROOT, 'receipts', 'at-s05-02');
  ensureDir(receiptsDir);

  const receipt = executeSandboxedCommand({
    command: 'git',
    args: ['--version'],
    cwd: REPO_ROOT,
    repoRoot: REPO_ROOT,
    allowedRoots: defaultAllowedRoots(REPO_ROOT),
    receiptDir: receiptsDir,
  });

  assert.strictEqual(receipt.policy_decision, 'executed');
  assert.strictEqual(receipt.exit_code, 0);
  assert.match(receipt.stdout, /git version/i);
  assert.ok(fs.existsSync(receipt.raw_artifact_paths.receipt));
  assert.ok(fs.existsSync(receipt.raw_artifact_paths.stdout));
  assert.ok(fs.existsSync(receipt.raw_artifact_paths.stderr));

  appendJsonl(path.join(receiptsDir, 'EVD-S05-01_receipts_samples.jsonl'), receipt);
});

test('AT-S05-03 repeated allowed command yields stable normalized hash', () => {
  const receiptsDir = path.join(TMP_ROOT, 'receipts', 'at-s05-03');
  ensureDir(receiptsDir);

  const first = executeSandboxedCommand({
    command: 'git',
    args: ['--version'],
    cwd: REPO_ROOT,
    repoRoot: REPO_ROOT,
    allowedRoots: defaultAllowedRoots(REPO_ROOT),
    receiptDir: receiptsDir,
  });

  const second = executeSandboxedCommand({
    command: 'git',
    args: ['--version'],
    cwd: REPO_ROOT,
    repoRoot: REPO_ROOT,
    allowedRoots: defaultAllowedRoots(REPO_ROOT),
    receiptDir: receiptsDir,
  });

  assert.strictEqual(first.policy_decision, 'executed');
  assert.strictEqual(second.policy_decision, 'executed');
  assert.strictEqual(first.normalized_hash, second.normalized_hash);
  assert.notStrictEqual(first.raw_artifact_paths.receipt, second.raw_artifact_paths.receipt);
  assert.ok(fs.existsSync(first.raw_artifact_paths.receipt));
  assert.ok(fs.existsSync(second.raw_artifact_paths.receipt));

  appendJsonl(path.join(receiptsDir, 'EVD-S05-01_receipts_samples.jsonl'), first);
  appendJsonl(path.join(receiptsDir, 'EVD-S05-01_receipts_samples.jsonl'), second);
});
