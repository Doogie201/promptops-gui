export type ScreenId =
  | 'home'
  | 'run'
  | 'history'
  | 'evidence'
  | 'templates'
  | 'agents'
  | 'settings'
  | 'diagnostics';

export const SHELL_SCREENS: ScreenId[] = [
  'home',
  'run',
  'history',
  'evidence',
  'templates',
  'agents',
  'settings',
  'diagnostics',
];

export type AdapterName = 'codex' | 'claude';
export type RunStatus = 'idle' | 'running' | 'paused' | 'cancelled' | 'completed';
export type RunPhase = 'wizard' | 'intake' | 'agent_invocation' | 'switching' | 'evidence';
export type AutoSwitchTrigger = 'exhausted' | 'retry_exceeded' | 'approval_required';

export interface VersionedPin {
  id: string;
  version: string;
  edits: string[];
  updated_at: string;
}

export interface WizardRepoConfig {
  owner: string;
  name: string;
  baseBranch: string;
  rootStrategy: 'env:PROMPTOPS_REPO' | 'runtime:git-toplevel';
}

export interface WizardPolicyConfig {
  whitelist: string[];
  budgets: Record<string, string | number>;
  autoSwitch: boolean;
  manualSwitch: boolean;
  agentOrder: [AdapterName, AdapterName];
}

export interface WizardConfig {
  repo: WizardRepoConfig;
  policy: WizardPolicyConfig;
  templatePin: VersionedPin | null;
  taskPin: VersionedPin | null;
}

export interface ParsedSprintRequirements {
  sprintId: string | null;
  placeholders: string[];
}

export interface WizardState {
  config: WizardConfig;
  sprintRequirementsRaw: string;
  parsedRequirements: ParsedSprintRequirements;
  sprintPlaceholderValues: Record<string, string>;
  sprintPromptShown: boolean;
}

export interface WizardEvaluation {
  missingPersistentFields: string[];
  sprintScopedPlaceholders: string[];
  promptRequired: boolean;
  readyForRun: boolean;
}

export interface RouteState {
  screen: ScreenId;
  runId: string | null;
  key: string;
}

export interface AdapterHealth {
  installed: boolean;
  available: boolean;
  lastExitCode: number | null;
  lastErrorType: string | null;
}

export interface TimelineEvent {
  eventId: string;
  status: RunStatus;
  phase: RunPhase;
  reason: string;
  at: string;
}

export interface ContinuityCheckpoint {
  checkpointId: string;
  continuitySha256: string;
  nextAgentFirstMessage: string;
  createdAt: string;
  reason: string;
  fromAgent: AdapterName;
  toAgent: AdapterName;
}

export interface RunSession {
  runId: string;
  status: RunStatus;
  phase: RunPhase;
  currentAgent: AdapterName;
  outstandingDeltaIds: string[];
  doneLedgerIds: string[];
  continuityHash: string | null;
  lastCheckpointId: string | null;
  waitingReason: string | null;
  safeMode: boolean;
  autoSwitchEnabled: boolean;
  manualSwitchEnabled: boolean;
  lastAutoSwitchReason: string | null;
  adapterHealth: Record<AdapterName, AdapterHealth>;
  adapterSequence: AdapterName[];
  checkpoints: ContinuityCheckpoint[];
  timeline: TimelineEvent[];
}

export interface ShellState {
  route: RouteState;
  backStack: RouteState[];
  forwardStack: RouteState[];
  wizard: WizardState;
  run: RunSession | null;
}

export interface EvidenceReceipt {
  id: string;
  command: string;
  exitCode: number;
  cwd: string;
  stdoutPath: string;
  stderrPath: string;
  durablePath?: string;
}

export interface EvidenceRow {
  id: string;
  label: string;
  exitCode: number;
  command: string;
  openRawPath: string;
  durablePath: string | null;
}
