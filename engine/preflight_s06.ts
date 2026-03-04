import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { executeSandboxedCommand, type CommandReceipt } from './command_executor.ts';

export type PreflightScope = 'PRIMARY_WORKTREE' | 'LOCAL_WORKTREE';
export type HardStopCode =
  | 'HARD_STOP_PRIMARY_WORKTREE_NOT_ON_MAIN_NOT_SYNCED'
  | 'HARD_STOP_BRANCH_NONCOMPLIANCE'
  | 'HARD_STOP_OBJECT_STORE_RISK'
  | 'OUT_OF_SYNC';

export interface PreflightEvent {
  code: HardStopCode | 'PRUNE_DISABLED';
  scope: PreflightScope;
  message: string;
  details: Record<string, unknown>;
}

export interface RepoFingerprint {
  head_oid: string;
  branch: string;
  status_hash: string;
  status_raw: string;
}

export interface S06PreflightOptions {
  primaryWorktreePath?: string;
  localWorktreePath: string;
  baseBranch?: string;
  branchPrefixRegexGeneric?: string;
  branchPrefixRegexSprint?: string;
  receiptDir?: string;
  allowedRoots?: string[];
  prunePolicy?: 'ON' | 'OFF';
  outOfSyncWarnOnly?: boolean;
  onBeforePostBatchCheck?: () => void;
}

export interface S06PreflightResult {
  status: 'PASS' | 'HARD_STOP';
  hard_stop_code?: HardStopCode;
  events: PreflightEvent[];
  receipts: CommandReceipt[];
  baseline?: RepoFingerprint;
  postcheck?: RepoFingerprint;
  branch_name?: string;
  remediation?: string[];
}

interface CommandSpec {
  id: string;
  scope: PreflightScope;
  cwd: string;
  repoRoot: string;
  command: string;
  args: string[];
}

interface BranchCompliance {
  compliant: boolean;
  remediation: string[];
  message: string;
}

interface ResolvedConfig {
  primaryPath: string;
  localPath: string;
  baseBranch: string;
  genericRegex: RegExp;
  sprintRegex: RegExp;
  roots: string[];
  receiptDir: string;
  prunePolicy: 'ON' | 'OFF';
  outOfSyncWarnOnly: boolean;
}

const BAD_SIGNAL = /(bad sha1|badRefName|badRefContent|invalid ref|fatal:|error:)/i;

export function runS06PreflightAutomation(options: S06PreflightOptions): S06PreflightResult {
  const config = resolveConfig(options);
  const receipts: CommandReceipt[] = [];
  const events: PreflightEvent[] = [];

  const baseline = captureFingerprint(
    config.localPath,
    config.localPath,
    config.roots,
    config.receiptDir,
    'LOCAL_WORKTREE',
    receipts,
  );
  const primaryReceipts = runPrimaryWorktreeCommandSet(
    config.primaryPath,
    config.baseBranch,
    config.roots,
    config.receiptDir,
    receipts,
  );
  const primaryAssessment = assessPrimaryWorktree(primaryReceipts, config.baseBranch);
  if (!primaryAssessment.pass) {
    return hardStop('HARD_STOP_PRIMARY_WORKTREE_NOT_ON_MAIN_NOT_SYNCED', events, receipts, baseline, undefined, {
      primaryAssessment,
    });
  }

  const branchHardStop = branchComplianceHardStop(baseline.branch, config, events, receipts, baseline);
  if (branchHardStop) return branchHardStop;

  runLocalSanity(
    config.localPath,
    config.roots,
    config.receiptDir,
    config.prunePolicy,
    receipts,
    events,
  );
  if (events.some((event) => event.code === 'HARD_STOP_OBJECT_STORE_RISK')) {
    return {
      status: 'HARD_STOP',
      hard_stop_code: 'HARD_STOP_OBJECT_STORE_RISK',
      events,
      receipts,
      baseline,
      branch_name: baseline.branch,
    };
  }
  if (options.onBeforePostBatchCheck) {
    options.onBeforePostBatchCheck();
  }

  const postcheck = captureFingerprint(
    config.localPath,
    config.localPath,
    config.roots,
    config.receiptDir,
    'LOCAL_WORKTREE',
    receipts,
  );
  return outOfSyncResult(config.outOfSyncWarnOnly, baseline, postcheck, events, receipts);
}

export function evaluateBranchCompliance(
  branchName: string,
  genericRegex: RegExp,
  sprintRegex: RegExp,
): BranchCompliance {
  const genericPass = genericRegex.test(branchName);
  const sprintPass = sprintRegex.test(branchName);
  if (genericPass && sprintPass) {
    return {
      compliant: true,
      message: 'Branch is sprint-compliant.',
      remediation: [],
    };
  }

  const remediation = [
    `git branch -m ${branchName} sprint/S06-git-worktree-preflight-automation`,
    'git push -u origin sprint/S06-git-worktree-preflight-automation',
  ];
  return {
    compliant: false,
    message: `Branch '${branchName}' failed sprint branch compliance.`,
    remediation,
  };
}

function runPrimaryWorktreeCommandSet(
  primaryPath: string,
  baseBranch: string,
  roots: string[],
  receiptDir: string,
  receipts: CommandReceipt[],
): CommandReceipt[] {
  const specs: CommandSpec[] = [
    { id: 'pwd', scope: 'PRIMARY_WORKTREE', cwd: primaryPath, repoRoot: primaryPath, command: 'pwd', args: [] },
    {
      id: 'show_toplevel',
      scope: 'PRIMARY_WORKTREE',
      cwd: primaryPath,
      repoRoot: primaryPath,
      command: 'git',
      args: ['rev-parse', '--show-toplevel'],
    },
    {
      id: 'worktree_list',
      scope: 'PRIMARY_WORKTREE',
      cwd: primaryPath,
      repoRoot: primaryPath,
      command: 'git',
      args: ['worktree', 'list', '--porcelain'],
    },
    {
      id: 'status',
      scope: 'PRIMARY_WORKTREE',
      cwd: primaryPath,
      repoRoot: primaryPath,
      command: 'git',
      args: ['status', '--porcelain=v1', '--branch'],
    },
    {
      id: 'fetch',
      scope: 'PRIMARY_WORKTREE',
      cwd: primaryPath,
      repoRoot: primaryPath,
      command: 'git',
      args: ['fetch', '--all', '--prune', '--tags'],
    },
    {
      id: 'ahead_behind',
      scope: 'PRIMARY_WORKTREE',
      cwd: primaryPath,
      repoRoot: primaryPath,
      command: 'git',
      args: ['rev-list', '--left-right', '--count', `HEAD...origin/${baseBranch}`],
    },
    {
      id: 'branch',
      scope: 'PRIMARY_WORKTREE',
      cwd: primaryPath,
      repoRoot: primaryPath,
      command: 'git',
      args: ['rev-parse', '--abbrev-ref', 'HEAD'],
    },
    {
      id: 'recent_log',
      scope: 'PRIMARY_WORKTREE',
      cwd: primaryPath,
      repoRoot: primaryPath,
      command: 'git',
      args: ['log', '--oneline', '-5'],
    },
  ];

  return specs.map((spec) => runCommand(spec, roots, receiptDir, receipts));
}

function resolveConfig(options: S06PreflightOptions): ResolvedConfig {
  const primaryPath = path.resolve(options.primaryWorktreePath ?? defaultPrimaryWorktreePath());
  const localPath = path.resolve(options.localWorktreePath);
  const baseBranch = options.baseBranch ?? 'main';
  const genericRegex = new RegExp(options.branchPrefixRegexGeneric ?? '^sprint/S\\d{2}-');
  const sprintRegex = new RegExp(options.branchPrefixRegexSprint ?? '^sprint/S06-');
  const roots = buildAllowedRoots(options.allowedRoots, primaryPath, localPath);
  const receiptDir = options.receiptDir ?? '/tmp/promptops/S06/receipts';
  return {
    primaryPath,
    localPath,
    baseBranch,
    genericRegex,
    sprintRegex,
    roots,
    receiptDir,
    prunePolicy: options.prunePolicy ?? 'ON',
    outOfSyncWarnOnly: Boolean(options.outOfSyncWarnOnly),
  };
}

function branchComplianceHardStop(
  branchName: string,
  config: ResolvedConfig,
  events: PreflightEvent[],
  receipts: CommandReceipt[],
  baseline: RepoFingerprint,
): S06PreflightResult | null {
  const branchCheck = evaluateBranchCompliance(branchName, config.genericRegex, config.sprintRegex);
  if (branchCheck.compliant) return null;
  events.push({
    code: 'HARD_STOP_BRANCH_NONCOMPLIANCE',
    scope: 'LOCAL_WORKTREE',
    message: branchCheck.message,
    details: { branch: branchName, remediation: branchCheck.remediation },
  });
  return {
    status: 'HARD_STOP',
    hard_stop_code: 'HARD_STOP_BRANCH_NONCOMPLIANCE',
    events,
    receipts,
    baseline,
    branch_name: branchName,
    remediation: branchCheck.remediation,
  };
}

function outOfSyncResult(
  warnOnly: boolean,
  baseline: RepoFingerprint,
  postcheck: RepoFingerprint,
  events: PreflightEvent[],
  receipts: CommandReceipt[],
): S06PreflightResult {
  if (!sameFingerprint(baseline, postcheck)) {
    const event: PreflightEvent = {
      code: 'OUT_OF_SYNC',
      scope: 'LOCAL_WORKTREE',
      message: 'OUT_OF_SYNC: repository state changed during preflight run.',
      details: { before: baseline, after: postcheck },
    };
    events.push(event);
    if (!warnOnly) {
      return {
        status: 'HARD_STOP',
        hard_stop_code: 'OUT_OF_SYNC',
        events,
        receipts,
        baseline,
        postcheck,
        branch_name: baseline.branch,
      };
    }
  }

  return {
    status: 'PASS',
    events,
    receipts,
    baseline,
    postcheck,
    branch_name: baseline.branch,
  };
}

function assessPrimaryWorktree(receipts: CommandReceipt[], baseBranch: string): { pass: boolean; details: unknown } {
  const byCommand = new Map<string, CommandReceipt>();
  for (const receipt of receipts) {
    if (receipt.command === 'pwd') {
      byCommand.set('pwd', receipt);
      continue;
    }
    if (receipt.command !== 'git') continue;
    const key = receipt.args.join(' ');
    byCommand.set(key, receipt);
  }

  const branchReceipt = byCommand.get('rev-parse --abbrev-ref HEAD');
  const statusReceipt = byCommand.get('status --porcelain=v1 --branch');
  const fetchReceipt = byCommand.get('fetch --all --prune --tags');
  const aheadBehindKey = `rev-list --left-right --count HEAD...origin/${baseBranch}`;
  const aheadBehindReceipt = byCommand.get(aheadBehindKey);
  if (!branchReceipt || !statusReceipt || !fetchReceipt || !aheadBehindReceipt) {
    return { pass: false, details: { reason: 'missing required receipt' } };
  }
  if (
    branchReceipt.exit_code !== 0 ||
    statusReceipt.exit_code !== 0 ||
    fetchReceipt.exit_code !== 0 ||
    aheadBehindReceipt.exit_code !== 0
  ) {
    return { pass: false, details: { reason: 'required command failed' } };
  }

  const branch = branchReceipt.stdout.trim();
  const statusLines = lines(statusReceipt.stdout).filter((line) => !line.startsWith('##'));
  const dirty = statusLines.length > 0;
  const [ahead, behind] = parseAheadBehind(aheadBehindReceipt.stdout);
  const pass = branch === baseBranch && !dirty && behind === 0;
  return {
    pass,
    details: { branch, dirty, ahead, behind, status_lines: statusLines },
  };
}

function runLocalSanity(
  localPath: string,
  roots: string[],
  receiptDir: string,
  prunePolicy: 'ON' | 'OFF',
  receipts: CommandReceipt[],
  events: PreflightEvent[],
): void {
  runCommand(
    {
      id: 'local_worktree_list',
      scope: 'LOCAL_WORKTREE',
      cwd: localPath,
      repoRoot: localPath,
      command: 'git',
      args: ['worktree', 'list', '--porcelain'],
    },
    roots,
    receiptDir,
    receipts,
  );

  if (prunePolicy === 'OFF') {
    events.push({
      code: 'PRUNE_DISABLED',
      scope: 'LOCAL_WORKTREE',
      message: 'PRUNE_DISABLED: prune policy disabled by configuration.',
      details: { prunePolicy },
    });
    return;
  }

  const pruneReceipt = runCommand(
    {
      id: 'local_prune',
      scope: 'LOCAL_WORKTREE',
      cwd: localPath,
      repoRoot: localPath,
      command: 'git',
      args: ['prune', '--dry-run'],
    },
    roots,
    receiptDir,
    receipts,
  );

  if (BAD_SIGNAL.test(pruneReceipt.stdout) || BAD_SIGNAL.test(pruneReceipt.stderr)) {
    const fsckReceipt = runCommand(
      {
        id: 'local_fsck',
        scope: 'LOCAL_WORKTREE',
        cwd: localPath,
        repoRoot: localPath,
        command: 'git',
        args: ['fsck', '--full'],
      },
      roots,
      receiptDir,
      receipts,
    );
    if (fsckReceipt.exit_code !== 0 || BAD_SIGNAL.test(fsckReceipt.stdout) || BAD_SIGNAL.test(fsckReceipt.stderr)) {
      events.push({
        code: 'HARD_STOP_OBJECT_STORE_RISK',
        scope: 'LOCAL_WORKTREE',
        message: 'HARD STOP: OBJECT STORE RISK',
        details: { prune: pruneReceipt.raw_artifact_paths.receipt, fsck: fsckReceipt.raw_artifact_paths.receipt },
      });
    }
  }
}

function captureFingerprint(
  cwd: string,
  repoRoot: string,
  roots: string[],
  receiptDir: string,
  scope: PreflightScope,
  receipts: CommandReceipt[],
): RepoFingerprint {
  const headReceipt = runCommand(
    { id: 'fingerprint_head', scope, cwd, repoRoot, command: 'git', args: ['rev-parse', 'HEAD'] },
    roots,
    receiptDir,
    receipts,
  );
  const branchReceipt = runCommand(
    { id: 'fingerprint_branch', scope, cwd, repoRoot, command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] },
    roots,
    receiptDir,
    receipts,
  );
  const statusReceipt = runCommand(
    { id: 'fingerprint_status', scope, cwd, repoRoot, command: 'git', args: ['status', '--porcelain=v1', '--branch'] },
    roots,
    receiptDir,
    receipts,
  );

  const statusRaw = statusReceipt.stdout.trim();
  const digestInput = `${headReceipt.stdout.trim()}\n${branchReceipt.stdout.trim()}\n${statusRaw}`;
  return {
    head_oid: headReceipt.stdout.trim(),
    branch: branchReceipt.stdout.trim(),
    status_hash: crypto.createHash('sha256').update(digestInput).digest('hex'),
    status_raw: statusRaw,
  };
}

function runCommand(
  spec: CommandSpec,
  roots: string[],
  receiptDir: string,
  receipts: CommandReceipt[],
): CommandReceipt {
  const receipt = executeSandboxedCommand({
    command: spec.command,
    args: spec.args,
    cwd: spec.cwd,
    repoRoot: spec.repoRoot,
    allowedRoots: roots,
    receiptDir,
  });
  receipts.push(receipt);
  return receipt;
}

function hardStop(
  code: HardStopCode,
  events: PreflightEvent[],
  receipts: CommandReceipt[],
  baseline: RepoFingerprint | undefined,
  postcheck: RepoFingerprint | undefined,
  details: Record<string, unknown>,
): S06PreflightResult {
  events.push({
    code,
    scope: 'PRIMARY_WORKTREE',
    message: code,
    details,
  });
  return { status: 'HARD_STOP', hard_stop_code: code, events, receipts, baseline, postcheck };
}

function buildAllowedRoots(explicitRoots: string[] | undefined, primaryPath: string, localPath: string): string[] {
  const roots = explicitRoots ?? [primaryPath, localPath, '/tmp/promptops/S06'];
  const deduped = new Set<string>();
  for (const entry of roots) {
    deduped.add(path.resolve(entry));
  }
  return [...deduped];
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseAheadBehind(text: string): [number, number] {
  const match = text.trim().match(/^(\d+)\s+(\d+)$/);
  if (!match) return [0, Number.POSITIVE_INFINITY];
  return [Number(match[1]), Number(match[2])];
}

function sameFingerprint(before: RepoFingerprint, after: RepoFingerprint): boolean {
  return before.head_oid === after.head_oid && before.branch === after.branch && before.status_hash === after.status_hash;
}

function defaultPrimaryWorktreePath(): string {
  const home = process.env.HOME ?? '';
  return path.join(home, 'Projects', 'promptops-gui');
}
