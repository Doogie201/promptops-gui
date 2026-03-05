import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  copyBundleToDurable,
  createToolRunContext,
  executeCommandSet,
  writeJson,
  writeText,
} from './operator_exec.ts';
import type {
  CommandRecord,
  CommandRunner,
  CommandSpec,
  HardStopCode,
  ToolOptions,
  ToolResult,
  ToolRunContext,
} from './operator_types.ts';

const BAD_OBJECT_PATTERN = /(bad sha1|invalid ref|error:|fatal:|badrefname|appledouble|\._)/i;
const CODEX_AUTHOR_PATTERN = /(chatgpt|codex|chatgpt-codex|connector)/i;

export interface ToolRunResponse {
  context: ToolRunContext;
  records: CommandRecord[];
  result: ToolResult;
  durablePath: string;
}

export interface PrProtocolOptions {
  repo: string;
  previousSprintPrefix?: string;
  resolveCodexThreads?: boolean;
}

export interface DiffOptions {
  whitelist: string[];
  maxNetNewLinesPerFile: number;
}

export interface OutOfSyncOptions {
  expectedHead?: string;
  expectedEvidencePaths?: string[];
}

export function runPreflightTool(options: ToolOptions, runner?: CommandRunner): ToolRunResponse {
  const context = createToolRunContext('preflight', options);
  const records = executeCommandSet(context, preflightCommandSpecs(), 'preflight_outputs.ndjson', runner);
  const evaluation = evaluatePreflight(context.repoRoot, records);
  const evalPath = path.join(context.bundleRoot, 'preflight_eval.md');
  writeText(evalPath, formatEval('Preflight', evaluation));
  const result = buildResult('preflight', evaluation.code, evaluation.pass ? 'PASS' : 'HARD_STOP', evaluation.message, {
    preflight_commands: path.join(context.bundleRoot, 'preflight_commands.json'),
    preflight_outputs: path.join(context.bundleRoot, 'preflight_outputs.ndjson'),
    preflight_eval: evalPath,
  }, {
    branch: evaluation.branch,
    dirty: evaluation.dirty,
    ahead: evaluation.ahead,
    behind: evaluation.behind,
    continuity_hash: context.continuityHash,
  });
  const durablePath = copyBundleToDurable(context);
  return { context, records, result, durablePath };
}

export function runPrProtocolTool(
  options: ToolOptions,
  protocol: PrProtocolOptions,
  runner?: CommandRunner,
): ToolRunResponse {
  const context = createToolRunContext('pr_protocol', options);
  const inventory = loadPrInventory(context, options, protocol, runner);
  if (inventory.unrelated.length > 0) {
    return finalizePrInventoryStop(context, inventory.records, inventory.openList, inventory.unrelated.length);
  }
  if (!inventory.target) {
    return finalizePrNoCandidate(context, inventory.records, inventory.openList.length);
  }
  return runPrCandidateFlow(context, inventory.records, inventory.target.number, protocol, runner, inventory.openList.length);
}

export function runGatesTool(options: ToolOptions, runner?: CommandRunner): ToolRunResponse {
  const context = createToolRunContext('gates', options);
  const records = executeCommandSet(context, gatesSpecs(), 'gates_outputs.ndjson', runner);
  const failed = records.filter((record) => record.exit_code !== 0);
  const pass = failed.length === 0;
  const evalPath = path.join(context.bundleRoot, 'gates_eval.md');
  writeText(
    evalPath,
    formatEval('Gates', {
      pass,
      code: pass ? 'NONE' : 'PR_NOT_READY',
      message: pass ? 'All gates passed.' : `Gate failures: ${failed.map((item) => item.id).join(', ')}`,
    }),
  );
  const result = buildResult('gates', pass ? 'NONE' : 'PR_NOT_READY', pass ? 'PASS' : 'FAIL', pass ? 'Gates passed.' : 'Gate execution failed.', {
    gates_commands: path.join(context.bundleRoot, 'gates_commands.json'),
    gates_outputs: path.join(context.bundleRoot, 'gates_outputs.ndjson'),
    gates_eval: evalPath,
  }, {
    failed_count: failed.length,
    continuity_hash: context.continuityHash,
  });
  const durablePath = copyBundleToDurable(context);
  return { context, records, result, durablePath };
}

export function runDiffReviewTool(options: ToolOptions, diff: DiffOptions, runner?: CommandRunner): ToolRunResponse {
  const context = createToolRunContext('diff', options);
  const records = executeCommandSet(context, diffSpecs(), 'diff_outputs.ndjson', runner);
  const files = parseLines(readRecordStdout(records, 'diff_files'));
  const diffstat = readRecordStdout(records, 'diffstat');
  const numstatLines = parseLines(readRecordStdout(records, 'diff_numstat'));

  const outside = files.filter((file) => !isWhitelisted(file, diff.whitelist));
  const breaches = budgetBreaches(numstatLines, diff.maxNetNewLinesPerFile);

  writeJson(path.join(context.bundleRoot, 'diff_files.json'), files);
  writeText(path.join(context.bundleRoot, 'diffstat.txt'), diffstat);
  const whitelistEval = outside.length === 0 ? 'PASS: all changed files are within whitelist.' : `HARD_STOP: outside whitelist\n${outside.join('\n')}`;
  const budgetEval = breaches.length === 0
    ? 'PASS: no budget breaches detected.'
    : `HARD_STOP: BUDGET BREACH\n${breaches.map((item) => `${item.file}: net=${item.net} (+${item.added}/-${item.deleted})`).join('\n')}`;
  writeText(path.join(context.bundleRoot, 'whitelist_eval.md'), whitelistEval);
  writeText(path.join(context.bundleRoot, 'budget_eval.md'), budgetEval);

  const status = outside.length > 0 || breaches.length > 0 ? 'HARD_STOP' : 'PASS';
  const reason: HardStopCode = outside.length > 0 ? 'WHITELIST_VIOLATION' : breaches.length > 0 ? 'BUDGET_BREACH' : 'NONE';
  const message = outside.length > 0
    ? `Whitelist violation: ${outside.join(', ')}`
    : breaches.length > 0
      ? `Budget breaches: ${breaches.map((item) => item.file).join(', ')}`
      : 'Diff review passed.';

  const result = buildResult('diff', reason, status, message, {
    diff_files: path.join(context.bundleRoot, 'diff_files.json'),
    diffstat: path.join(context.bundleRoot, 'diffstat.txt'),
    whitelist_eval: path.join(context.bundleRoot, 'whitelist_eval.md'),
    budget_eval: path.join(context.bundleRoot, 'budget_eval.md'),
  }, {
    changed_files: files.length,
    outside_whitelist: outside.length,
    budget_breaches: breaches.length,
    continuity_hash: context.continuityHash,
  });

  const durablePath = copyBundleToDurable(context);
  return { context, records, result, durablePath };
}

export function runOutOfSyncTool(options: ToolOptions, radar: OutOfSyncOptions, runner?: CommandRunner): ToolRunResponse {
  const context = createToolRunContext('out_of_sync', options);
  const records = executeCommandSet(context, outOfSyncSpecs(), 'out_of_sync_outputs.ndjson', runner);
  const status = readRecordStdout(records, 'radar_status');
  const head = readRecordStdout(records, 'radar_head').trim();
  const aheadBehind = parseAheadBehind(readRecordStdout(records, 'radar_ahead_behind'));
  const dirty = parseStatusDirty(status);
  const missingEvidence = (radar.expectedEvidencePaths ?? []).filter((entry) => !fs.existsSync(path.resolve(entry)));

  const signals = [
    { id: 'DIRTY_TREE_MID_RUN', active: dirty, detail: dirty ? 'status has tracked/untracked changes' : 'clean' },
    { id: 'HEAD_CHANGED_UNEXPECTEDLY', active: Boolean(radar.expectedHead && radar.expectedHead !== head), detail: `expected=${radar.expectedHead ?? 'n/a'} current=${head}` },
    { id: 'BEHIND_ORIGIN_MAIN', active: aheadBehind.behind > 0, detail: `ahead=${aheadBehind.ahead} behind=${aheadBehind.behind}` },
    { id: 'MISSING_EVIDENCE_PATHS', active: missingEvidence.length > 0, detail: missingEvidence.join(', ') || 'none' },
    { id: 'MISSING_SPRINT_DOCS', active: !fs.existsSync(path.join(context.repoRoot, 'docs', 'sprints', 'S10', 'README.md')), detail: 'docs/sprints/S10/README.md' },
  ];

  const repairs = signals.filter((signal) => signal.active).map((signal) => mapRepairAction(signal.id));
  writeJson(path.join(context.bundleRoot, 'radar_signals.json'), signals);
  writeJson(path.join(context.bundleRoot, 'repair_actions.json'), repairs);
  writeText(path.join(context.bundleRoot, 'diagnosis_report.md'), formatDiagnosis(signals, repairs));

  const pass = repairs.length === 0;
  const result = buildResult('out_of_sync', pass ? 'NONE' : 'OUT_OF_SYNC', pass ? 'PASS' : 'FAIL', pass ? 'No out-of-sync signals detected.' : 'Out-of-sync signals detected.', {
    radar_signals: path.join(context.bundleRoot, 'radar_signals.json'),
    repair_actions: path.join(context.bundleRoot, 'repair_actions.json'),
    diagnosis_report: path.join(context.bundleRoot, 'diagnosis_report.md'),
  }, {
    signal_count: signals.filter((item) => item.active).length,
    continuity_hash: context.continuityHash,
  });

  const durablePath = copyBundleToDurable(context);
  return { context, records, result, durablePath };
}

export function runCloseoutTool(
  options: ToolOptions,
  checklist: Array<{ id: string; label: string; done: boolean }>,
  requiredPaths: string[],
): ToolRunResponse {
  const context = createToolRunContext('closeout', options);
  const missing = requiredPaths.filter((entry) => !fs.existsSync(path.resolve(entry)));
  const allDone = checklist.every((item) => item.done);
  const pass = allDone && missing.length === 0;

  const summary = [
    `# S10 Closeout Summary`,
    '',
    `- Sprint: ${options.sprintId}`,
    `- Run ID: ${options.runId}`,
    `- Continuity Hash: ${context.continuityHash}`,
    `- Checklist Complete: ${allDone}`,
    `- Missing Receipts: ${missing.length}`,
    '',
    '## Checklist',
    ...checklist.map((item) => `- [${item.done ? 'x' : ' '}] ${item.id}: ${item.label}`),
  ].join('\n');

  const manifest = {
    sprint_id: options.sprintId,
    run_id: options.runId,
    continuity_hash: context.continuityHash,
    checklist,
    required_paths: requiredPaths,
    missing_paths: missing,
    pass,
  };

  writeText(path.join(context.bundleRoot, 'closeout_summary.md'), summary);
  writeJson(path.join(context.bundleRoot, 'closeout_manifest.json'), manifest);

  const result = buildResult('closeout', pass ? 'NONE' : 'PR_NOT_READY', pass ? 'PASS' : 'FAIL', pass ? 'Closeout is complete.' : 'Closeout is missing required receipts or checklist items.', {
    closeout_summary: path.join(context.bundleRoot, 'closeout_summary.md'),
    closeout_manifest: path.join(context.bundleRoot, 'closeout_manifest.json'),
  }, {
    missing_paths: missing.length,
    checklist_complete: allDone,
    continuity_hash: context.continuityHash,
  });

  const durablePath = copyBundleToDurable(context);
  return { context, records: [], result, durablePath };
}

function loadPrInventory(
  context: ToolRunContext,
  options: ToolOptions,
  protocol: PrProtocolOptions,
  runner: CommandRunner | undefined,
): {
  records: CommandRecord[];
  openList: Array<Record<string, unknown>>;
  unrelated: Array<Record<string, unknown>>;
  target: Record<string, unknown> | null;
} {
  const records = executeCommandSet(context, [openPrSpec(protocol.repo)], 'pr_protocol_outputs.ndjson', runner);
  const openList = parseJsonArray(readRecordStdout(records, 'open_pr_list'));
  writeJson(path.join(context.bundleRoot, 'open_pr_list.json'), openList);
  const previous = protocol.previousSprintPrefix ?? previousSprintId(options.sprintId);
  const unrelated = openList.filter((item) => !matchesPreviousSprint(item, previous));
  const target = openList.find((item) => matchesPreviousSprint(item, previous)) ?? null;
  return { records, openList, unrelated, target };
}

function finalizePrInventoryStop(
  context: ToolRunContext,
  records: CommandRecord[],
  openList: Array<Record<string, unknown>>,
  unrelatedCount: number,
): ToolRunResponse {
  const evalPath = path.join(context.bundleRoot, 'pr_protocol_eval.md');
  writeText(
    evalPath,
    formatEval('PR Protocol', {
      pass: false,
      code: 'UNRELATED_OPEN_PRS',
      message: `Unrelated open PRs detected (${unrelatedCount}).`,
    }),
  );
  const result = buildResult(
    'pr_protocol',
    'UNRELATED_OPEN_PRS',
    'HARD_STOP',
    'Unrelated open PRs present.',
    {
      open_pr_list: path.join(context.bundleRoot, 'open_pr_list.json'),
      pr_protocol_eval: evalPath,
    },
    {
      open_count: openList.length,
      unrelated_count: unrelatedCount,
      continuity_hash: context.continuityHash,
    },
  );
  const durablePath = copyBundleToDurable(context);
  return { context, records, result, durablePath };
}

function finalizePrNoCandidate(
  context: ToolRunContext,
  records: CommandRecord[],
  openCount: number,
): ToolRunResponse {
  writeJson(path.join(context.bundleRoot, 'pr_view.json'), {});
  writeJson(path.join(context.bundleRoot, 'pr_threads_before.json'), {});
  writeJson(path.join(context.bundleRoot, 'pr_threads_after.json'), {});
  writeText(path.join(context.bundleRoot, 'graphql_resolve_mutations.jsonl'), '');
  const evalPath = path.join(context.bundleRoot, 'pr_protocol_eval.md');
  writeText(evalPath, formatEval('PR Protocol', { pass: true, code: 'NONE', message: 'No previous-sprint open PR found.' }));
  const result = buildResult(
    'pr_protocol',
    'NONE',
    'PASS',
    'No merge candidate; inventory is clean.',
    {
      open_pr_list: path.join(context.bundleRoot, 'open_pr_list.json'),
      pr_protocol_eval: evalPath,
    },
    { open_count: openCount, continuity_hash: context.continuityHash },
  );
  const durablePath = copyBundleToDurable(context);
  return { context, records, result, durablePath };
}

function runPrCandidateFlow(
  context: ToolRunContext,
  baseRecords: CommandRecord[],
  prNumber: number,
  protocol: PrProtocolOptions,
  runner: CommandRunner | undefined,
  openCount: number,
): ToolRunResponse {
  const records = [...baseRecords, ...fetchPrViewAndThreads(context, prNumber, protocol.repo, runner)];
  const beforeThreads = parseJsonObject(readRecordStdout(records, 'pr_threads_before'));
  const unresolvedBefore = unresolvedCodexThreadIds(beforeThreads);
  const mutationsPath = path.join(context.bundleRoot, 'graphql_resolve_mutations.jsonl');
  writeText(mutationsPath, '');
  appendThreadResolutions(context, records, protocol, unresolvedBefore, runner, mutationsPath);
  const afterRecords = executeCommandSet(
    context,
    [threadQuerySpec(protocol.repo, prNumber, 'pr_threads_after')],
    'pr_protocol_outputs.ndjson',
    runner,
  );
  records.push(...afterRecords);
  return finalizePrCandidateResult(context, records, prNumber, unresolvedBefore.length, openCount, mutationsPath);
}

function fetchPrViewAndThreads(
  context: ToolRunContext,
  prNumber: number,
  repo: string,
  runner: CommandRunner | undefined,
): CommandRecord[] {
  const withView = executeCommandSet(context, [prViewSpec(repo, prNumber)], 'pr_protocol_outputs.ndjson', runner);
  const withThreads = executeCommandSet(
    context,
    [threadQuerySpec(repo, prNumber, 'pr_threads_before')],
    'pr_protocol_outputs.ndjson',
    runner,
  );
  return [...withView, ...withThreads];
}

function appendThreadResolutions(
  context: ToolRunContext,
  records: CommandRecord[],
  protocol: PrProtocolOptions,
  unresolved: string[],
  runner: CommandRunner | undefined,
  mutationsPath: string,
): void {
  if (unresolved.length === 0 || protocol.resolveCodexThreads === false) return;
  for (const threadId of unresolved) {
    const mutationSpec = threadResolveSpec(protocol.repo, threadId);
    const mutationRecords = executeCommandSet(context, [mutationSpec], 'pr_protocol_outputs.ndjson', runner);
    fs.appendFileSync(
      mutationsPath,
      `${JSON.stringify({ thread_id: threadId, output: readRecordStdout(mutationRecords, mutationSpec.id) })}\n`,
      'utf8',
    );
    records.push(...mutationRecords);
  }
}

function finalizePrCandidateResult(
  context: ToolRunContext,
  records: CommandRecord[],
  prNumber: number,
  unresolvedBeforeCount: number,
  openCount: number,
  mutationsPath: string,
): ToolRunResponse {
  const prView = parseJsonObject(readRecordStdout(records, 'pr_view'));
  const beforeThreads = parseJsonObject(readRecordStdout(records, 'pr_threads_before'));
  const afterThreads = parseJsonObject(readRecordStdout(records, 'pr_threads_after'));
  const unresolvedAfter = unresolvedCodexThreadIds(afterThreads);
  const readiness = evaluatePrReadiness(prView, afterThreads, unresolvedAfter.length);
  writeJson(path.join(context.bundleRoot, 'pr_view.json'), prView);
  writeJson(path.join(context.bundleRoot, 'pr_threads_before.json'), beforeThreads);
  writeJson(path.join(context.bundleRoot, 'pr_threads_after.json'), afterThreads);
  const evalPath = path.join(context.bundleRoot, 'pr_protocol_eval.md');
  writeText(evalPath, formatEval('PR Protocol', readiness));
  const result = buildResult(
    'pr_protocol',
    readiness.code,
    readiness.pass ? 'PASS' : 'HARD_STOP',
    readiness.message,
    {
      open_pr_list: path.join(context.bundleRoot, 'open_pr_list.json'),
      pr_view: path.join(context.bundleRoot, 'pr_view.json'),
      pr_threads_before: path.join(context.bundleRoot, 'pr_threads_before.json'),
      pr_threads_after: path.join(context.bundleRoot, 'pr_threads_after.json'),
      graphql_resolve_mutations: mutationsPath,
      pr_protocol_eval: evalPath,
    },
    {
      open_count: openCount,
      candidate_pr: prNumber,
      unresolved_before: unresolvedBeforeCount,
      unresolved_after: unresolvedAfter.length,
      continuity_hash: context.continuityHash,
    },
  );
  const durablePath = copyBundleToDurable(context);
  return { context, records, result, durablePath };
}

function preflightCommandSpecs(): CommandSpec[] {
  return [
    { id: 'pwd', command: 'pwd', args: [] },
    { id: 'echo_promptops_repo', command: 'bash', args: ['-lc', 'echo "$PROMPTOPS_REPO"'] },
    { id: 'show_toplevel', command: 'git', args: ['rev-parse', '--show-toplevel'] },
    { id: 'worktree_list', command: 'git', args: ['worktree', 'list', '--porcelain'] },
    { id: 'status', command: 'git', args: ['status', '--porcelain=v1', '--branch'] },
    { id: 'fetch', command: 'git', args: ['fetch', '--all', '--prune', '--tags'] },
    { id: 'ahead_behind', command: 'git', args: ['rev-list', '--left-right', '--count', 'HEAD...origin/main'] },
    { id: 'branch', command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] },
    { id: 'log', command: 'git', args: ['log', '--oneline', '-5'] },
    { id: 'prune_dry_run', command: 'git', args: ['prune', '--dry-run'] },
    { id: 'fsck', command: 'git', args: ['fsck', '--no-reflogs'] },
  ];
}

function openPrSpec(repo: string): CommandSpec {
  return {
    id: 'open_pr_list',
    command: 'gh',
    args: ['pr', 'list', '--repo', repo, '--state', 'open', '--json', 'number,title,headRefName,baseRefName,url,updatedAt'],
  };
}

function prViewSpec(repo: string, prNumber: number): CommandSpec {
  return {
    id: 'pr_view',
    command: 'gh',
    args: [
      'pr',
      'view',
      String(prNumber),
      '--repo',
      repo,
      '--json',
      'number,title,state,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,headRefName,headRefOid,baseRefName,labels,body,url',
    ],
  };
}

function threadQuerySpec(repo: string, prNumber: number, id: string): CommandSpec {
  const [owner, name] = repo.split('/');
  const query = [
    'query($owner:String!,$name:String!,$number:Int!){',
    ' repository(owner:$owner,name:$name){',
    '  pullRequest(number:$number){',
    '   comments(last:100){nodes{author{login} bodyText url createdAt}}',
    '   reviewThreads(last:100){nodes{id isResolved comments(first:20){nodes{author{login} bodyText url createdAt}}}}',
    '  }',
    ' }',
    '}',
  ].join(' ');
  return {
    id,
    command: 'gh',
    args: ['api', 'graphql', '-f', `query=${query}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `number=${prNumber}`],
  };
}

function threadResolveSpec(repo: string, threadId: string): CommandSpec {
  const [owner, name] = repo.split('/');
  const mutation = 'mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}';
  return {
    id: `resolve_${threadId}`,
    command: 'gh',
    args: ['api', 'graphql', '-f', `query=${mutation}`, '-F', `threadId=${threadId}`, '-F', `owner=${owner}`, '-F', `name=${name}`],
  };
}

function gatesSpecs(): CommandSpec[] {
  return [
    { id: 'gate_readiness_status', command: 'git', args: ['status', '--porcelain=v1', '--branch'] },
    { id: 'gate_verify', command: 'npm', args: ['run', '-s', 'verify'] },
    { id: 'gate_gates_sh', command: 'bash', args: ['gates.sh'] },
  ];
}

function diffSpecs(): CommandSpec[] {
  return [
    { id: 'diff_files', command: 'git', args: ['diff', '--name-only'] },
    { id: 'diffstat', command: 'git', args: ['diff', '--stat'] },
    { id: 'diff_numstat', command: 'git', args: ['diff', '--numstat'] },
  ];
}

function outOfSyncSpecs(): CommandSpec[] {
  return [
    { id: 'radar_status', command: 'git', args: ['status', '--porcelain=v1', '--branch'] },
    { id: 'radar_head', command: 'git', args: ['rev-parse', 'HEAD'] },
    { id: 'radar_ahead_behind', command: 'git', args: ['rev-list', '--left-right', '--count', 'HEAD...origin/main'] },
  ];
}

function evaluatePreflight(repoRoot: string, records: CommandRecord[]): {
  pass: boolean;
  code: HardStopCode;
  message: string;
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
} {
  const envRepo = readRecordStdout(records, 'echo_promptops_repo').trim();
  const toplevel = readRecordStdout(records, 'show_toplevel').trim();
  const branch = readRecordStdout(records, 'branch').trim();
  const status = readRecordStdout(records, 'status');
  const dirty = parseStatusDirty(status);
  const aheadBehind = parseAheadBehind(readRecordStdout(records, 'ahead_behind'));
  const fetch = lookupRecord(records, 'fetch');
  const aheadBehindProbe = lookupRecord(records, 'ahead_behind');
  const prune = lookupRecord(records, 'prune_dry_run');
  const fsck = lookupRecord(records, 'fsck');
  const objectRisk = prune.exit_code !== 0 || fsck.exit_code !== 0 || BAD_OBJECT_PATTERN.test(`${prune.stdout}\n${fsck.stdout}\n${fsck.stderr}`);

  if (!envRepo) return fail('MISSING_REPO_ROOT', 'PROMPTOPS_REPO is empty.', branch, dirty, aheadBehind);
  if (path.resolve(envRepo) !== path.resolve(repoRoot) || path.resolve(toplevel) !== path.resolve(repoRoot)) {
    return fail('REPO_ROOT_MISMATCH', `repoRoot mismatch: env=${envRepo} top=${toplevel} expected=${repoRoot}`, branch, dirty, aheadBehind);
  }
  if (objectRisk) return fail('GIT_OBJECT_INTEGRITY', 'git prune/fsck reported integrity risk.', branch, dirty, aheadBehind);
  if (fetch.exit_code !== 0) {
    return fail(
      'REPO_ROOT_NOT_ON_MAIN_NOT_SYNCED',
      `fetch probe failed (exit=${fetch.exit_code}); cannot prove sync state.`,
      branch,
      dirty,
      aheadBehind,
    );
  }
  if (aheadBehindProbe.exit_code !== 0) {
    return fail(
      'REPO_ROOT_NOT_ON_MAIN_NOT_SYNCED',
      `ahead/behind probe failed (exit=${aheadBehindProbe.exit_code}); cannot prove sync state.`,
      branch,
      dirty,
      aheadBehind,
    );
  }
  if (branch !== 'main' || dirty || aheadBehind.behind > 0 || aheadBehind.ahead > 0) {
    return fail(
      'REPO_ROOT_NOT_ON_MAIN_NOT_SYNCED',
      `repo not ready: branch=${branch} dirty=${dirty} ahead=${aheadBehind.ahead} behind=${aheadBehind.behind}`,
      branch,
      dirty,
      aheadBehind,
    );
  }
  return { pass: true, code: 'NONE', message: 'Preflight passed.', branch, dirty, ahead: aheadBehind.ahead, behind: aheadBehind.behind };
}

function evaluatePrReadiness(
  prView: Record<string, unknown>,
  threadsPayload: Record<string, unknown>,
  unresolvedCodexAfter: number,
): { pass: boolean; code: HardStopCode; message: string } {
  const blockers: string[] = [];
  const mergeable = String(prView.mergeable ?? '');
  const mergeStateStatus = String(prView.mergeStateStatus ?? '');
  const reviewDecision = String(prView.reviewDecision ?? '');
  const state = String(prView.state ?? '');
  const checks = Array.isArray(prView.statusCheckRollup) ? prView.statusCheckRollup : [];
  const unresolvedThreads = unresolvedThreadCount(threadsPayload);

  if (state !== 'OPEN') blockers.push(`state=${state}`);
  if (mergeable !== 'MERGEABLE') blockers.push(`mergeable=${mergeable}`);
  if (mergeStateStatus && mergeStateStatus !== 'CLEAN') blockers.push(`mergeStateStatus=${mergeStateStatus}`);
  if (reviewDecision && reviewDecision !== 'APPROVED') blockers.push(`reviewDecision=${reviewDecision}`);
  for (const check of checks as Array<Record<string, unknown>>) {
    const status = String(check.status ?? check.state ?? '');
    const conclusion = String(check.conclusion ?? check.state ?? '');
    const lowered = `${status}/${conclusion}`.toLowerCase();
    if (lowered.includes('fail') || lowered.includes('pending') || lowered.includes('queued') || lowered.includes('cancel')) {
      blockers.push(`check=${String(check.name ?? check.context ?? 'unknown')}:${status}/${conclusion}`);
    }
  }
  if (unresolvedThreads > 0) blockers.push(`unresolvedThreads=${unresolvedThreads}`);
  if (unresolvedCodexAfter > 0) blockers.push(`unresolvedCodexThreads=${unresolvedCodexAfter}`);
  if (blockers.length > 0) return { pass: false, code: 'PR_NOT_READY', message: blockers.join('; ') };
  return { pass: true, code: 'NONE', message: 'PR protocol readiness checks passed.' };
}

function unresolvedCodexThreadIds(payload: Record<string, unknown>): string[] {
  const threads = getThreadNodes(payload);
  const unresolved: string[] = [];
  for (const thread of threads) {
    if (!thread || typeof thread !== 'object') continue;
    const threadId = String((thread as Record<string, unknown>).id ?? '');
    const isResolved = Boolean((thread as Record<string, unknown>).isResolved);
    const comments = ((thread as Record<string, unknown>).comments as Record<string, unknown> | undefined)?.nodes as
      | Array<Record<string, unknown>>
      | undefined;
    const hasCodex = (comments ?? []).some((node) => CODEX_AUTHOR_PATTERN.test(String((node.author as Record<string, unknown> | undefined)?.login ?? '')));
    if (hasCodex && !isResolved && threadId) unresolved.push(threadId);
  }
  return unresolved;
}

function unresolvedThreadCount(payload: Record<string, unknown>): number {
  const threads = getThreadNodes(payload);
  return threads.filter((thread) => !Boolean((thread as Record<string, unknown>).isResolved)).length;
}

function getThreadNodes(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  const data = payload.data as Record<string, unknown> | undefined;
  const repository = data?.repository as Record<string, unknown> | undefined;
  const pullRequest = repository?.pullRequest as Record<string, unknown> | undefined;
  const reviewThreads = pullRequest?.reviewThreads as Record<string, unknown> | undefined;
  const nodes = reviewThreads?.nodes as Array<Record<string, unknown>> | undefined;
  return nodes ?? [];
}

function mapRepairAction(signalId: string): { id: string; action: string } {
  if (signalId === 'DIRTY_TREE_MID_RUN') return { id: signalId, action: 'Re-run Preflight and pause run until clean.' };
  if (signalId === 'HEAD_CHANGED_UNEXPECTEDLY') return { id: signalId, action: 'Create checkpoint then reload run timeline.' };
  if (signalId === 'BEHIND_ORIGIN_MAIN') return { id: signalId, action: 'Fast-forward main and re-run gates.' };
  if (signalId === 'MISSING_SPRINT_DOCS') return { id: signalId, action: 'Create docs/sprints/S10/README.md and resync index.' };
  return { id: signalId, action: 'Reindex evidence paths and rerun closeout assistant.' };
}

function formatDiagnosis(
  signals: Array<{ id: string; active: boolean; detail: string }>,
  actions: Array<{ id: string; action: string }>,
): string {
  const lines = ['# Out-of-sync Diagnosis', ''];
  lines.push('## Signals');
  for (const signal of signals) lines.push(`- ${signal.id}: ${signal.active ? 'ACTIVE' : 'clear'} (${signal.detail})`);
  lines.push('', '## Repair Actions');
  if (!actions.length) {
    lines.push('- None required.');
  } else {
    for (const action of actions) lines.push(`- ${action.id}: ${action.action}`);
  }
  return lines.join('\n');
}

function parseStatusDirty(status: string): boolean {
  return status
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line.length > 0 && !line.startsWith('##'));
}

function parseAheadBehind(value: string): { ahead: number; behind: number } {
  const parts = value.trim().split(/\s+/);
  const ahead = Number(parts[0] ?? '0');
  const behind = Number(parts[1] ?? '0');
  return {
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
  };
}

function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function budgetBreaches(lines: string[], maxNetNewLines: number): Array<{ file: string; added: number; deleted: number; net: number }> {
  const breaches: Array<{ file: string; added: number; deleted: number; net: number }> = [];
  for (const line of lines) {
    const [addedRaw, deletedRaw, file] = line.split(/\s+/);
    const added = Number(addedRaw);
    const deleted = Number(deletedRaw);
    if (!Number.isFinite(added) || !Number.isFinite(deleted) || !file) continue;
    const net = added - deleted;
    if (net > maxNetNewLines) breaches.push({ file, added, deleted, net });
  }
  return breaches;
}

function isWhitelisted(filePath: string, whitelist: string[]): boolean {
  return whitelist.some((pattern) => globMatch(filePath, pattern));
}

function globMatch(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

function previousSprintId(sprintId: string): string {
  const match = sprintId.match(/S(\d{2})/i);
  if (!match) return 'S00';
  const n = Number(match[1]);
  const previous = Math.max(0, n - 1);
  return `S${String(previous).padStart(2, '0')}`;
}

function matchesPreviousSprint(item: { title?: unknown; headRefName?: unknown }, previous: string): boolean {
  const title = String(item.title ?? '');
  const headRef = String(item.headRefName ?? '');
  return title.startsWith(`[${previous}]`) || headRef.startsWith(`sprint/${previous}-`);
}

function parseJsonArray(value: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function lookupRecord(records: CommandRecord[], id: string): CommandRecord {
  return records.find((record) => record.id === id) ?? {
    id,
    cmd: id,
    cwd: '',
    stdout: '',
    stderr: '',
    exit_code: 1,
    start_ts: '',
    end_ts: '',
    stdout_path: '',
    stderr_path: '',
  };
}

function readRecordStdout(records: CommandRecord[], id: string): string {
  return lookupRecord(records, id).stdout;
}

function formatEval(
  title: string,
  evalInfo: { pass: boolean; code: HardStopCode; message: string },
): string {
  return [`# ${title} Evaluation`, '', `- pass: ${evalInfo.pass}`, `- code: ${evalInfo.code}`, `- message: ${evalInfo.message}`, ''].join('\n');
}

function buildResult(
  tool: string,
  code: HardStopCode,
  status: 'PASS' | 'FAIL' | 'HARD_STOP',
  message: string,
  receiptPaths: Record<string, string>,
  summary: Record<string, unknown>,
): ToolResult {
  return {
    tool,
    status,
    reasonCode: code,
    message,
    receiptPaths,
    summary,
  };
}

function fail(
  code: HardStopCode,
  message: string,
  branch: string,
  dirty: boolean,
  aheadBehind: { ahead: number; behind: number },
): {
  pass: boolean;
  code: HardStopCode;
  message: string;
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
} {
  return {
    pass: false,
    code,
    message,
    branch,
    dirty,
    ahead: aheadBehind.ahead,
    behind: aheadBehind.behind,
  };
}
