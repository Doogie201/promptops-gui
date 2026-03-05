import * as fs from 'node:fs';
import * as path from 'node:path';
import { runGatesTool, runOutOfSyncTool, runPreflightTool, runPrProtocolTool } from '../s10/operator_tools.ts';
import { sha256, stableJson } from '../s10/operator_exec.ts';
import type { CommandRecord, CommandRunner, ToolOptions } from '../s10/operator_types.ts';
import type {
  ActionRequestEnvelope,
  ActionResponseEnvelope,
  DashboardActionId,
  GatesData,
  OperatorApiFacade,
  PreflightData,
  PrInventoryData,
  ReceiptSummary,
  RepoRootStrategy,
  RunStatusData,
} from './contracts.ts';

const SPRINT_ID = 'S17-gui-entrypoint-dashboard';

export interface NodeOperatorApiConfig {
  repo?: string;
  sprintId?: string;
  repoRoot?: string;
  stagingBase?: string;
  durableBase?: string;
  previousSprintPrefix?: string;
}

interface ActionContext {
  action: DashboardActionId;
  requestId: string;
  args: Record<string, string>;
}

interface ResolvedRepoRoot {
  repoRoot: string;
  strategy: RepoRootStrategy;
}

export function createNodeOperatorApi(config: NodeOperatorApiConfig = {}, runner?: CommandRunner): OperatorApiFacade {
  return {
    runPreflight: (args = {}) =>
      runPreflightAction({ action: 'preflight', requestId: requestId('preflight', args), args }, config, runner),
    runGates: (args = {}) => runGatesAction({ action: 'gates', requestId: requestId('gates', args), args }, config, runner),
    listOpenPrs: (args = {}) =>
      runPrInventoryAction({ action: 'pr_inventory', requestId: requestId('pr_inventory', args), args }, config, runner),
    getRunStatus: (args = {}) =>
      runStatusAction({ action: 'run_status', requestId: requestId('run_status', args), args }, config, runner),
  };
}

async function runPreflightAction(
  ctx: ActionContext,
  config: NodeOperatorApiConfig,
  runner?: CommandRunner,
): Promise<ActionResponseEnvelope<PreflightData>> {
  const resolved = resolveRepoRoot(ctx, config);
  if (!resolved) {
    return missingRepoRootEnvelope(ctx, {
      branch: 'unknown',
      dirty: true,
      ahead: 0,
      behind: 0,
    });
  }

  const options = toolOptions(ctx, config, resolved.repoRoot);
  const output = runPreflightTool(options, runner);
  const data: PreflightData = {
    branch: String(output.result.summary.branch ?? ''),
    dirty: Boolean(output.result.summary.dirty),
    ahead: Number(output.result.summary.ahead ?? 0),
    behind: Number(output.result.summary.behind ?? 0),
  };

  return toEnvelope(
    ctx,
    resolved.strategy,
    output.records,
    output.result.status,
    output.result.reasonCode,
    output.result.message,
    data,
    output.result.receiptPaths,
    output.durablePath,
  );
}

async function runGatesAction(
  ctx: ActionContext,
  config: NodeOperatorApiConfig,
  runner?: CommandRunner,
): Promise<ActionResponseEnvelope<GatesData>> {
  const resolved = resolveRepoRoot(ctx, config);
  if (!resolved) return missingRepoRootEnvelope(ctx, { failedCount: 1 });

  const options = toolOptions(ctx, config, resolved.repoRoot);
  const output = runGatesTool(options, runner);
  const data: GatesData = { failedCount: Number(output.result.summary.failed_count ?? 0) };

  return toEnvelope(
    ctx,
    resolved.strategy,
    output.records,
    output.result.status,
    output.result.reasonCode,
    output.result.message,
    data,
    output.result.receiptPaths,
    output.durablePath,
  );
}

async function runPrInventoryAction(
  ctx: ActionContext,
  config: NodeOperatorApiConfig,
  runner?: CommandRunner,
): Promise<ActionResponseEnvelope<PrInventoryData>> {
  const resolved = resolveRepoRoot(ctx, config);
  if (!resolved) {
    return missingRepoRootEnvelope(ctx, {
      openCount: 0,
      candidatePr: null,
      unresolvedThreadsAfter: 0,
    });
  }

  const options = toolOptions(ctx, config, resolved.repoRoot);
  const output = runPrProtocolTool(
    options,
    {
      repo: config.repo ?? 'Doogie201/promptops-gui',
      previousSprintPrefix: config.previousSprintPrefix ?? 'S16',
      resolveCodexThreads: false,
    },
    runner,
  );

  const data: PrInventoryData = {
    openCount: Number(output.result.summary.open_count ?? 0),
    candidatePr: output.result.summary.candidate_pr ? Number(output.result.summary.candidate_pr) : null,
    unresolvedThreadsAfter: Number(output.result.summary.unresolved_after ?? 0),
  };

  return toEnvelope(
    ctx,
    resolved.strategy,
    output.records,
    output.result.status,
    output.result.reasonCode,
    output.result.message,
    data,
    output.result.receiptPaths,
    output.durablePath,
  );
}

async function runStatusAction(
  ctx: ActionContext,
  config: NodeOperatorApiConfig,
  runner?: CommandRunner,
): Promise<ActionResponseEnvelope<RunStatusData>> {
  const resolved = resolveRepoRoot(ctx, config);
  if (!resolved) return missingRepoRootEnvelope(ctx, { signalCount: 0, diagnosisPath: null });

  const options = toolOptions(ctx, config, resolved.repoRoot);
  const output = runOutOfSyncTool(options, {}, runner);
  const signalsPath = output.result.receiptPaths.radar_signals;
  const signalCount = loadSignalCount(signalsPath);
  const data: RunStatusData = {
    signalCount,
    diagnosisPath: output.result.receiptPaths.diagnosis_report ?? null,
  };

  return toEnvelope(
    ctx,
    resolved.strategy,
    output.records,
    output.result.status,
    output.result.reasonCode,
    output.result.message,
    data,
    output.result.receiptPaths,
    output.durablePath,
  );
}

function toEnvelope<TData>(
  ctx: ActionContext,
  strategy: RepoRootStrategy,
  records: CommandRecord[],
  status: 'PASS' | 'FAIL' | 'HARD_STOP',
  reasonCode: string,
  message: string,
  data: TData,
  receiptPaths: Record<string, string>,
  durableBundlePath: string,
): ActionResponseEnvelope<TData> {
  const request = requestEnvelope(ctx, strategy);
  const receipts = mapReceipts(records);
  const exitCode = records.length ? Math.max(...records.map((record) => record.exit_code)) : 1;
  const hashBase = {
    action: ctx.action,
    request,
    status,
    reasonCode,
    message,
    data,
    receipts,
    receiptPaths,
    durableBundlePath,
    exitCode,
  };

  return {
    action: ctx.action,
    request,
    status,
    reasonCode,
    message,
    data,
    receipts,
    receiptPaths,
    durableBundlePath,
    exitCode,
    resultHash: sha256(stableJson(hashBase)),
  };
}

function missingRepoRootEnvelope<TData>(ctx: ActionContext, data: TData): ActionResponseEnvelope<TData> {
  const request = requestEnvelope(ctx, 'unresolved');
  const hashBase = {
    action: ctx.action,
    request,
    status: 'HARD_STOP',
    reasonCode: 'MISSING_REPO_ROOT',
    message: 'HARD STOP: MISSING_REPO_ROOT (set PROMPTOPS_REPO or provide repo path)',
    data,
  };

  return {
    action: ctx.action,
    request,
    status: 'HARD_STOP',
    reasonCode: 'MISSING_REPO_ROOT',
    message: 'HARD STOP: MISSING_REPO_ROOT (set PROMPTOPS_REPO or provide repo path)',
    data,
    receipts: [],
    receiptPaths: {},
    durableBundlePath: null,
    exitCode: 1,
    resultHash: sha256(stableJson(hashBase)),
  };
}

function resolveRepoRoot(ctx: ActionContext, config: NodeOperatorApiConfig): ResolvedRepoRoot | null {
  const explicit = ctx.args.repoRoot ?? config.repoRoot;
  if (explicit && explicit.trim()) {
    return { repoRoot: path.resolve(explicit), strategy: 'explicit_arg' };
  }

  const envRoot = process.env.PROMPTOPS_REPO;
  if (envRoot && envRoot.trim()) {
    return { repoRoot: path.resolve(envRoot), strategy: 'env_PROMPTOPS_REPO' };
  }

  return null;
}

function requestEnvelope(ctx: ActionContext, strategy: RepoRootStrategy): ActionRequestEnvelope {
  return {
    action: ctx.action,
    requestId: ctx.requestId,
    args: ctx.args,
    repoRootStrategy: strategy,
  };
}

function mapReceipts(records: CommandRecord[]): ReceiptSummary[] {
  return records.map((record) => ({
    id: record.id,
    cmd: record.cmd,
    exitCode: record.exit_code,
    stdoutPath: record.stdout_path,
    stderrPath: record.stderr_path,
  }));
}

function toolOptions(ctx: ActionContext, config: NodeOperatorApiConfig, repoRoot: string): ToolOptions {
  const sprintId = config.sprintId ?? SPRINT_ID;
  const stagingBase = config.stagingBase ?? '/tmp/promptops/S17/ui/actions';
  const durableBase = config.durableBase ?? path.join(repoRoot, 'docs', 'sprints', 'S17', 'evidence', 'ui_actions');
  return {
    sprintId,
    runId: ctx.requestId,
    timestamp: ctx.args.timestamp,
    repoRoot,
    stagingBase,
    durableBase,
  };
}

function requestId(action: DashboardActionId, args: Record<string, string>): string {
  return args.requestId ?? `${action}_001`;
}

function loadSignalCount(filePath: string | undefined): number {
  if (!filePath || !fs.existsSync(filePath)) return 0;

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Array<{ active?: boolean }>;
    return parsed.filter((item) => Boolean(item.active)).length;
  } catch {
    return 0;
  }
}
