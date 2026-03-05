import * as path from 'node:path';
import {
  copyBundleToDurable,
  createToolRunContext,
  executeCommandSet,
  sha256,
  stableJson,
  writeJson,
} from '../s10/operator_exec.ts';
import type { CommandRecord, CommandRunner, CommandSpec, ToolOptions } from '../s10/operator_types.ts';

export interface GoldenRunArtifacts {
  runId: string;
  verdict: string;
  ticket: Record<string, unknown>;
  narrationLines: string[];
  events: Record<string, unknown>[];
  ledger: Record<string, unknown>;
  receipts: Array<Record<string, unknown>>;
}

export interface GoldenFixture {
  canonical: string;
  hash: string;
  outputHashes: Record<string, string>;
}

export interface ReplayComparison {
  pass: boolean;
  expectedHash: string;
  actualHash: string;
  mismatches: string[];
}

export interface LongRunSample {
  iteration: number;
  heapUsedBytes: number;
  logBytes: number;
  uiLatencyMs: number;
  fatalErrors: number;
}

export interface LongRunBudget {
  maxHeapGrowthBytes: number;
  maxLogGrowthBytes: number;
  maxUiLatencyMs: number;
  maxFatalErrors: number;
}

export interface LongRunEvaluation {
  pass: boolean;
  failures: string[];
  summary: {
    iterations: number;
    heapGrowthBytes: number;
    logGrowthBytes: number;
    peakUiLatencyMs: number;
    totalFatalErrors: number;
  };
}

export interface AdapterAttempt {
  attempt: number;
  status: 'timeout' | 'error' | 'success';
  elapsedMs: number;
  partialOutput?: string;
  errorType?: string;
}

export interface AdapterRetryPolicy {
  maxAttempts: number;
  retryDelaysMs: readonly number[];
  switchAfterFailures: number;
}

export interface AdapterResilienceResult {
  status: 'SUCCESS' | 'SWITCH_AGENT' | 'HARD_STOP';
  attemptsProcessed: number;
  retryScheduleMs: number[];
  salvagedOutput: string;
  events: Array<{ type: string; detail: string }>;
}

export type RecoveryActionId =
  | 'repair_run_store'
  | 'reindex_artifacts'
  | 'resume_from_checkpoint'
  | 'generate_diagnosis_report';

export interface RecoveryActionResult {
  actionId: RecoveryActionId;
  status: 'PASS' | 'FAIL';
  records: CommandRecord[];
  durablePath: string;
  receiptPaths: {
    commands: string;
    outputs: string;
    summary: string;
  };
}

const DEFAULT_POLICY: AdapterRetryPolicy = {
  maxAttempts: 4,
  retryDelaysMs: [0, 50, 150, 300],
  switchAfterFailures: 3,
};

const RECOVERY_ACTION_SPECS: Record<RecoveryActionId, CommandSpec[]> = {
  repair_run_store: [
    { id: 'status', command: 'git', args: ['status', '--porcelain=v1', '--branch'] },
    { id: 'fetch', command: 'git', args: ['fetch', '--all', '--prune', '--tags'] },
    { id: 'ahead_behind', command: 'git', args: ['rev-list', '--left-right', '--count', 'HEAD...origin/main'] },
  ],
  reindex_artifacts: [
    { id: 'pwd', command: 'pwd', args: [] },
    { id: 'show_toplevel', command: 'git', args: ['rev-parse', '--show-toplevel'] },
    { id: 'worktree_list', command: 'git', args: ['worktree', 'list', '--porcelain'] },
  ],
  resume_from_checkpoint: [
    { id: 'branch', command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] },
    { id: 'log', command: 'git', args: ['log', '--oneline', '-5'] },
    { id: 'status', command: 'git', args: ['status', '--porcelain=v1', '--branch'] },
  ],
  generate_diagnosis_report: [
    { id: 'prune_dry_run', command: 'git', args: ['prune', '--dry-run'] },
    { id: 'fsck', command: 'git', args: ['fsck', '--no-reflogs'] },
    { id: 'ahead_behind', command: 'git', args: ['rev-list', '--left-right', '--count', 'HEAD...origin/main'] },
  ],
};

export function buildGoldenFixture(input: GoldenRunArtifacts): GoldenFixture {
  const ordered = canonicalGoldenPayload(input);
  const canonical = stableJson(ordered);
  return {
    canonical,
    hash: sha256(canonical),
    outputHashes: {
      events: sha256(stableJson(ordered.events)),
      ledger: sha256(stableJson(ordered.ledger)),
      narration: sha256(stableJson(ordered.narration_lines)),
      receipts: sha256(stableJson(ordered.receipts)),
      ticket: sha256(stableJson(ordered.ticket)),
      verdict: sha256(stableJson(ordered.verdict)),
    },
  };
}

export function compareGoldenReplay(expected: GoldenFixture, replay: GoldenRunArtifacts): ReplayComparison {
  const next = buildGoldenFixture(replay);
  const mismatches = Object.keys(expected.outputHashes)
    .sort()
    .filter((key) => expected.outputHashes[key] !== next.outputHashes[key]);
  return {
    pass: expected.hash === next.hash && mismatches.length === 0,
    expectedHash: expected.hash,
    actualHash: next.hash,
    mismatches,
  };
}

export function evaluateLongRunStability(samples: LongRunSample[], budget: LongRunBudget): LongRunEvaluation {
  const sorted = [...samples].sort((a, b) => a.iteration - b.iteration);
  if (sorted.length === 0) {
    return {
      pass: false,
      failures: ['no_samples'],
      summary: { iterations: 0, heapGrowthBytes: 0, logGrowthBytes: 0, peakUiLatencyMs: 0, totalFatalErrors: 0 },
    };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const heapGrowthBytes = last.heapUsedBytes - first.heapUsedBytes;
  const logGrowthBytes = last.logBytes - first.logBytes;
  const peakUiLatencyMs = sorted.reduce((max, sample) => (sample.uiLatencyMs > max ? sample.uiLatencyMs : max), 0);
  const totalFatalErrors = sorted.reduce((sum, sample) => sum + sample.fatalErrors, 0);
  const failures: string[] = [];
  if (heapGrowthBytes > budget.maxHeapGrowthBytes) failures.push(`heap_growth_exceeded:${heapGrowthBytes}`);
  if (logGrowthBytes > budget.maxLogGrowthBytes) failures.push(`log_growth_exceeded:${logGrowthBytes}`);
  if (peakUiLatencyMs > budget.maxUiLatencyMs) failures.push(`ui_latency_exceeded:${peakUiLatencyMs}`);
  if (totalFatalErrors > budget.maxFatalErrors) failures.push(`fatal_errors_exceeded:${totalFatalErrors}`);
  return {
    pass: failures.length === 0,
    failures,
    summary: {
      iterations: sorted.length,
      heapGrowthBytes,
      logGrowthBytes,
      peakUiLatencyMs,
      totalFatalErrors,
    },
  };
}

export function evaluateAdapterResilience(
  attempts: AdapterAttempt[],
  policy: AdapterRetryPolicy = DEFAULT_POLICY,
): AdapterResilienceResult {
  const events: Array<{ type: string; detail: string }> = [];
  const retryScheduleMs: number[] = [];
  const ordered = [...attempts].sort((a, b) => a.attempt - b.attempt);
  let failureCount = 0;
  let salvagedOutput = '';
  for (const attempt of ordered) {
    if (attempt.attempt > policy.maxAttempts) break;
    if (attempt.partialOutput) {
      salvagedOutput = `${salvagedOutput}${attempt.partialOutput}`;
    }
    if (attempt.status === 'success') {
      events.push({ type: 'adapter_success', detail: `attempt=${attempt.attempt}` });
      return {
        status: 'SUCCESS',
        attemptsProcessed: attempt.attempt,
        retryScheduleMs,
        salvagedOutput,
        events,
      };
    }
    failureCount += 1;
    events.push({ type: 'adapter_failure', detail: `attempt=${attempt.attempt};status=${attempt.status}` });
    if (failureCount >= policy.switchAfterFailures) {
      events.push({ type: 'agent_switch', detail: `failures=${failureCount};reason=retry_exhausted` });
      return {
        status: 'SWITCH_AGENT',
        attemptsProcessed: attempt.attempt,
        retryScheduleMs,
        salvagedOutput,
        events,
      };
    }
    const hasAnotherAttempt = attempt.attempt < policy.maxAttempts;
    if (hasAnotherAttempt) {
      const retryDelay = policy.retryDelaysMs[Math.min(failureCount - 1, policy.retryDelaysMs.length - 1)] ?? 0;
      retryScheduleMs.push(retryDelay);
    }
  }
  events.push({ type: 'adapter_hard_stop', detail: 'max_attempts_reached' });
  return {
    status: 'HARD_STOP',
    attemptsProcessed: Math.min(ordered.length, policy.maxAttempts),
    retryScheduleMs,
    salvagedOutput,
    events,
  };
}

export function recoveryActionSpecs(actionId: RecoveryActionId): CommandSpec[] {
  return RECOVERY_ACTION_SPECS[actionId].map((spec) => ({
    id: spec.id,
    command: spec.command,
    args: [...spec.args],
  }));
}

export function runRecoveryAction(options: ToolOptions, actionId: RecoveryActionId, runner?: CommandRunner): RecoveryActionResult {
  const context = createToolRunContext('s16_recovery', {
    ...options,
    runId: `${options.runId}_${actionId}`,
  });
  const records = executeCommandSet(context, recoveryActionSpecs(actionId), `${actionId}_outputs.ndjson`, runner);
  const failures = records.filter((record) => record.exit_code !== 0).map((record) => `${record.id}:${record.exit_code}`);
  const status = failures.length === 0 ? 'PASS' : 'FAIL';
  const summaryPath = path.join(context.bundleRoot, `${actionId}_summary.json`);
  writeJson(summaryPath, {
    action_id: actionId,
    status,
    failures,
    continuity_hash: context.continuityHash,
  });
  const durablePath = copyBundleToDurable(context);
  return {
    actionId,
    status,
    records,
    durablePath,
    receiptPaths: {
      commands: path.join(context.bundleRoot, `${actionId}_commands.json`),
      outputs: path.join(context.bundleRoot, `${actionId}_outputs.ndjson`),
      summary: summaryPath,
    },
  };
}

function canonicalGoldenPayload(input: GoldenRunArtifacts): Record<string, unknown> {
  return {
    run_id: input.runId,
    verdict: input.verdict,
    ticket: input.ticket,
    narration_lines: [...input.narrationLines],
    events: [...input.events],
    ledger: input.ledger,
    receipts: [...input.receipts],
  };
}
