import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface CommandRequest {
  command: string;
  args: string[];
  cwd: string;
  repoRoot: string;
  allowedRoots?: string[];
  receiptDir?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface CommandReceipt {
  command: string;
  args: string[];
  cwd: string;
  env_allowlist: string[];
  start_ts: string;
  end_ts: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  timeout: boolean;
  policy_decision: 'executed' | 'blocked';
  normalized_hash: string;
  raw_artifact_paths: {
    receipt: string;
    stdout: string;
    stderr: string;
  };
}

interface CommandPolicy {
  argPattern: RegExp;
  timeoutMs: number;
  requireRepoCwd: boolean;
}

interface ValidationResult {
  error: string | null;
  cwd: string;
  repoRoot: string;
}

const COMMAND_ALLOWLIST: Record<string, CommandPolicy> = {
  git: {
    argPattern: /^[A-Za-z0-9_./:@=,+-]+$/,
    timeoutMs: 15_000,
    requireRepoCwd: false,
  },
  gh: {
    argPattern: /^[A-Za-z0-9_./:@=,+-]+$/,
    timeoutMs: 20_000,
    requireRepoCwd: false,
  },
  npm: {
    argPattern: /^[A-Za-z0-9_./:@=,+-]+$/,
    timeoutMs: 45_000,
    requireRepoCwd: true,
  },
  node: {
    argPattern: /^[A-Za-z0-9_./:@=,+-]+$/,
    timeoutMs: 45_000,
    requireRepoCwd: true,
  },
  bash: {
    argPattern: /^[A-Za-z0-9_./:@=,+-]+$/,
    timeoutMs: 45_000,
    requireRepoCwd: true,
  },
  pwd: {
    argPattern: /^[A-Za-z0-9_./:@=,+-]+$/,
    timeoutMs: 5_000,
    requireRepoCwd: false,
  },
};

const SAFE_ENV_NAMES = new Set([
  'CI',
  'HOME',
  'LANG',
  'LC_ALL',
  'NO_COLOR',
  'PATH',
  'TERM',
  'GIT_TERMINAL_PROMPT',
]);

const SENSITIVE_ENV_NAME = /(TOKEN|SECRET|PASSWORD|PASS|KEY|AUTH)/i;

const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g, replacement: '<REDACTED:GH_TOKEN>' },
  { pattern: /github_pat_[A-Za-z0-9_]{20,}/g, replacement: '<REDACTED:GITHUB_PAT>' },
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: '<REDACTED:AWS_ACCESS_KEY>' },
  { pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g, replacement: '<REDACTED:GCP_API_KEY>' },
  { pattern: /\bBearer\s+[A-Za-z0-9._-]+/gi, replacement: 'Bearer <REDACTED:BEARER_TOKEN>' },
];

const OPTION_PATH_PREFIXES = ['--git-dir=', '--work-tree=', '--file=', '--output=', '--cwd='];
const OPTION_NEXT_PATH_TOKENS = new Set(['-C', '--git-dir', '--work-tree', '--file', '--output', '--cwd']);

export function defaultAllowedRoots(repoRoot: string): string[] {
  return [repoRoot, path.join(repoRoot, 'docs', 'sprints', 'S05', 'evidence'), '/tmp/promptops/S05'];
}

export function executeSandboxedCommand(req: CommandRequest): CommandReceipt {
  const roots = req.allowedRoots ?? defaultAllowedRoots(req.repoRoot);
  const receiptDir = resolveReceiptDir(req.receiptDir, roots);
  fs.mkdirSync(receiptDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const validation = validateRequest(req, roots);
  if (validation.error) {
    return writeReceipt({
      req,
      receiptDir,
      startedAt,
      completedAt: new Date().toISOString(),
      stdout: '',
      stderr: validation.error,
      exitCode: 126,
      timeout: false,
      policyDecision: 'blocked',
      roots,
    });
  }

  const env = buildEnv(req.env);
  const policy = COMMAND_ALLOWLIST[req.command];
  const result = runCommand(req.command, req.args, validation.cwd, env, req.timeoutMs ?? policy.timeoutMs);
  const completedAt = new Date().toISOString();

  return writeReceipt({
    req,
    receiptDir,
    startedAt,
    completedAt,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    timeout: result.timeout,
    policyDecision: 'executed',
    roots,
  });
}

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
): { stdout: string; stderr: string; exitCode: number; timeout: boolean } {
  const proc: SpawnSyncReturns<string> = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: timeoutMs,
    shell: false,
  });

  const timedOut = Boolean(proc.error && (proc.error as NodeJS.ErrnoException).code === 'ETIMEDOUT');
  const stderrSuffix = proc.error && !timedOut ? `\nspawn error: ${proc.error.message}` : '';

  return {
    stdout: proc.stdout ?? '',
    stderr: `${proc.stderr ?? ''}${stderrSuffix}`,
    exitCode: proc.status ?? (timedOut ? 124 : 1),
    timeout: timedOut,
  };
}

function buildEnv(overrideEnv: Record<string, string> | undefined): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SAFE_ENV_NAMES) {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0) {
      env[key] = value;
    }
  }

  if (!overrideEnv) {
    return env;
  }

  for (const [key, value] of Object.entries(overrideEnv)) {
    if (SAFE_ENV_NAMES.has(key)) {
      env[key] = value;
    }
  }

  return env;
}

function validateRequest(req: CommandRequest, roots: string[]): ValidationResult {
  let cwd: string;
  let repoRoot: string;
  try {
    cwd = resolvePathWithinRoots(req.cwd, roots);
    repoRoot = resolvePathWithinRoots(req.repoRoot, roots);
  } catch (error) {
    return {
      error: `policy denied: ${(error as Error).message}`,
      cwd: req.cwd,
      repoRoot: req.repoRoot,
    };
  }

  if (!Object.hasOwn(COMMAND_ALLOWLIST, req.command)) {
    return { error: `policy denied: command '${req.command}' is not allowlisted`, cwd, repoRoot };
  }

  const policy = COMMAND_ALLOWLIST[req.command];

  if (policy.requireRepoCwd && !isWithinRoot(cwd, repoRoot)) {
    return { error: `policy denied: command '${req.command}' requires cwd under repo root`, cwd, repoRoot };
  }

  for (let i = 0; i < req.args.length; i++) {
    const arg = req.args[i];
    if (!policy.argPattern.test(arg)) {
      return { error: `policy denied: argument '${arg}' violates allowlist token pattern`, cwd, repoRoot };
    }

    const hasPathTraversalPattern =
      arg === '..' || arg.startsWith('../') || arg.includes('/../') || arg.endsWith('/..');
    if (hasPathTraversalPattern || arg.startsWith('~')) {
      return { error: `policy denied: unsafe path token '${arg}'`, cwd, repoRoot };
    }

    if (OPTION_NEXT_PATH_TOKENS.has(arg)) {
      const nextArg = req.args[i + 1];
      if (!nextArg) {
        return { error: `policy denied: option '${arg}' requires a path value`, cwd, repoRoot };
      }
      if (!isPathTokenAllowed(nextArg, cwd, roots)) {
        return { error: `policy denied: path '${nextArg}' escapes allowlisted roots`, cwd, repoRoot };
      }
      i += 1;
      continue;
    }

    const maybePath = parsePathToken(arg, cwd);
    if (maybePath && !isPathWithinRoots(maybePath, roots)) {
      return { error: `policy denied: path '${arg}' escapes allowlisted roots`, cwd, repoRoot };
    }
  }

  return { error: null, cwd, repoRoot };
}

function parsePathToken(token: string, cwd: string): string | null {
  const attachedPath = optionAttachedPath(token);
  if (attachedPath) {
    return absoluteFromToken(attachedPath, cwd);
  }

  if (token.startsWith('/')) {
    return token;
  }

  if (token.startsWith('./') || token.startsWith('../')) {
    return path.resolve(cwd, token);
  }

  const pathPrefixes = ['docs/', 'engine/', 'policy/', 'scripts/', 'ui/', 'fixtures/', 'artifacts/'];
  if (pathPrefixes.some((prefix) => token.startsWith(prefix))) {
    return path.resolve(cwd, token);
  }

  return null;
}

function optionAttachedPath(token: string): string | null {
  for (const prefix of OPTION_PATH_PREFIXES) {
    if (token.startsWith(prefix)) {
      const value = token.slice(prefix.length);
      return value.length > 0 ? value : null;
    }
  }
  return null;
}

function isPathTokenAllowed(token: string, cwd: string, roots: string[]): boolean {
  return isPathWithinRoots(absoluteFromToken(token, cwd), roots);
}

function absoluteFromToken(token: string, cwd: string): string {
  return token.startsWith('/') ? token : path.resolve(cwd, token);
}

function resolveReceiptDir(receiptDir: string | undefined, roots: string[]): string {
  const candidate = receiptDir ?? '/tmp/promptops/S05/receipts';
  try {
    return resolvePathWithinRoots(candidate, roots);
  } catch {
    return '/tmp/promptops/S05/security';
  }
}

function resolvePathWithinRoots(inputPath: string, roots: string[]): string {
  const resolved = fs.existsSync(inputPath) ? fs.realpathSync(inputPath) : path.resolve(inputPath);
  if (!isPathWithinRoots(resolved, roots)) {
    throw new Error(`policy denied: path '${inputPath}' is outside allowlisted roots`);
  }
  return resolved;
}

function isPathWithinRoots(candidatePath: string, roots: string[]): boolean {
  const resolvedCandidate = resolvePathForContainment(candidatePath);
  return roots.some((root) => {
    const resolvedRoot = resolvePathForContainment(root);
    return isWithinRoot(resolvedCandidate, resolvedRoot);
  });
}

function isWithinRoot(candidatePath: string, rootPath: string): boolean {
  const rel = path.relative(rootPath, candidatePath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolvePathForContainment(inputPath: string): string {
  return fs.existsSync(inputPath) ? fs.realpathSync(inputPath) : path.resolve(inputPath);
}

function writeReceipt(input: {
  req: CommandRequest;
  receiptDir: string;
  startedAt: string;
  completedAt: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timeout: boolean;
  policyDecision: 'executed' | 'blocked';
  roots: string[];
}): CommandReceipt {
  const env = buildEnv(input.req.env);
  const sensitiveValues = Object.entries(env)
    .filter(([key, value]) => SENSITIVE_ENV_NAME.test(key) && value.length >= 4)
    .map(([, value]) => value);

  const redactedStdout = redact(input.stdout, sensitiveValues);
  const redactedStderr = redact(input.stderr, sensitiveValues);

  const normalizedView = {
    command: input.req.command,
    args: input.req.args.map((arg) => normalizeArg(arg, input.req.repoRoot)),
    cwd: normalizeArg(input.req.cwd, input.req.repoRoot),
    stdout: normalizeText(redactedStdout, input.req.repoRoot),
    stderr: normalizeText(redactedStderr, input.req.repoRoot),
    exit_code: input.exitCode,
    timeout: input.timeout,
    policy_decision: input.policyDecision,
  };

  const normalizedHash = crypto.createHash('sha256').update(canonicalSerialize(normalizedView)).digest('hex');
  const stem = `${Date.now()}-${process.pid}-${normalizedHash.slice(0, 12)}`;
  const stdoutPath = path.join(input.receiptDir, `${stem}.stdout.txt`);
  const stderrPath = path.join(input.receiptDir, `${stem}.stderr.txt`);
  const receiptPath = path.join(input.receiptDir, `${stem}.receipt.json`);

  fs.writeFileSync(stdoutPath, redactedStdout);
  fs.writeFileSync(stderrPath, redactedStderr);

  const receipt: CommandReceipt = {
    command: input.req.command,
    args: input.req.args,
    cwd: input.req.cwd,
    env_allowlist: Object.keys(env).sort(),
    start_ts: input.startedAt,
    end_ts: input.completedAt,
    stdout: redactedStdout,
    stderr: redactedStderr,
    exit_code: input.exitCode,
    timeout: input.timeout,
    policy_decision: input.policyDecision,
    normalized_hash: normalizedHash,
    raw_artifact_paths: {
      receipt: receiptPath,
      stdout: stdoutPath,
      stderr: stderrPath,
    },
  };

  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

function redact(input: string, sensitiveValues: string[]): string {
  let output = input;
  for (const entry of REDACTION_PATTERNS) {
    output = output.replace(entry.pattern, entry.replacement);
  }

  for (const value of sensitiveValues.sort()) {
    output = output.split(value).join('<REDACTED:ENV_VALUE>');
  }

  return output;
}

function normalizeArg(value: string, repoRoot: string): string {
  let normalized = value;
  if (value.startsWith(repoRoot)) {
    normalized = `<REPO_ROOT>${value.slice(repoRoot.length)}`;
  }
  if (normalized.startsWith('/tmp/promptops/S05')) {
    normalized = `<TMP_S05>${normalized.slice('/tmp/promptops/S05'.length)}`;
  }
  return normalized;
}

function normalizeText(input: string, repoRoot: string): string {
  let output = input.replace(/\r\n/g, '\n');
  output = output.split(repoRoot).join('<REPO_ROOT>');
  output = output.replace(/\/tmp\/promptops\/S05\/[A-Za-z0-9_./-]*/g, '<TMP_S05_PATH>');
  output = output.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g, '<ISO_TS>');
  output = output.replace(/\b\d{10,13}\b/g, '<EPOCH_TS>');
  output = output.replace(/\bpid[=: ]\d+\b/gi, 'pid=<PID>');
  return output;
}

function canonicalSerialize(obj: unknown): string {
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalSerialize).join(',')}]`;
  }

  if (obj !== null && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalSerialize(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(obj);
}
