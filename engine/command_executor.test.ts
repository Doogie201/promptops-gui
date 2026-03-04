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

function assertBlocked(
  receipt: ReturnType<typeof executeSandboxedCommand>,
  stderrPattern: RegExp,
): ReturnType<typeof executeSandboxedCommand> {
  assert.strictEqual(receipt.policy_decision, 'blocked');
  assert.strictEqual(receipt.exit_code, 126);
  assert.match(receipt.stderr, stderrPattern);
  assert.ok(fs.existsSync(receipt.raw_artifact_paths.receipt));
  return receipt;
}

function runBlockedCase(input: {
  command: string;
  args: string[];
  cwd: string;
  receiptDir: string;
  stderrPattern: RegExp;
}): ReturnType<typeof executeSandboxedCommand> {
  return assertBlocked(
    executeSandboxedCommand({
      command: input.command,
      args: input.args,
      cwd: input.cwd,
      repoRoot: REPO_ROOT,
      allowedRoots: defaultAllowedRoots(REPO_ROOT),
      receiptDir: input.receiptDir,
    }),
    input.stderrPattern,
  );
}

test('AT-S05-01 disallowed command/path is blocked with clear error and recorded event', () => {
  const securityDir = path.join(TMP_ROOT, 'security', 'at-s05-01');
  ensureDir(securityDir);

  const blockedCommand = runBlockedCase({
    command: 'cat',
    args: ['/etc/passwd'],
    cwd: REPO_ROOT,
    receiptDir: securityDir,
    stderrPattern: /not allowlisted/,
  });

  const blockedPath = runBlockedCase({
    command: 'git',
    args: ['status', '--', '/etc/passwd'],
    cwd: REPO_ROOT,
    receiptDir: securityDir,
    stderrPattern: /escapes allowlisted roots|outside allowlisted roots/,
  });

  const blockedOptionPath = runBlockedCase({
    command: 'git',
    args: ['--git-dir=/etc', 'status'],
    cwd: REPO_ROOT,
    receiptDir: securityDir,
    stderrPattern: /escapes allowlisted roots/,
  });

  const symlinkRoot = path.join(TMP_ROOT, 'security', 'at-s05-01-symlink');
  const symlinkPath = path.join(symlinkRoot, 'escape-link');
  ensureDir(symlinkRoot);
  fs.rmSync(symlinkPath, { force: true });
  fs.symlinkSync('/etc', symlinkPath);

  const blockedSymlinkPath = runBlockedCase({
    command: 'git',
    args: ['status', '--', './escape-link'],
    cwd: symlinkRoot,
    receiptDir: securityDir,
    stderrPattern: /escapes allowlisted roots/,
  });

  fs.rmSync(symlinkPath, { force: true });

  const blockedInvalidCwd = runBlockedCase({
    command: 'git',
    args: ['--version'],
    cwd: '/etc',
    receiptDir: securityDir,
    stderrPattern: /outside allowlisted roots/,
  });

  appendJsonl(path.join(securityDir, 'EVD-S05-02_whitelist_violation_proofs.jsonl'), blockedCommand);
  appendJsonl(path.join(securityDir, 'EVD-S05-02_whitelist_violation_proofs.jsonl'), blockedPath);
  appendJsonl(path.join(securityDir, 'EVD-S05-02_whitelist_violation_proofs.jsonl'), blockedOptionPath);
  appendJsonl(path.join(securityDir, 'EVD-S05-02_whitelist_violation_proofs.jsonl'), blockedSymlinkPath);
  appendJsonl(path.join(securityDir, 'EVD-S05-02_whitelist_violation_proofs.jsonl'), blockedInvalidCwd);
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
