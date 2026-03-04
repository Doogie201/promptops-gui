import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  executeSandboxedCommand,
  type CommandReceipt,
  type CommandRequest,
} from '../../engine/command_executor.ts';

export type ProtocolStatus = 'PASS' | 'HARD_STOP';
export type TimelineState = 'STARTED' | 'RUNNING' | 'STOPPED';
export type StageId =
  | 'INVENTORY'
  | 'READINESS'
  | 'CODEX_SCAN'
  | 'CODEX_RESOLVE'
  | 'MERGE_READY'
  | 'MERGE_ATTEMPT'
  | 'DONE';

export type ReasonCode =
  | 'NO_OPEN_PRS'
  | 'STOP_UNRELATED_OPEN_PRS'
  | 'PR_NOT_MERGE_READY'
  | 'NO_CODEX_THREADS'
  | 'CODEX_THREADS_ALREADY_RESOLVED'
  | 'NEEDS_HUMAN_UI_THREAD_RESOLUTION'
  | 'NEEDS_HUMAN_MERGE'
  | 'MERGE_EXECUTED'
  | 'MERGE_SKIPPED_NOT_APPROVED'
  | 'HARD_STOP_CANONICAL_CWD_MISMATCH'
  | 'HARD_STOP_PRIMARY_WORKTREE_NOT_ON_MAIN_NOT_SYNCED'
  | 'HARD_STOP_OBJECT_STORE_RISK'
  | 'HARD_STOP_BRANCH_NONCOMPLIANCE';

export interface TimelineEntry {
  stage: StageId;
  state: TimelineState;
  reason_code: ReasonCode;
  message: string;
  evidence_paths: string[];
}

export interface OpenPr {
  number: number;
  title: string;
  headRefName: string;
  baseRefName: string;
  url: string;
  updatedAt: string;
}

export interface ProtocolConfig {
  cwd: string;
  repo: string;
  stagingRoot: string;
  durableRoot?: string;
  baseBranch?: string;
  genericSprintRegex?: string;
  sprintRegex?: string;
  previousSprintPrefix?: string;
  canonicalRootEnv?: string;
  operatorApprovedMerge?: boolean;
  enforceMainPreflight?: boolean;
  resolveCodexThreads?: boolean;
  commandExecutor?: (req: CommandRequest) => CommandReceipt;
}

export interface ProtocolResult {
  status: ProtocolStatus;
  reason_code: ReasonCode;
  message: string;
  canonical_root: string;
  canonical_source: 'env' | 'git';
  timeline: TimelineEntry[];
  evidence: Record<string, string>;
  receipts: CommandReceipt[];
  details?: Record<string, unknown>;
}

interface RunState {
  config: Required<ProtocolConfig>;
  canonicalRoot: string;
  canonicalSource: 'env' | 'git';
  timeline: TimelineEntry[];
  evidence: Record<string, string>;
  receipts: CommandReceipt[];
  exec: (req: CommandRequest) => CommandReceipt;
}

interface ThreadNode {
  id: string;
  isResolved: boolean;
  isOutdated?: boolean;
  comments: {
    nodes: Array<{
      id: string;
      body?: string;
      author?: { login?: string | null } | null;
      createdAt?: string;
    }>;
  };
}

interface PrThreadPayload {
  data?: {
    repository?: {
      pullRequest?: {
        reviewThreads?: { nodes?: ThreadNode[] };
        comments?: {
          nodes?: Array<{
            id: string;
            body?: string;
            author?: { login?: string | null } | null;
            createdAt?: string;
          }>;
        };
      };
    };
  };
}

interface CheckIssue {
  id: string;
  value: string;
}

const DEFAULT_BASE_BRANCH = 'main';
const DEFAULT_PREVIOUS_SPRINT_PREFIX = 'S06';
const CODEX_AUTHOR_PATTERN = /(chatgpt|codex|chatgpt-codex|connector)/i;
const BAD_OBJECT_SIGNAL = /(bad sha1|badRefName|badRefContent|invalid ref|fatal:|error:)/i;

export function runOpenPrProtocol(config: ProtocolConfig): ProtocolResult {
  const resolved = resolveConfig(config);
  const canonical = resolveCanonicalRoot(resolved.cwd, resolved.canonicalRootEnv);
  const state = buildRunState(resolved, canonical.root, canonical.source);

  const cwdGuard = ensureCwdWithinCanonical(state);
  if (cwdGuard) return cwdGuard;

  const preflight = runCanonicalPreflight(state);
  if (preflight) return preflight;

  const inventory = runInventoryStage(state);
  if (inventory.stop) return inventory.stop;
  if (!inventory.candidatePr) {
    return passResult(
      state,
      'NO_OPEN_PRS',
      'No open PRs found; protocol completed with inventory-only pass.',
      { open_pr_count: 0 },
    );
  }

  const readiness = runReadinessStage(state, inventory.candidatePr.number);
  if (readiness.stop) return readiness.stop;

  const codex = runCodexStage(state, inventory.candidatePr.number);
  if (codex.stop) return codex.stop;

  pushTimeline(
    state,
    'MERGE_READY',
    'RUNNING',
    'MERGE_SKIPPED_NOT_APPROVED',
    `PR #${inventory.candidatePr.number} is merge-ready after readiness and codex gates.`,
    [state.evidence[`pr_view_${inventory.candidatePr.number}`], state.evidence[`threads_after_${inventory.candidatePr.number}`]],
  );

  const mergeResult = runMergeStage(state, inventory.candidatePr.number);
  if (mergeResult.stop) return mergeResult.stop;

  return passResult(
    state,
    mergeResult.reason,
    mergeResult.message,
    { pr_number: inventory.candidatePr.number, merge_executed: state.config.operatorApprovedMerge },
  );
}

function resolveConfig(config: ProtocolConfig): Required<ProtocolConfig> {
  const cwd = path.resolve(config.cwd);
  const stagingRoot = path.resolve(config.stagingRoot);
  const durableRoot = path.resolve(config.durableRoot ?? path.join(cwd, 'docs', 'sprints', 'S07', 'evidence'));
  const canonicalRootEnv = config.canonicalRootEnv ?? process.env.PROMPTOPS_GUI_CANONICAL_ROOT ?? '';
  const genericSprintRegex = config.genericSprintRegex ?? '^sprint/S\\d{2}-';
  const sprintRegex = config.sprintRegex ?? '^sprint/S07-';
  return {
    cwd,
    repo: config.repo,
    stagingRoot,
    durableRoot,
    baseBranch: config.baseBranch ?? DEFAULT_BASE_BRANCH,
    genericSprintRegex,
    sprintRegex,
    previousSprintPrefix: config.previousSprintPrefix ?? DEFAULT_PREVIOUS_SPRINT_PREFIX,
    canonicalRootEnv,
    operatorApprovedMerge: Boolean(config.operatorApprovedMerge),
    enforceMainPreflight: config.enforceMainPreflight ?? true,
    resolveCodexThreads: config.resolveCodexThreads ?? true,
    commandExecutor: config.commandExecutor ?? executeSandboxedCommand,
  };
}

function resolveCanonicalRoot(cwd: string, envRoot: string): { root: string; source: 'env' | 'git' } {
  if (envRoot.trim().length > 0) {
    return { root: path.resolve(envRoot), source: 'env' };
  }
  const probe = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    encoding: 'utf8',
  });
  if (probe.status !== 0) {
    throw new Error(`canonical root resolution failed: ${probe.stderr?.trim() ?? 'unknown error'}`);
  }
  return { root: path.resolve((probe.stdout ?? '').trim()), source: 'git' };
}

function buildRunState(
  config: Required<ProtocolConfig>,
  canonicalRoot: string,
  canonicalSource: 'env' | 'git',
): RunState {
  fs.mkdirSync(config.stagingRoot, { recursive: true });
  fs.mkdirSync(path.join(config.stagingRoot, 'gh'), { recursive: true });
  fs.mkdirSync(path.join(config.stagingRoot, 'codex'), { recursive: true });
  return {
    config,
    canonicalRoot,
    canonicalSource,
    timeline: [],
    evidence: {},
    receipts: [],
    exec: config.commandExecutor,
  };
}

function ensureCwdWithinCanonical(state: RunState): ProtocolResult | null {
  if (isWithin(state.config.cwd, state.canonicalRoot)) return null;
  return hardStop(
    state,
    'INVENTORY',
    'HARD_STOP_CANONICAL_CWD_MISMATCH',
    `Current cwd '${state.config.cwd}' is outside canonical root '${state.canonicalRoot}'.`,
    {},
  );
}

function runCanonicalPreflight(state: RunState): ProtocolResult | null {
  const commandMap = [
    ['pre_pwd', 'pwd', []],
    ['pre_toplevel', 'git', ['rev-parse', '--show-toplevel']],
    ['pre_common_dir', 'git', ['rev-parse', '--git-common-dir']],
    ['pre_worktree', 'git', ['worktree', 'list', '--porcelain']],
    ['pre_status', 'git', ['status', '--porcelain=v1', '--branch']],
    ['pre_fetch', 'git', ['fetch', '--all', '--prune', '--tags']],
    ['pre_ahead_behind', 'git', ['rev-list', '--left-right', '--count', `HEAD...origin/${state.config.baseBranch}`]],
    ['pre_branch', 'git', ['rev-parse', '--abbrev-ref', 'HEAD']],
    ['pre_log', 'git', ['log', '--oneline', '-5']],
    ['pre_prune', 'git', ['prune', '--dry-run']],
    ['pre_fsck', 'git', ['fsck', '--full']],
  ] as const;

  for (const [id, command, args] of commandMap) {
    runCommand(state, id, command, args, state.canonicalRoot, state.canonicalRoot);
  }

  if (hasObjectStoreRisk(state)) {
    return hardStop(
      state,
      'INVENTORY',
      'HARD_STOP_OBJECT_STORE_RISK',
      'Object-store risk detected by prune/fsck signals. Stop and remediate before GH protocol steps.',
      {},
    );
  }

  if (!state.config.enforceMainPreflight) return null;
  const branch = readStdout(state, 'pre_branch').trim();
  const statusRaw = readStdout(state, 'pre_status');
  const dirty = statusRaw
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line.length > 0 && !line.startsWith('##'));
  const behindCount = parseAheadBehind(readStdout(state, 'pre_ahead_behind')).behind;
  if (branch === state.config.baseBranch && !dirty && behindCount === 0) return null;

  return hardStop(
    state,
    'INVENTORY',
    'HARD_STOP_PRIMARY_WORKTREE_NOT_ON_MAIN_NOT_SYNCED',
    `Canonical root not ready: branch='${branch}', dirty=${dirty}, behind=${behindCount}.`,
    { branch, dirty, behind: behindCount },
  );
}

function runInventoryStage(state: RunState): { candidatePr: OpenPr | null; stop: ProtocolResult | null } {
  pushTimeline(state, 'INVENTORY', 'RUNNING', 'NO_OPEN_PRS', 'Collecting open PR inventory.', []);
  const receipt = runCommand(
    state,
    'gh_inventory',
    'gh',
    ['pr', 'list', '--repo', state.config.repo, '--state', 'open', '--json', 'number,title,headRefName,baseRefName,url,updatedAt'],
    state.canonicalRoot,
    state.canonicalRoot,
  );
  const outPath = path.join(state.config.stagingRoot, 'gh', '00_pr_list.json');
  fs.writeFileSync(outPath, receipt.stdout || '[]', 'utf8');
  state.evidence.gh_inventory_json = outPath;
  const prs = parseJsonArray<OpenPr>(receipt.stdout);

  if (prs.length === 0) {
    pushTimeline(state, 'INVENTORY', 'STOPPED', 'NO_OPEN_PRS', 'No open PRs detected.', [outPath]);
    return { candidatePr: null, stop: null };
  }

  const previous = prs.filter((pr) => isPreviousSprintPr(pr, state.config.previousSprintPrefix));
  if (prs.length === 1 && previous.length === 1) {
    return { candidatePr: previous[0], stop: null };
  }

  const stop = hardStop(
    state,
    'INVENTORY',
    'STOP_UNRELATED_OPEN_PRS',
    `Unrelated open PRs detected (${prs.length}).`,
    { prs },
  );
  return { candidatePr: null, stop };
}

function runReadinessStage(state: RunState, prNumber: number): { stop: ProtocolResult | null } {
  pushTimeline(state, 'READINESS', 'RUNNING', 'PR_NOT_MERGE_READY', `Evaluating merge readiness for PR #${prNumber}.`, []);
  runCommand(
    state,
    `pr_view_${prNumber}`,
    'gh',
    [
      'pr',
      'view',
      String(prNumber),
      '--repo',
      state.config.repo,
      '--json',
      'number,title,headRefName,baseRefName,state,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,labels,body,url,comments',
    ],
    state.canonicalRoot,
    state.canonicalRoot,
  );

  const threads = queryThreads(state, prNumber, `threads_before_${prNumber}`);
  const prView = parseJsonObject(readStdout(state, `pr_view_${prNumber}`));
  const issues = evaluateReadinessIssues(prView, threads);
  if (issues.length === 0) return { stop: null };

  return {
    stop: hardStop(
      state,
      'READINESS',
      'PR_NOT_MERGE_READY',
      `PR #${prNumber} is not merge-ready.`,
      { failing_conditions: issues },
    ),
  };
}

function runCodexStage(state: RunState, prNumber: number): { stop: ProtocolResult | null } {
  pushTimeline(state, 'CODEX_SCAN', 'RUNNING', 'NO_CODEX_THREADS', `Scanning codex threads for PR #${prNumber}.`, []);
  const before = queryThreads(state, prNumber, `threads_before_${prNumber}`);
  const codex = codexUnresolvedThreadIds(before);
  const codexEvidence = state.evidence[`threads_before_${prNumber}`];

  if (codex.allCodexCommentsCount === 0) {
    pushTimeline(state, 'CODEX_SCAN', 'STOPPED', 'NO_CODEX_THREADS', 'No codex comments/threads detected.', [codexEvidence]);
    return { stop: null };
  }
  if (codex.unresolvedIds.length === 0) {
    pushTimeline(
      state,
      'CODEX_SCAN',
      'STOPPED',
      'CODEX_THREADS_ALREADY_RESOLVED',
      'Codex threads are already resolved.',
      [codexEvidence],
    );
    return { stop: null };
  }
  if (!state.config.resolveCodexThreads) {
    return {
      stop: hardStop(
        state,
        'CODEX_RESOLVE',
        'NEEDS_HUMAN_UI_THREAD_RESOLUTION',
        `Codex unresolved threads require UI/manual resolution: ${codex.unresolvedIds.join(', ')}`,
        { thread_ids: codex.unresolvedIds },
      ),
    };
  }

  pushTimeline(state, 'CODEX_RESOLVE', 'RUNNING', 'NEEDS_HUMAN_UI_THREAD_RESOLUTION', 'Resolving codex threads via GraphQL.', [codexEvidence]);
  for (const threadId of codex.unresolvedIds) {
    const queryPath = writeGraphqlMutation(state, threadId);
    runCommand(
      state,
      `resolve_${threadId}`,
      'gh',
      ['api', 'graphql', '-F', `query=@${queryPath}`],
      state.canonicalRoot,
      state.canonicalRoot,
    );
  }
  const after = queryThreads(state, prNumber, `threads_after_${prNumber}`);
  const remaining = codexUnresolvedThreadIds(after).unresolvedIds;
  if (remaining.length === 0) return { stop: null };

  return {
    stop: hardStop(
      state,
      'CODEX_RESOLVE',
      'NEEDS_HUMAN_UI_THREAD_RESOLUTION',
      `Unable to resolve all codex threads automatically: ${remaining.join(', ')}`,
      { unresolved_thread_ids: remaining },
    ),
  };
}

function runMergeStage(state: RunState, prNumber: number): { stop: ProtocolResult | null; reason: ReasonCode; message: string } {
  pushTimeline(state, 'MERGE_ATTEMPT', 'RUNNING', 'MERGE_SKIPPED_NOT_APPROVED', `Merge stage reached for PR #${prNumber}.`, []);
  if (!state.config.operatorApprovedMerge) {
    pushTimeline(
      state,
      'MERGE_ATTEMPT',
      'STOPPED',
      'MERGE_SKIPPED_NOT_APPROVED',
      'Merge is disabled by configuration (operatorApprovedMerge=false).',
      [],
    );
    return { stop: null, reason: 'MERGE_SKIPPED_NOT_APPROVED', message: 'Protocol completed without merge attempt.' };
  }

  const mergeReceipt = runCommand(
    state,
    `merge_${prNumber}`,
    'gh',
    ['pr', 'merge', String(prNumber), '--repo', state.config.repo, '--squash', '--delete-branch'],
    state.canonicalRoot,
    state.canonicalRoot,
  );
  if (mergeReceipt.exit_code !== 0) {
    return {
      stop: hardStop(
        state,
        'MERGE_ATTEMPT',
        'NEEDS_HUMAN_MERGE',
        `Merge attempt failed for PR #${prNumber}.`,
        { stderr: mergeReceipt.stderr },
      ),
      reason: 'NEEDS_HUMAN_MERGE',
      message: 'Merge failed.',
    };
  }

  runCommand(
    state,
    `merge_state_${prNumber}`,
    'gh',
    ['pr', 'view', String(prNumber), '--repo', state.config.repo, '--json', 'state,mergedAt,closedAt,url'],
    state.canonicalRoot,
    state.canonicalRoot,
  );
  pushTimeline(state, 'MERGE_ATTEMPT', 'STOPPED', 'MERGE_EXECUTED', `PR #${prNumber} merge executed successfully.`, [
    state.evidence[`merge_${prNumber}`],
    state.evidence[`merge_state_${prNumber}`],
  ]);
  return { stop: null, reason: 'MERGE_EXECUTED', message: 'Protocol completed with merge execution.' };
}

function queryThreads(state: RunState, prNumber: number, id: string): PrThreadPayload {
  const queryPath = writeGraphqlThreadQuery(state);
  const receipt = runCommand(
    state,
    id,
    'gh',
    [
      'api',
      'graphql',
      '-F',
      `query=@${queryPath}`,
      '-F',
      `owner=${ownerFromRepo(state.config.repo)}`,
      '-F',
      `name=${nameFromRepo(state.config.repo)}`,
      '-F',
      `number=${prNumber}`,
    ],
    state.canonicalRoot,
    state.canonicalRoot,
  );
  const outPath = path.join(state.config.stagingRoot, 'codex', `${id}.json`);
  fs.writeFileSync(outPath, receipt.stdout || '{}', 'utf8');
  state.evidence[id] = outPath;
  return parseJsonObject(receipt.stdout) as PrThreadPayload;
}

function evaluateReadinessIssues(prView: Record<string, unknown>, threads: PrThreadPayload): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const mergeable = String(prView.mergeable ?? '');
  const mergeStateStatus = String(prView.mergeStateStatus ?? '');
  const reviewDecision = String(prView.reviewDecision ?? '');
  if (mergeable !== 'MERGEABLE') issues.push({ id: 'mergeable', value: mergeable || 'UNKNOWN' });
  if (mergeStateStatus !== 'CLEAN') issues.push({ id: 'mergeStateStatus', value: mergeStateStatus || 'UNKNOWN' });
  if (!(reviewDecision === 'APPROVED' || (reviewDecision.length === 0 && mergeStateStatus === 'CLEAN'))) {
    issues.push({ id: 'reviewDecision', value: reviewDecision || 'EMPTY' });
  }

  const checks = Array.isArray(prView.statusCheckRollup) ? prView.statusCheckRollup : [];
  for (const item of checks as Array<Record<string, unknown>>) {
    const name = String(item.name ?? item.context ?? 'unknown');
    const status = String(item.status ?? item.state ?? '');
    const conclusion = String(item.conclusion ?? item.state ?? '');
    if (status === 'COMPLETED' || status === 'SUCCESS') {
      if (conclusion !== 'SUCCESS' && conclusion !== 'SUCCESSFUL' && conclusion !== 'success') {
        issues.push({ id: `check:${name}`, value: `${status}/${conclusion}` });
      }
      continue;
    }
    if (status === 'SUCCESS') continue;
    if (conclusion.toLowerCase() === 'success') continue;
    issues.push({ id: `check:${name}`, value: `${status}/${conclusion}` });
  }

  const unresolved = (threads.data?.repository?.pullRequest?.reviewThreads?.nodes ?? []).filter((n) => !n.isResolved);
  const unresolvedNonCodex = unresolved.filter((thread) => !threadHasCodexAuthor(thread));
  if (unresolvedNonCodex.length > 0) {
    issues.push({ id: 'unresolved_non_codex_review_threads', value: String(unresolvedNonCodex.length) });
  }
  return issues;
}

function codexUnresolvedThreadIds(payload: PrThreadPayload): { unresolvedIds: string[]; allCodexCommentsCount: number } {
  const threads = payload.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];
  const prComments = payload.data?.repository?.pullRequest?.comments?.nodes ?? [];
  const unresolvedIds: string[] = [];
  let codexComments = 0;

  for (const thread of threads) {
    const hasCodexAuthor = threadHasCodexAuthor(thread);
    if (!hasCodexAuthor) continue;
    codexComments += thread.comments.nodes.length;
    if (!thread.isResolved) unresolvedIds.push(thread.id);
  }
  codexComments += prComments.filter((node) => isCodexAuthor(node.author?.login)).length;
  return { unresolvedIds, allCodexCommentsCount: codexComments };
}

function threadHasCodexAuthor(thread: ThreadNode): boolean {
  return thread.comments.nodes.some((node) => isCodexAuthor(node.author?.login));
}

function writeGraphqlThreadQuery(state: RunState): string {
  const queryPath = path.join(state.config.stagingRoot, 'codex', 'threads_query.graphql');
  const query = [
    'query($owner:String!,$name:String!,$number:Int!){',
    '  repository(owner:$owner,name:$name){',
    '    pullRequest(number:$number){',
    '      reviewThreads(first:100){',
    '        nodes{',
    '          id',
    '          isResolved',
    '          isOutdated',
    '          comments(first:100){ nodes{ id body author{login} createdAt } }',
    '        }',
    '      }',
    '      comments(first:100){ nodes{ id body author{login} createdAt } }',
    '    }',
    '  }',
    '}',
  ].join('\n');
  fs.writeFileSync(queryPath, query, 'utf8');
  return queryPath;
}

function writeGraphqlMutation(state: RunState, threadId: string): string {
  const mutationPath = path.join(state.config.stagingRoot, 'codex', `resolve_${threadId}.graphql`);
  const mutation = [
    'mutation($threadId:ID!){',
    '  resolveReviewThread(input:{threadId:$threadId}){',
    '    thread{ id isResolved }',
    '  }',
    '}',
  ].join('\n');
  fs.writeFileSync(mutationPath, mutation, 'utf8');
  return writeMutationWrapper(state, mutationPath, threadId);
}

function writeMutationWrapper(state: RunState, mutationPath: string, threadId: string): string {
  const wrapperPath = path.join(state.config.stagingRoot, 'codex', `resolve_${threadId}.query.graphql`);
  const wrapper = `mutation{ resolveReviewThread(input:{threadId:"${threadId}"}){ thread{ id isResolved } } }`;
  fs.writeFileSync(wrapperPath, wrapper, 'utf8');
  return wrapperPath;
}

function runCommand(
  state: RunState,
  id: string,
  command: string,
  args: string[],
  cwd: string,
  repoRoot: string,
): CommandReceipt {
  const request: CommandRequest = {
    command,
    args,
    cwd,
    repoRoot,
    receiptDir: path.join(state.config.stagingRoot, 'receipts'),
    allowedRoots: [state.canonicalRoot, state.config.stagingRoot, state.config.durableRoot, '/tmp/promptops/S07'],
  };
  const receipt = state.exec(request);
  state.receipts.push(receipt);
  const outPath = path.join(state.config.stagingRoot, 'gh', `${id}.receipt.json`);
  fs.writeFileSync(outPath, JSON.stringify(receipt, null, 2), 'utf8');
  state.evidence[id] = outPath;
  return receipt;
}

function hasObjectStoreRisk(state: RunState): boolean {
  const prune = readStdout(state, 'pre_prune');
  const fsck = readStdout(state, 'pre_fsck');
  const pruneExit = readExitCode(state, 'pre_prune');
  const fsckExit = readExitCode(state, 'pre_fsck');
  return pruneExit !== 0 || fsckExit !== 0 || BAD_OBJECT_SIGNAL.test(`${prune}\n${fsck}`);
}

function readStdout(state: RunState, id: string): string {
  const file = state.evidence[id];
  if (!file) return '';
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as CommandReceipt;
    return json.stdout ?? '';
  } catch {
    return '';
  }
}

function readExitCode(state: RunState, id: string): number {
  const file = state.evidence[id];
  if (!file) return 1;
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as CommandReceipt;
    return json.exit_code;
  } catch {
    return 1;
  }
}

function parseAheadBehind(value: string): { ahead: number; behind: number } {
  const [ahead, behind] = value
    .trim()
    .split(/\s+/)
    .map((item) => Number.parseInt(item, 10) || 0);
  return { ahead, behind };
}

function ownerFromRepo(repo: string): string {
  return repo.split('/')[0] ?? '';
}

function nameFromRepo(repo: string): string {
  return repo.split('/')[1] ?? '';
}

function isPreviousSprintPr(pr: OpenPr, sprintPrefix: string): boolean {
  return pr.title.startsWith(`[${sprintPrefix}]`) || pr.headRefName.startsWith(`sprint/${sprintPrefix}-`);
}

function isCodexAuthor(login: string | null | undefined): boolean {
  if (!login) return false;
  return CODEX_AUTHOR_PATTERN.test(login);
}

function parseJsonArray<T>(input: string): T[] {
  try {
    const parsed = JSON.parse(input || '[]');
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(input: string): Record<string, unknown> {
  try {
    return (JSON.parse(input || '{}') as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

function passResult(
  state: RunState,
  reason: ReasonCode,
  message: string,
  details: Record<string, unknown>,
): ProtocolResult {
  pushTimeline(state, 'DONE', 'STOPPED', reason, message, []);
  return {
    status: 'PASS',
    reason_code: reason,
    message,
    canonical_root: state.canonicalRoot,
    canonical_source: state.canonicalSource,
    timeline: state.timeline,
    evidence: state.evidence,
    receipts: state.receipts,
    details,
  };
}

function hardStop(
  state: RunState,
  stage: StageId,
  reason: ReasonCode,
  message: string,
  details: Record<string, unknown>,
): ProtocolResult {
  pushTimeline(state, stage, 'STOPPED', reason, message, []);
  return {
    status: 'HARD_STOP',
    reason_code: reason,
    message,
    canonical_root: state.canonicalRoot,
    canonical_source: state.canonicalSource,
    timeline: state.timeline,
    evidence: state.evidence,
    receipts: state.receipts,
    details,
  };
}

function pushTimeline(
  state: RunState,
  stage: StageId,
  timelineState: TimelineState,
  reason: ReasonCode,
  message: string,
  evidencePaths: Array<string | undefined>,
): void {
  state.timeline.push({
    stage,
    state: timelineState,
    reason_code: reason,
    message,
    evidence_paths: evidencePaths.filter((item): item is string => Boolean(item)),
  });
}

function isWithin(candidate: string, root: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  return rel.length === 0 || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
