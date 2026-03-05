import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  copyBundleToDurable,
  createToolRunContext,
  executeCommandSet,
  writeJson,
  writeText,
} from '../s10/operator_exec.ts';
import { operatorExecutorAllowedSpecs, runOutOfSyncTool } from '../s10/operator_tools.ts';
import type {
  CommandRecord,
  CommandRunner,
  CommandSpec,
  HardStopCode,
  ToolOptions,
  ToolResult,
  ToolRunContext,
} from '../s10/operator_types.ts';

const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_./:@=,+-]+$/;
const SHELL_ESCAPE_PATTERN = /[;&|><`$(){}\\]/;
const DANGEROUS_COMMANDS = new Set([
  'rm',
  'chmod',
  'chown',
  'curl',
  'wget',
  'ssh',
  'scp',
  'nc',
  'ncat',
  'kill',
  'pkill',
  'python',
  'python3',
  'node',
  'ruby',
  'perl',
]);

export type TerminalTemplateId = 'git_status' | 'git_sync_probe' | 'gh_pr_checks' | 'npm_test_all' | 'bash_gates';

export interface TerminalCommandTemplate {
  id: TerminalTemplateId;
  label: string;
  description: string;
  commandLine: string;
}

export interface TerminalPanelState {
  enabled: boolean;
  indicator: 'ENABLED' | 'DISABLED';
}

export interface TerminalRunRequest {
  commandLine?: string;
  templateId?: TerminalTemplateId;
  expectedHead?: string;
  expectedEvidencePaths?: string[];
}

export interface TerminalSecurityEvent {
  seq: number;
  type: 'terminal_command_executed' | 'terminal_command_blocked' | 'terminal_sync_blocked';
  command: string;
  reason: string;
  reasonCode: HardStopCode;
}

export interface TerminalRunResponse {
  context: ToolRunContext;
  records: CommandRecord[];
  events: TerminalSecurityEvent[];
  result: ToolResult;
  durablePath: string;
  syncGateResult?: ToolResult;
}

const TEMPLATES: readonly TerminalCommandTemplate[] = [
  {
    id: 'git_status',
    label: 'Git Status',
    description: 'Repository status in porcelain branch format.',
    commandLine: 'git status --porcelain=v1 --branch',
  },
  {
    id: 'git_sync_probe',
    label: 'Sync Probe',
    description: 'Ahead/behind probe against origin/main.',
    commandLine: 'git rev-list --left-right --count HEAD...origin/main',
  },
  {
    id: 'gh_pr_checks',
    label: 'PR Checks',
    description: 'List open PRs with stable JSON fields.',
    commandLine: 'gh pr list --repo Doogie201/promptops-gui --state open --json number,title,headRefName,baseRefName,url,updatedAt',
  },
  {
    id: 'npm_test_all',
    label: 'Verify',
    description: 'Run repository verify script.',
    commandLine: 'npm run -s verify',
  },
  {
    id: 'bash_gates',
    label: 'Run Gates',
    description: 'Run project gates script.',
    commandLine: 'bash gates.sh',
  },
] as const;

export function createTerminalPanelState(enabled = false): TerminalPanelState {
  return {
    enabled,
    indicator: enabled ? 'ENABLED' : 'DISABLED',
  };
}

export function setTerminalPanelEnabled(state: TerminalPanelState, enabled: boolean): TerminalPanelState {
  return {
    ...state,
    enabled,
    indicator: enabled ? 'ENABLED' : 'DISABLED',
  };
}

export function terminalCommandTemplates(): readonly TerminalCommandTemplate[] {
  return TEMPLATES;
}

export function renderTemplateCommand(templateId: TerminalTemplateId): string {
  const template = TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new Error(`Unknown template: ${templateId}`);
  return template.commandLine;
}

export function runTerminalPanelCommand(
  options: ToolOptions,
  state: TerminalPanelState,
  request: TerminalRunRequest,
  runner?: CommandRunner,
): TerminalRunResponse {
  const context = createToolRunContext('terminal', options);
  const commandLine = resolveCommandLine(request);
  const events: TerminalSecurityEvent[] = [];

  if (!state.enabled) {
    return finalizeBlocked(
      context,
      commandLine,
      'Terminal panel is disabled. Enable toggle before running commands.',
      'PR_NOT_READY',
      events,
    );
  }

  const parsed = parseCommand(commandLine);
  const allowedSignatures = buildAllowedSignatures();
  const blockReason = validateCommand(parsed, allowedSignatures);
  if (blockReason) {
    return finalizeBlocked(context, commandLine, blockReason, 'WHITELIST_VIOLATION', events);
  }

  const syncGate = runSyncGate(options, request, runner);
  if (syncGate.result.status !== 'PASS') {
    return finalizeBlocked(context, commandLine, syncGate.result.message, 'OUT_OF_SYNC', events, syncGate.result, {
      sync_gate_durable: syncGate.durablePath,
    });
  }

  const spec: CommandSpec = { id: 'terminal_command', command: parsed.command, args: parsed.args };
  const records = executeCommandSet(context, [spec], 'terminal_outputs.ndjson', runner);
  return finalizeExecuted(context, commandLine, records, events, syncGate.result.status, syncGate.durablePath, syncGate.result);
}

function runSyncGate(options: ToolOptions, request: TerminalRunRequest, runner?: CommandRunner) {
  return runOutOfSyncTool(
    {
      ...options,
      runId: `${options.runId}_sync_gate`,
    },
    {
      expectedHead: request.expectedHead,
      expectedEvidencePaths: request.expectedEvidencePaths ?? [],
    },
    runner,
  );
}

function resolveCommandLine(request: TerminalRunRequest): string {
  if (request.commandLine && request.commandLine.trim().length > 0) {
    return normalizeCommandLine(request.commandLine);
  }
  if (!request.templateId) throw new Error('Terminal request requires commandLine or templateId.');
  return renderTemplateCommand(request.templateId);
}

function normalizeCommandLine(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function parseCommand(commandLine: string): { command: string; args: string[] } {
  const tokens = commandLine.split(' ').filter((token) => token.length > 0);
  return {
    command: tokens[0] ?? '',
    args: tokens.slice(1),
  };
}

function validateCommand(
  parsed: { command: string; args: string[] },
  allowedSignatures: Record<string, Set<string>>,
): string | null {
  if (!parsed.command) return 'Command is empty after normalization.';
  if (SHELL_ESCAPE_PATTERN.test(parsed.command) || parsed.args.some((token) => SHELL_ESCAPE_PATTERN.test(token))) {
    return 'Shell escape characters are not allowed.';
  }
  if (DANGEROUS_COMMANDS.has(parsed.command) && !(parsed.command in allowedSignatures)) {
    return `Disallowed command class: ${parsed.command}`;
  }
  if (!(parsed.command in allowedSignatures)) {
    return `Command '${parsed.command}' is not in the shared executor allowlist.`;
  }

  for (const token of parsed.args) {
    if (!SAFE_TOKEN_PATTERN.test(token)) {
      return `Unsafe token '${token}' is blocked.`;
    }
  }

  if (parsed.command === 'pwd' && parsed.args.length > 0) {
    return 'pwd template accepts no arguments.';
  }
  if (parsed.command === 'bash') {
    if (parsed.args.length !== 1 || parsed.args[0] !== 'gates.sh') {
      return 'bash is restricted to the existing gates.sh invocation.';
    }
    return null;
  }

  const signature = normalizeSignature(parsed.args);
  if (!allowedSignatures[parsed.command]?.has(signature)) {
    return `Arguments for '${parsed.command}' are outside shared GUI policy.`;
  }

  return null;
}

function buildAllowedSignatures(): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  for (const spec of operatorExecutorAllowedSpecs()) {
    if (!(spec.command in map)) {
      map[spec.command] = new Set<string>();
    }
    map[spec.command].add(normalizeSignature(spec.args));
  }
  return map;
}

function normalizeSignature(args: string[]): string {
  return args.join('\u0001');
}

function finalizeBlocked(
  context: ToolRunContext,
  commandLine: string,
  reason: string,
  reasonCode: HardStopCode,
  events: TerminalSecurityEvent[],
  syncGateResult?: ToolResult,
  extraPaths: Record<string, string> = {},
): TerminalRunResponse {
  const now = new Date().toISOString();
  const stdoutPath = path.join(context.bundleRoot, 'terminal_command.stdout.txt');
  const stderrPath = path.join(context.bundleRoot, 'terminal_command.stderr.txt');
  fs.writeFileSync(stdoutPath, '', 'utf8');
  fs.writeFileSync(stderrPath, `${reason}\n`, 'utf8');

  const parsed = parseCommand(commandLine);
  writeJson(path.join(context.bundleRoot, 'terminal_commands.json'), [
    { id: 'terminal_command', command: parsed.command || commandLine, args: parsed.args },
  ]);

  const record: CommandRecord = {
    id: 'terminal_command',
    cmd: commandLine,
    cwd: context.repoRoot,
    stdout: '',
    stderr: reason,
    exit_code: 126,
    start_ts: now,
    end_ts: now,
    stdout_path: stdoutPath,
    stderr_path: stderrPath,
  };
  writeText(path.join(context.bundleRoot, 'terminal_outputs.ndjson'), `${JSON.stringify(record)}\n`);

  const blockedEvent: TerminalSecurityEvent = {
    seq: events.length + 1,
    type: reasonCode === 'OUT_OF_SYNC' ? 'terminal_sync_blocked' : 'terminal_command_blocked',
    command: commandLine,
    reason,
    reasonCode,
  };
  events.push(blockedEvent);
  const eventPath = writeEvents(context, events);

  const evalPath = path.join(context.bundleRoot, 'terminal_eval.md');
  writeText(evalPath, formatTerminalEval(false, reasonCode, reason));

  const result = buildResult(
    'terminal',
    reasonCode,
    'HARD_STOP',
    reason,
    {
      terminal_commands: path.join(context.bundleRoot, 'terminal_commands.json'),
      terminal_outputs: path.join(context.bundleRoot, 'terminal_outputs.ndjson'),
      terminal_events: eventPath,
      terminal_eval: evalPath,
      ...extraPaths,
    },
    {
      command: commandLine,
      blocked: true,
      continuity_hash: context.continuityHash,
      sync_gate_status: syncGateResult?.status ?? 'SKIPPED',
    },
  );

  const durablePath = copyBundleToDurable(context);
  return {
    context,
    records: [record],
    events,
    result,
    durablePath,
    syncGateResult,
  };
}

function writeEvents(context: ToolRunContext, events: TerminalSecurityEvent[]): string {
  const eventPath = path.join(context.bundleRoot, 'terminal_events.ndjson');
  const ndjson = events.map((event) => JSON.stringify(event)).join('\n');
  writeText(eventPath, ndjson);
  writeJson(path.join(context.bundleRoot, 'terminal_events.json'), events);
  return eventPath;
}

function formatTerminalEval(pass: boolean, reasonCode: HardStopCode, message: string): string {
  return ['# Terminal Evaluation', '', `- pass: ${pass}`, `- reasonCode: ${reasonCode}`, `- message: ${message}`, ''].join('\n');
}

function finalizeExecuted(
  context: ToolRunContext,
  commandLine: string,
  records: CommandRecord[],
  events: TerminalSecurityEvent[],
  syncGateStatus: ToolResult['status'],
  syncGateDurable: string,
  syncGateResult: ToolResult,
): TerminalRunResponse {
  events.push({
    seq: 1,
    type: 'terminal_command_executed',
    command: commandLine,
    reason: records[0]?.exit_code === 0 ? 'Command executed.' : 'Command exited non-zero.',
    reasonCode: records[0]?.exit_code === 0 ? 'NONE' : 'PR_NOT_READY',
  });
  const eventPath = writeEvents(context, events);
  const pass = records.every((record) => record.exit_code === 0);
  const reasonCode: HardStopCode = pass ? 'NONE' : 'PR_NOT_READY';
  const evalPath = path.join(context.bundleRoot, 'terminal_eval.md');
  writeText(evalPath, formatTerminalEval(pass, reasonCode, events[0].reason));
  const result = buildResult(
    'terminal',
    reasonCode,
    pass ? 'PASS' : 'FAIL',
    pass ? 'Terminal command executed through shared executor.' : 'Terminal command failed.',
    {
      terminal_commands: path.join(context.bundleRoot, 'terminal_commands.json'),
      terminal_outputs: path.join(context.bundleRoot, 'terminal_outputs.ndjson'),
      terminal_events: eventPath,
      terminal_eval: evalPath,
      sync_gate_durable: syncGateDurable,
    },
    { command: commandLine, blocked: false, continuity_hash: context.continuityHash, sync_gate_status: syncGateStatus },
  );
  return { context, records, events, result, durablePath: copyBundleToDurable(context), syncGateResult };
}

function buildResult(
  tool: string,
  reasonCode: HardStopCode,
  status: ToolResult['status'],
  message: string,
  receiptPaths: Record<string, string>,
  summary: Record<string, unknown>,
): ToolResult {
  return {
    tool,
    reasonCode,
    status,
    message,
    receiptPaths,
    summary,
  };
}
