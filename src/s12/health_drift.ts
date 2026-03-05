import * as crypto from 'node:crypto';

export type HealthSeverity = 'OK' | 'WARN' | 'FAIL';

export type HealthSignalId =
  | 'REPO_DRIFT'
  | 'WORKTREE_DRIFT'
  | 'TEMPLATE_DRIFT'
  | 'LEDGER_INCONSISTENT'
  | 'RECEIPT_CORRUPTION'
  | 'ADAPTER_DOWN'
  | 'LOOP_STUCK'
  | 'SCOPE_BREACH';

export type RepairActionId =
  | 're_run_preflight_full'
  | 're_run_min_sync_check'
  | 'restore_last_checkpoint'
  | 'reindex_evidence'
  | 'rerender_ticket_no_agent'
  | 'adapter_restart'
  | 'generate_diagnosis_report';

export interface EvidenceRef {
  path: string;
  sha256: string;
}

export interface HealthSignal {
  id: string;
  signalId: HealthSignalId;
  severity: HealthSeverity;
  severityRank: number;
  detectorId: string;
  summary: string;
  evidenceRefs: EvidenceRef[];
  remediationActions: RepairActionId[];
  hardFail: boolean;
  createdAt: number;
}

export interface RepoStateSnapshot {
  branch: string;
  statusSummary: string;
  ahead: number;
  behind: number;
  headSha: string;
  repoRoot: string;
  primaryWorktree: string;
}

export interface TemplatePinSnapshot {
  sprintId: string;
  runId: string;
  pinnedVersionId: string;
  expectedTemplateHash: string;
  pinnedTemplateExists: boolean;
  pinnedTemplateHash?: string;
}

export interface LedgerSnapshot {
  requirementIds: string[];
  doneLedgerCitations: Record<string, string[]>;
  hasRequirementsUpdateEvent: boolean;
}

export interface ReceiptRecord {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  cwd: string;
  sequence?: number;
  timestamp?: string;
  artifactHash?: string;
  durablePath?: string;
}

export interface RepairAction {
  id: RepairActionId;
  title: string;
  mutatesState: boolean;
  requiresConfirmation: boolean;
  commandPlan: string[];
}

export interface LoopObservation {
  signalSet: HealthSignalId[];
  deltaFingerprint: string;
}

export interface AdapterRetryState {
  currentAgent: 'codex' | 'claude';
  secondaryAgent: 'codex' | 'claude';
  failureCount: number;
  autoSwitchEnabled: boolean;
}

export interface RetryDecision {
  action: 'retry' | 'switch_agent' | 'hard_stop';
  delaySeconds: number;
  targetAgent: 'codex' | 'claude' | null;
  reason: string;
}

export interface SafeModeInput {
  runId: string;
  activeSignals: HealthSignal[];
  lastKnownCheckpointId: string | null;
  allowedActions: RepairAction[];
  evidenceRefs: EvidenceRef[];
  agentInvocationEvents: string[];
}

export interface SafeModeDiagnosis {
  runId: string;
  status: HealthSeverity;
  activeSignals: HealthSignal[];
  lastKnownCheckpointId: string | null;
  nextAllowedActions: RepairAction[];
  evidenceRefs: EvidenceRef[];
  safeModeCompliant: boolean;
  violations: string[];
  reportCanonical: string;
  reportHash: string;
}

export interface FieldDelta {
  field: string;
  before: string;
  after: string;
}

export interface AuditFlagsInput {
  protectedOverrideUsed: boolean;
  repeatedFailures: number;
  manualAgentSwitches: number;
  scopeIncidents: number;
}

export interface DiagnosticsDashboardModel {
  status: HealthSeverity;
  activeSignals: HealthSignal[];
  actionsBySignal: Record<HealthSignalId, RepairAction[]>;
  timelineDeltas: FieldDelta[];
  auditFlags: string[];
}

const RETRY_DELAYS = [0, 30, 120] as const;

const SIGNAL_RULES: Record<HealthSignalId, { detectorId: string; hardFail: boolean; severity: HealthSeverity; actions: RepairActionId[] }> = {
  REPO_DRIFT: {
    detectorId: 'detector.repo_drift',
    hardFail: false,
    severity: 'WARN',
    actions: ['re_run_min_sync_check', 're_run_preflight_full', 'restore_last_checkpoint'],
  },
  WORKTREE_DRIFT: {
    detectorId: 'detector.worktree_drift',
    hardFail: true,
    severity: 'FAIL',
    actions: ['re_run_preflight_full', 'restore_last_checkpoint'],
  },
  TEMPLATE_DRIFT: {
    detectorId: 'detector.template_drift',
    hardFail: true,
    severity: 'FAIL',
    actions: ['reindex_evidence', 'rerender_ticket_no_agent'],
  },
  LEDGER_INCONSISTENT: {
    detectorId: 'detector.ledger_drift',
    hardFail: false,
    severity: 'FAIL',
    actions: ['restore_last_checkpoint', 'rerender_ticket_no_agent'],
  },
  RECEIPT_CORRUPTION: {
    detectorId: 'detector.receipt_integrity',
    hardFail: true,
    severity: 'FAIL',
    actions: ['reindex_evidence', 'generate_diagnosis_report'],
  },
  ADAPTER_DOWN: {
    detectorId: 'detector.adapter_health',
    hardFail: false,
    severity: 'FAIL',
    actions: ['adapter_restart', 'generate_diagnosis_report'],
  },
  LOOP_STUCK: {
    detectorId: 'detector.loop_stuck',
    hardFail: true,
    severity: 'FAIL',
    actions: ['generate_diagnosis_report'],
  },
  SCOPE_BREACH: {
    detectorId: 'detector.scope_breach',
    hardFail: true,
    severity: 'FAIL',
    actions: ['generate_diagnosis_report'],
  },
};

const REPAIR_ACTION_LIBRARY: Record<RepairActionId, RepairAction> = {
  re_run_preflight_full: {
    id: 're_run_preflight_full',
    title: 'Re-run Preflight (full)',
    mutatesState: false,
    requiresConfirmation: false,
    commandPlan: [
      'pwd',
      'echo "$PROMPTOPS_REPO"',
      'git rev-parse --show-toplevel',
      'git worktree list --porcelain',
      'git status --porcelain=v1 --branch',
      'git fetch --all --prune --tags',
      'git rev-list --left-right --count HEAD...origin/main',
      'git rev-parse --abbrev-ref HEAD',
      'git log --oneline -5',
      'git prune --dry-run',
      'git fsck --no-reflogs',
    ],
  },
  re_run_min_sync_check: {
    id: 're_run_min_sync_check',
    title: 'Re-run Minimal Sync Check',
    mutatesState: false,
    requiresConfirmation: false,
    commandPlan: ['git fetch --all --prune --tags', 'git status --porcelain=v1 --branch', 'git rev-list --left-right --count HEAD...origin/main'],
  },
  restore_last_checkpoint: {
    id: 'restore_last_checkpoint',
    title: 'Restore to Last Checkpoint',
    mutatesState: true,
    requiresConfirmation: true,
    commandPlan: ['restore from checkpoint artifact and re-evaluate health'],
  },
  reindex_evidence: {
    id: 'reindex_evidence',
    title: 'Reindex Evidence',
    mutatesState: true,
    requiresConfirmation: true,
    commandPlan: ['rebuild evidence index from durable bundle', 'verify hashes'],
  },
  rerender_ticket_no_agent: {
    id: 'rerender_ticket_no_agent',
    title: 'Re-render Ticket (no agent)',
    mutatesState: true,
    requiresConfirmation: true,
    commandPlan: ['compile ticket from pinned template + settings without invoking agent'],
  },
  adapter_restart: {
    id: 'adapter_restart',
    title: 'Adapter Restart',
    mutatesState: true,
    requiresConfirmation: true,
    commandPlan: ['restart adapter process', 'rerun adapter health probe'],
  },
  generate_diagnosis_report: {
    id: 'generate_diagnosis_report',
    title: 'Generate Diagnosis Report',
    mutatesState: false,
    requiresConfirmation: false,
    commandPlan: ['collect health signals', 'render deterministic diagnosis report'],
  },
};

export function severityRank(severity: HealthSeverity): number {
  if (severity === 'FAIL') return 2;
  if (severity === 'WARN') return 1;
  return 0;
}

export function buildEvidenceRef(path: string, payload: unknown): EvidenceRef {
  return {
    path,
    sha256: sha256Hex(stableJson(payload)),
  };
}

export function detectRepoDrift(
  previous: RepoStateSnapshot,
  current: RepoStateSnapshot,
  createdAt: number,
  evidenceRefs: EvidenceRef[],
): HealthSignal | null {
  const deltas = repoDeltas(previous, current);
  if (deltas.length === 0) return null;
  const severity = current.behind > 0 || current.ahead > 0 || isDirtyStatus(current.statusSummary) ? 'FAIL' : 'WARN';
  const summary = `repo drift detected (${deltas.map((delta) => delta.field).join(', ')})`;
  return makeSignal('REPO_DRIFT', createdAt, summary, evidenceRefs, severity, false);
}

export function detectWorktreeDrift(
  expectedPrimaryWorktree: string,
  currentPrimaryWorktree: string,
  createdAt: number,
  evidenceRefs: EvidenceRef[],
  repairRestored: boolean,
): HealthSignal | null {
  if (normalizePath(expectedPrimaryWorktree) === normalizePath(currentPrimaryWorktree)) return null;
  const hardFail = !repairRestored;
  const severity: HealthSeverity = hardFail ? 'FAIL' : 'WARN';
  const summary = `worktree drift expected=${expectedPrimaryWorktree} current=${currentPrimaryWorktree}`;
  return makeSignal('WORKTREE_DRIFT', createdAt, summary, evidenceRefs, severity, hardFail);
}

export function detectTemplateDrift(pin: TemplatePinSnapshot, createdAt: number, evidenceRefs: EvidenceRef[]): HealthSignal | null {
  const missingPinned = !pin.pinnedTemplateExists;
  const hashMismatch = Boolean(pin.pinnedTemplateHash && pin.pinnedTemplateHash !== pin.expectedTemplateHash);
  if (!missingPinned && !hashMismatch) return null;
  const reason = missingPinned
    ? `missing pinned template for run=${pin.runId}`
    : `template hash mismatch expected=${pin.expectedTemplateHash} actual=${pin.pinnedTemplateHash}`;
  return makeSignal('TEMPLATE_DRIFT', createdAt, reason, evidenceRefs, 'FAIL', true);
}

export function detectLedgerInconsistent(
  previous: LedgerSnapshot,
  current: LedgerSnapshot,
  createdAt: number,
  evidenceRefs: EvidenceRef[],
): HealthSignal | null {
  const requirementChanged = stableJson([...new Set(previous.requirementIds)].sort()) !== stableJson([...new Set(current.requirementIds)].sort());
  const missingCitations = findMissingLedgerCitations(current.doneLedgerCitations);
  if (!requirementChanged && missingCitations.length === 0) return null;
  const blockers: string[] = [];
  if (requirementChanged && !current.hasRequirementsUpdateEvent) blockers.push('requirements_changed_without_update_event');
  if (missingCitations.length > 0) blockers.push(`missing_done_citations:${missingCitations.join(',')}`);
  if (blockers.length === 0) return null;
  return makeSignal('LEDGER_INCONSISTENT', createdAt, blockers.join('; '), evidenceRefs, 'FAIL', false);
}

export function detectReceiptCorruption(
  receipts: ReceiptRecord[],
  createdAt: number,
  evidenceRefs: EvidenceRef[],
  requireDurable: boolean,
): HealthSignal | null {
  const issues: string[] = [];
  let critical = false;
  receipts.forEach((receipt, index) => {
    const prefix = `receipt[${index}]`;
    if (!receipt.command) {
      issues.push(`${prefix}.command_missing`);
      critical = true;
    }
    if (typeof receipt.stdout !== 'string' || typeof receipt.stderr !== 'string') {
      issues.push(`${prefix}.stream_missing`);
      critical = true;
    }
    if (!Number.isInteger(receipt.exitCode)) {
      issues.push(`${prefix}.exit_code_missing`);
      critical = true;
    }
    if (!receipt.cwd) {
      issues.push(`${prefix}.cwd_missing`);
      critical = true;
    }
    if (receipt.sequence == null && !receipt.timestamp) {
      issues.push(`${prefix}.sequence_or_timestamp_missing`);
      critical = true;
    }
    if (receipt.artifactHash === '') {
      issues.push(`${prefix}.artifact_hash_empty`);
      critical = true;
    }
    if (requireDurable && !receipt.durablePath) {
      issues.push(`${prefix}.durable_path_missing`);
    }
  });
  if (issues.length === 0) return null;
  return makeSignal('RECEIPT_CORRUPTION', createdAt, issues.join('; '), evidenceRefs, critical ? 'FAIL' : 'WARN', critical);
}

export function createAdapterDownSignal(
  adapter: 'codex' | 'claude',
  lastErrorType: string,
  createdAt: number,
  evidenceRefs: EvidenceRef[],
): HealthSignal {
  return makeSignal('ADAPTER_DOWN', createdAt, `${adapter} unavailable (${lastErrorType})`, evidenceRefs, 'FAIL', false);
}

export function createScopeBreachSignal(paths: string[], createdAt: number, evidenceRefs: EvidenceRef[]): HealthSignal {
  const summary = `scope breach outside whitelist: ${paths.sort().join(', ')}`;
  return makeSignal('SCOPE_BREACH', createdAt, summary, evidenceRefs, 'FAIL', true);
}

export function detectLoopStuck(
  history: LoopObservation[],
  createdAt: number,
  evidenceRefs: EvidenceRef[],
  threshold = 3,
): HealthSignal | null {
  if (!Number.isInteger(threshold) || threshold <= 0) return null;
  if (history.length < threshold) return null;
  const window = history.slice(history.length - threshold);
  const first = loopSignature(window[0]);
  const same = window.every((entry) => loopSignature(entry) === first);
  if (!same) return null;
  return makeSignal('LOOP_STUCK', createdAt, `repeated blocker pattern x${threshold}: ${first}`, evidenceRefs, 'FAIL', true);
}

export function computeRetryDecision(state: AdapterRetryState): RetryDecision {
  if (state.failureCount < RETRY_DELAYS.length) {
    return {
      action: 'retry',
      delaySeconds: RETRY_DELAYS[state.failureCount],
      targetAgent: state.currentAgent,
      reason: `retry_${state.failureCount + 1}_of_${RETRY_DELAYS.length}`,
    };
  }
  if (state.autoSwitchEnabled && state.currentAgent !== state.secondaryAgent) {
    return {
      action: 'switch_agent',
      delaySeconds: 0,
      targetAgent: state.secondaryAgent,
      reason: 'retry_exhausted_auto_switch',
    };
  }
  return {
    action: 'hard_stop',
    delaySeconds: 0,
    targetAgent: null,
    reason: 'retry_exhausted_all_agents',
  };
}

export function buildContinuityPacketHash(
  runId: string,
  fromAgent: 'codex' | 'claude',
  toAgent: 'codex' | 'claude',
  checkpointId: string,
  reason: string,
  doneLedgerIds: string[],
): string {
  return sha256Hex(
    stableJson({
      run_id: runId,
      from_agent: fromAgent,
      to_agent: toAgent,
      checkpoint_id: checkpointId,
      reason,
      done_ledger_ids: [...doneLedgerIds].sort(),
    }),
  );
}

export function actionsForSignal(signal: HealthSignalId, hasCheckpoint: boolean): RepairAction[] {
  const actionIds = SIGNAL_RULES[signal].actions.filter((action) => hasCheckpoint || action !== 'restore_last_checkpoint');
  return actionIds.map((actionId) => cloneRepairAction(REPAIR_ACTION_LIBRARY[actionId]));
}

export function allRepairActions(): RepairAction[] {
  return Object.values(REPAIR_ACTION_LIBRARY).map((action) => cloneRepairAction(action));
}

export function buildSafeModeDiagnosis(input: SafeModeInput): SafeModeDiagnosis {
  const sortedSignals = sortSignals(input.activeSignals);
  const sortedActions = sortAndCloneActions(input.allowedActions);
  const violations = input.agentInvocationEvents.length > 0 ? ['agent_invocation_detected_in_safe_mode'] : [];
  const status = deriveStatus(sortedSignals);
  const payload = {
    run_id: input.runId,
    status,
    active_signals: sortedSignals,
    last_known_checkpoint_id: input.lastKnownCheckpointId,
    next_allowed_actions: sortedActions,
    evidence_refs: sortEvidence(input.evidenceRefs),
    safe_mode_compliant: violations.length === 0,
    violations,
  };
  const reportCanonical = stableJson(payload);
  return {
    runId: input.runId,
    status,
    activeSignals: sortedSignals,
    lastKnownCheckpointId: input.lastKnownCheckpointId,
    nextAllowedActions: sortedActions,
    evidenceRefs: sortEvidence(input.evidenceRefs),
    safeModeCompliant: violations.length === 0,
    violations,
    reportCanonical,
    reportHash: sha256Hex(reportCanonical),
  };
}

export function restoreSnapshotCheckpoint<T>(checkpoint: T): T {
  return JSON.parse(JSON.stringify(checkpoint)) as T;
}

export function buildCheckpointDiff(previous: RepoStateSnapshot, next: RepoStateSnapshot): FieldDelta[] {
  return repoDeltas(previous, next);
}

export function buildAuditFlags(input: AuditFlagsInput): string[] {
  const flags: string[] = [];
  if (input.protectedOverrideUsed) flags.push('PROTECTED_TEMPLATE_OVERRIDE_USED');
  if (input.repeatedFailures > 0) flags.push(`REPEATED_FAILURES:${input.repeatedFailures}`);
  if (input.manualAgentSwitches > 0) flags.push(`MANUAL_AGENT_SWITCHES:${input.manualAgentSwitches}`);
  if (input.scopeIncidents > 0) flags.push(`SCOPE_INCIDENTS:${input.scopeIncidents}`);
  return flags;
}

export function buildDiagnosticsDashboardModel(
  signals: HealthSignal[],
  timelineDeltas: FieldDelta[],
  hasCheckpoint: boolean,
  auditInput: AuditFlagsInput,
): DiagnosticsDashboardModel {
  const activeSignals = sortSignals(signals);
  const actionsBySignal = activeSignals.reduce<Record<HealthSignalId, RepairAction[]>>((acc, signal) => {
    acc[signal.signalId] = actionsForSignal(signal.signalId, hasCheckpoint);
    return acc;
  }, {} as Record<HealthSignalId, RepairAction[]>);
  return {
    status: deriveStatus(activeSignals),
    activeSignals,
    actionsBySignal,
    timelineDeltas,
    auditFlags: buildAuditFlags(auditInput),
  };
}

export function sortSignals(signals: HealthSignal[]): HealthSignal[] {
  return [...signals].sort((a, b) => {
    if (b.severityRank !== a.severityRank) return b.severityRank - a.severityRank;
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
    return a.signalId.localeCompare(b.signalId);
  });
}

function repoDeltas(previous: RepoStateSnapshot, current: RepoStateSnapshot): FieldDelta[] {
  const fields: Array<[keyof RepoStateSnapshot, string, string]> = [
    ['branch', previous.branch, current.branch],
    ['statusSummary', previous.statusSummary, current.statusSummary],
    ['ahead', String(previous.ahead), String(current.ahead)],
    ['behind', String(previous.behind), String(current.behind)],
    ['headSha', previous.headSha, current.headSha],
    ['repoRoot', normalizePath(previous.repoRoot), normalizePath(current.repoRoot)],
    ['primaryWorktree', normalizePath(previous.primaryWorktree), normalizePath(current.primaryWorktree)],
  ];
  return fields
    .filter(([, before, after]) => before !== after)
    .map(([field, before, after]) => ({ field: String(field), before, after }));
}

function makeSignal(
  signalId: HealthSignalId,
  createdAt: number,
  summary: string,
  evidenceRefs: EvidenceRef[],
  severityOverride?: HealthSeverity,
  hardFailOverride?: boolean,
): HealthSignal {
  const rule = SIGNAL_RULES[signalId];
  const severity = severityOverride ?? rule.severity;
  const hardFail = hardFailOverride ?? rule.hardFail;
  const id = sha256Hex(stableJson({ signalId, createdAt, summary, evidenceRefs: sortEvidence(evidenceRefs) })).slice(0, 16);
  return {
    id,
    signalId,
    severity,
    severityRank: severityRank(severity),
    detectorId: rule.detectorId,
    summary,
    evidenceRefs: sortEvidence(evidenceRefs),
    remediationActions: rule.actions,
    hardFail,
    createdAt,
  };
}

function deriveStatus(signals: HealthSignal[]): HealthSeverity {
  if (signals.some((signal) => signal.severity === 'FAIL')) return 'FAIL';
  if (signals.some((signal) => signal.severity === 'WARN')) return 'WARN';
  return 'OK';
}

function isDirtyStatus(statusSummary: string): boolean {
  return statusSummary
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line.length > 0 && !line.startsWith('##'));
}

function findMissingLedgerCitations(citations: Record<string, string[]>): string[] {
  return Object.entries(citations)
    .filter(([, refs]) => !Array.isArray(refs) || refs.length === 0)
    .map(([id]) => id)
    .sort();
}

function loopSignature(item: LoopObservation): string {
  return stableJson({
    signal_set: [...item.signalSet].sort(),
    delta_fingerprint: item.deltaFingerprint,
  });
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').trim();
}

function sortEvidence(evidenceRefs: EvidenceRef[]): EvidenceRef[] {
  return [...evidenceRefs].sort((a, b) => a.path.localeCompare(b.path) || a.sha256.localeCompare(b.sha256));
}

function cloneRepairAction(action: RepairAction): RepairAction {
  return {
    ...action,
    commandPlan: [...action.commandPlan],
  };
}

function sortAndCloneActions(actions: RepairAction[]): RepairAction[] {
  return [...actions]
    .map((action) => cloneRepairAction(action))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function stableJson(value: unknown): string {
  return stringifyCanonical(value);
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

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
