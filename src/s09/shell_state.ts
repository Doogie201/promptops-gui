import * as crypto from 'node:crypto';
import { buildNextAgentFirstMessage, canonicalJson } from '../s08/continuity_packet.ts';
import { evaluateWizard, isSprintScopedPlaceholder } from './setup_wizard.ts';
import type {
  AdapterName,
  AdapterHealth,
  AutoSwitchTrigger,
  ContinuityCheckpoint,
  RouteState,
  RunPhase,
  RunSession,
  ShellState,
  ScreenId,
  TimelineEvent,
  WizardState,
} from './types.ts';
import { SHELL_SCREENS } from './types.ts';

export function createShellState(wizard: WizardState): ShellState {
  return {
    route: makeRoute('home', null),
    backStack: [],
    forwardStack: [],
    wizard,
    run: null,
  };
}

export function buildNavigationSkeleton(state: ShellState): Array<{ id: ScreenId; active: boolean; label: string }> {
  return SHELL_SCREENS.map((id) => ({ id, active: state.route.screen === id, label: id.toUpperCase() }));
}

export function navigateTo(state: ShellState, screen: ScreenId, runId: string | null = null): ShellState {
  const next = makeRoute(screen, runId);
  if (next.key === state.route.key) return state;
  return {
    ...state,
    backStack: [...state.backStack, state.route],
    forwardStack: [],
    route: next,
  };
}

export function goBack(state: ShellState): ShellState {
  if (!state.backStack.length) return state;
  const previous = state.backStack[state.backStack.length - 1];
  return {
    ...state,
    route: previous,
    backStack: state.backStack.slice(0, -1),
    forwardStack: [state.route, ...state.forwardStack],
  };
}

export function goForward(state: ShellState): ShellState {
  if (!state.forwardStack.length) return state;
  const [next, ...rest] = state.forwardStack;
  return {
    ...state,
    route: next,
    backStack: [...state.backStack, state.route],
    forwardStack: rest,
  };
}

export function startRun(state: ShellState, nowIso: string): ShellState {
  const wizardEval = evaluateWizard(state.wizard);
  if (!wizardEval.readyForRun) {
    const blocked = createBlockedRun(state, 'Wizard prerequisites incomplete', nowIso);
    return { ...state, run: blocked, route: makeRoute('run', blocked.runId) };
  }

  const primary = state.wizard.config.policy.agentOrder[0];
  const run = createRunningRun(state.wizard, primary, nowIso);
  return {
    ...state,
    run,
    route: makeRoute('run', run.runId),
    backStack: [...state.backStack, state.route],
    forwardStack: [],
  };
}

export function pauseRun(state: ShellState, reason: string, nowIso: string): ShellState {
  return updateRun(state, 'paused', 'agent_invocation', reason, nowIso);
}

export function resumeRun(state: ShellState, nowIso: string): ShellState {
  return updateRun(state, 'running', 'agent_invocation', null, nowIso);
}

export function cancelRun(state: ShellState, reason: string, nowIso: string): ShellState {
  return updateRun(state, 'cancelled', 'evidence', reason, nowIso);
}

export function setSafeMode(state: ShellState, enabled: boolean, nowIso: string): ShellState {
  if (!state.run) return state;
  const nextPhase: RunPhase = enabled ? 'evidence' : state.run.phase;
  const event = makeEvent(state.run.timeline.length + 1, enabled ? 'paused' : state.run.status, nextPhase, 'safe_mode_toggled', nowIso);
  return {
    ...state,
    run: {
      ...state.run,
      safeMode: enabled,
      phase: nextPhase,
      waitingReason: enabled ? 'Safe Mode: diagnostics-only' : state.run.waitingReason,
      timeline: [...state.run.timeline, event],
    },
  };
}

export function manualSwitchAgent(state: ShellState, toAgent: AdapterName, reason: string, nowIso: string): ShellState {
  if (!state.run || !state.run.manualSwitchEnabled || state.run.safeMode) return state;
  if (state.run.currentAgent === toAgent) return state;
  const checkpoint = createCheckpoint(state.run, toAgent, reason, nowIso);
  const event = makeEvent(state.run.timeline.length + 1, 'running', 'switching', reason, nowIso);
  return {
    ...state,
    run: {
      ...state.run,
      currentAgent: toAgent,
      phase: 'agent_invocation',
      status: 'running',
      continuityHash: checkpoint.continuitySha256,
      lastCheckpointId: checkpoint.checkpointId,
      waitingReason: null,
      checkpoints: [...state.run.checkpoints, checkpoint],
      adapterSequence: appendSequence(state.run.adapterSequence, toAgent),
      timeline: [...state.run.timeline, event],
    },
  };
}

export function autoSwitchAgent(state: ShellState, trigger: AutoSwitchTrigger, nowIso: string): ShellState {
  if (!state.run || !state.run.autoSwitchEnabled || state.run.safeMode) return state;
  const target = state.run.currentAgent === 'codex' ? 'claude' : 'codex';
  const reason = autoSwitchReason(trigger);
  const checkpoint = createCheckpoint(state.run, target, reason, nowIso);
  const event = makeEvent(state.run.timeline.length + 1, 'running', 'switching', reason, nowIso);
  return {
    ...state,
    run: {
      ...state.run,
      currentAgent: target,
      status: 'running',
      phase: 'agent_invocation',
      continuityHash: checkpoint.continuitySha256,
      lastCheckpointId: checkpoint.checkpointId,
      lastAutoSwitchReason: reason,
      checkpoints: [...state.run.checkpoints, checkpoint],
      adapterSequence: appendSequence(state.run.adapterSequence, target),
      timeline: [...state.run.timeline, event],
    },
  };
}

export function setAgentHealth(
  state: ShellState,
  adapter: AdapterName,
  lastExitCode: number,
  lastErrorType: string | null,
): ShellState {
  if (!state.run) return state;
  const current = state.run.adapterHealth[adapter];
  const next: AdapterHealth = {
    ...current,
    installed: true,
    available: lastErrorType == null,
    lastExitCode,
    lastErrorType,
  };
  return {
    ...state,
    run: {
      ...state.run,
      adapterHealth: {
        ...state.run.adapterHealth,
        [adapter]: next,
      },
    },
  };
}

export function buildResumePayload(state: ShellState): Record<string, unknown> {
  if (!state.run) return { ready: false };
  return {
    run_id: state.run.runId,
    checkpoint_id: state.run.lastCheckpointId,
    continuity_sha256: state.run.continuityHash,
    current_agent: state.run.currentAgent,
    adapter_sequence: [...state.run.adapterSequence],
    outstanding_delta_ids: [...state.run.outstandingDeltaIds],
    no_rework: 'do not redo evidenced work; close only listed deltas',
    sprint_id: state.wizard.parsedRequirements.sprintId,
  };
}

export function operatorConsolePanels(): Record<ScreenId, string> {
  return {
    home: 'Operator home: sprint context, branch, and guardrails.',
    run: 'Run controls: Start/Pause/Resume/Cancel/Safe Mode and active phase.',
    history: 'Run history: immutable event timeline and checkpoints.',
    evidence: 'Evidence viewer: receipts with command + exit code + raw output links.',
    templates: 'Template/task pinning and versioned policy edits.',
    agents: 'Agent order, auto/manual switch, and health indicators.',
    settings: 'Repository defaults, budgets, whitelist, and root resolution strategy.',
    diagnostics: 'Preflight status, integrity checks, and troubleshooting traces.',
  };
}

function createRunningRun(wizard: WizardState, primary: AdapterName, nowIso: string): RunSession {
  const sprint = (wizard.parsedRequirements.sprintId ?? 'SXX').replace(/[^A-Za-z0-9_-]/g, '-');
  const runId = `run-${sprint.toLowerCase()}-001`;
  return {
    runId,
    status: 'running',
    phase: 'agent_invocation',
    currentAgent: primary,
    outstandingDeltaIds: wizard.parsedRequirements.placeholders.filter(isSprintScopedPlaceholder),
    doneLedgerIds: [],
    continuityHash: null,
    lastCheckpointId: null,
    waitingReason: null,
    safeMode: false,
    autoSwitchEnabled: wizard.config.policy.autoSwitch,
    manualSwitchEnabled: wizard.config.policy.manualSwitch,
    lastAutoSwitchReason: null,
    adapterHealth: {
      codex: { installed: true, available: true, lastExitCode: null, lastErrorType: null },
      claude: { installed: true, available: true, lastExitCode: null, lastErrorType: null },
    },
    adapterSequence: [primary],
    checkpoints: [],
    timeline: [makeEvent(1, 'running', 'agent_invocation', 'run_started', nowIso)],
  };
}

function createBlockedRun(state: ShellState, reason: string, nowIso: string): RunSession {
  return {
    runId: `run-blocked-${(state.wizard.parsedRequirements.sprintId ?? 'sxx').toLowerCase()}`,
    status: 'paused',
    phase: 'wizard',
    currentAgent: state.wizard.config.policy.agentOrder[0],
    outstandingDeltaIds: [],
    doneLedgerIds: [],
    continuityHash: null,
    lastCheckpointId: null,
    waitingReason: reason,
    safeMode: false,
    autoSwitchEnabled: state.wizard.config.policy.autoSwitch,
    manualSwitchEnabled: state.wizard.config.policy.manualSwitch,
    lastAutoSwitchReason: null,
    adapterHealth: {
      codex: { installed: true, available: true, lastExitCode: null, lastErrorType: null },
      claude: { installed: true, available: true, lastExitCode: null, lastErrorType: null },
    },
    adapterSequence: [state.wizard.config.policy.agentOrder[0]],
    checkpoints: [],
    timeline: [makeEvent(1, 'paused', 'wizard', reason, nowIso)],
  };
}

function updateRun(
  state: ShellState,
  status: RunSession['status'],
  phase: RunPhase,
  waitingReason: string | null,
  nowIso: string,
): ShellState {
  if (!state.run) return state;
  const event = makeEvent(state.run.timeline.length + 1, status, phase, waitingReason ?? 'state_transition', nowIso);
  return {
    ...state,
    run: {
      ...state.run,
      status,
      phase,
      waitingReason,
      timeline: [...state.run.timeline, event],
    },
  };
}

function createCheckpoint(run: RunSession, toAgent: AdapterName, reason: string, nowIso: string): ContinuityCheckpoint {
  const checkpointId = `checkpoint-${String(run.checkpoints.length + 1).padStart(2, '0')}`;
  const payload = {
    run_id: run.runId,
    checkpoint_id: checkpointId,
    from_agent: run.currentAgent,
    to_agent: toAgent,
    reason,
    sequence: run.adapterSequence,
    outstanding_delta_ids: run.outstandingDeltaIds,
    done_ledger_ids: run.doneLedgerIds,
    created_at: nowIso,
  };
  const hash = crypto.createHash('sha256').update(canonicalJson(payload)).digest('hex');
  return {
    checkpointId,
    continuitySha256: hash,
    nextAgentFirstMessage: buildNextAgentFirstMessage(hash, run.outstandingDeltaIds),
    createdAt: nowIso,
    reason,
    fromAgent: run.currentAgent,
    toAgent,
  };
}

function autoSwitchReason(trigger: AutoSwitchTrigger): string {
  if (trigger === 'exhausted') return 'AUTO_SWITCH_EXHAUSTED';
  if (trigger === 'retry_exceeded') return 'AUTO_SWITCH_RETRY_EXCEEDED';
  return 'AUTO_SWITCH_APPROVAL_BLOCKED';
}

function makeRoute(screen: ScreenId, runId: string | null): RouteState {
  const suffix = runId ? `/${runId}` : '';
  return { screen, runId, key: `${screen}${suffix}` };
}

function makeEvent(index: number, status: RunSession['status'], phase: RunPhase, reason: string, at: string): TimelineEvent {
  return {
    eventId: `evt-${String(index).padStart(3, '0')}`,
    status,
    phase,
    reason,
    at,
  };
}

function appendSequence(sequence: AdapterName[], next: AdapterName): AdapterName[] {
  if (sequence[sequence.length - 1] === next) return sequence;
  return [...sequence, next];
}
