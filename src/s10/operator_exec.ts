import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { CommandRecord, CommandRunner, CommandSpec, ToolOptions, ToolRunContext } from './operator_types.ts';

const SAFE_ENV_KEYS = ['CI', 'HOME', 'LANG', 'LC_ALL', 'NO_COLOR', 'PATH', 'TERM', 'GIT_TERMINAL_PROMPT', 'PROMPTOPS_REPO'];

export function createToolRunContext(tool: string, options: ToolOptions): ToolRunContext {
  const timestamp = options.timestamp ?? isoNowCompact();
  const continuityHash = sha256(stableJson({ sprint: options.sprintId, tool, run: options.runId, timestamp }));
  const bundleName = `${sanitize(options.sprintId)}_${sanitize(tool)}_${sanitize(options.runId)}_${timestamp}`;
  const stagingRoot = path.join(options.stagingBase, tool, options.runId);
  const durableRoot = path.join(options.durableBase, tool, options.runId);
  const bundleRoot = path.join(stagingRoot, bundleName);
  fs.mkdirSync(bundleRoot, { recursive: true });
  const context: ToolRunContext = {
    sprintId: options.sprintId,
    tool,
    runId: options.runId,
    timestamp,
    repoRoot: path.resolve(options.repoRoot),
    stagingRoot,
    durableRoot,
    bundleRoot,
    continuityHash,
  };
  writeJson(path.join(bundleRoot, 'run_context.json'), context);
  return context;
}

export function executeCommandSet(
  context: ToolRunContext,
  specs: CommandSpec[],
  outFileName: string,
  runner?: CommandRunner,
): CommandRecord[] {
  const ndjsonPath = path.join(context.bundleRoot, outFileName);
  const commandListPath = outFileName.endsWith('.ndjson')
    ? ndjsonPath.replace('_outputs.ndjson', '_commands.json')
    : path.join(context.bundleRoot, 'commands.json');
  writeJson(commandListPath, specs);

  const env = buildEnv(context.repoRoot);
  const records: CommandRecord[] = [];
  for (const spec of specs) {
    const stdoutPath = path.join(context.bundleRoot, `${spec.id}.stdout.txt`);
    const stderrPath = path.join(context.bundleRoot, `${spec.id}.stderr.txt`);
    const base = runner
      ? runner(spec, context.repoRoot, env, stdoutPath, stderrPath)
      : runWithSpawn(spec, context.repoRoot, env, stdoutPath, stderrPath);
    const record: CommandRecord = {
      id: spec.id,
      cmd: [spec.command, ...spec.args].join(' '),
      cwd: context.repoRoot,
      stdout_path: stdoutPath,
      stderr_path: stderrPath,
      ...base,
    };
    records.push(record);
    fs.appendFileSync(ndjsonPath, `${JSON.stringify(record)}\n`, 'utf8');
  }
  return records;
}

export function copyBundleToDurable(context: ToolRunContext): string {
  fs.mkdirSync(context.durableRoot, { recursive: true });
  const destination = path.join(context.durableRoot, path.basename(context.bundleRoot));
  fs.cpSync(context.bundleRoot, destination, { recursive: true });
  return destination;
}

export function stableJson(value: unknown): string {
  return stringifyCanonical(value);
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function writeJson(filePath: string, payload: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function writeText(filePath: string, text: string): void {
  fs.writeFileSync(filePath, text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

function runWithSpawn(
  spec: CommandSpec,
  cwd: string,
  env: Record<string, string>,
  outStdPath: string,
  outErrPath: string,
): Omit<CommandRecord, 'id' | 'cmd' | 'cwd' | 'stdout_path' | 'stderr_path'> {
  const start = new Date().toISOString();
  const proc = spawnSync(spec.command, spec.args, {
    cwd,
    env,
    encoding: 'utf8',
    shell: false,
  });
  const stdout = proc.stdout ?? '';
  const stderr = `${proc.stderr ?? ''}${proc.error ? `\nspawn_error: ${proc.error.message}` : ''}`;
  fs.writeFileSync(outStdPath, stdout, 'utf8');
  fs.writeFileSync(outErrPath, stderr, 'utf8');
  return {
    stdout,
    stderr,
    exit_code: proc.status ?? 1,
    start_ts: start,
    end_ts: new Date().toISOString(),
  };
}

function buildEnv(repoRoot: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const key of SAFE_ENV_KEYS) {
    const value = key === 'PROMPTOPS_REPO' ? repoRoot : process.env[key];
    if (typeof value === 'string' && value.length > 0) {
      env[key] = value;
    }
  }
  return env;
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}

function isoNowCompact(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function stringifyCanonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyCanonical(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stringifyCanonical(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
