/**
 * S14.A — Deterministic Event-to-Narration Mapper
 *
 * Pure function: renderNarration(events, settings) produces byte-identical
 * output for the same inputs. No Date.now(), no Math.random(), no env variance.
 *
 * View-layer only: narration never mutates decision state.
 */

// ── Event types consumed by narration ─────────────────────────

export type NarrationPhase =
  | 'preflight'
  | 'intake'
  | 'agent_invocation'
  | 'switching'
  | 'evidence'
  | 'gates'
  | 'closeout'
  | 'idle';

export type NarrationEventType =
  | 'phase_start'
  | 'phase_end'
  | 'checkpoint'
  | 'evidence_collected'
  | 'agent_switch_auto'
  | 'agent_switch_manual'
  | 'health_signal'
  | 'repair_action'
  | 'gate_pass'
  | 'gate_fail'
  | 'hard_stop'
  | 'run_complete';

export interface NarrationEvent {
  seq: number;
  phase: NarrationPhase;
  type: NarrationEventType;
  agent?: string;
  detail?: string;
  evidenceCount?: number;
  checkpointId?: string;
  signalId?: string;
  severity?: string;
  reason?: string;
}

// ── Settings ──────────────────────────────────────────────────

export interface NarrationSettings {
  verbosity: 'quiet' | 'verbose';
  tone: 'operator' | 'casual';
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: NarrationSettings = {
  verbosity: 'verbose',
  tone: 'operator',
  reducedMotion: false,
};

// ── Phrase library ────────────────────────────────────────────

type PhraseKey = `${NarrationPhase}:${NarrationEventType}`;
type PhraseSet = { operator: string; casual: string; quiet: string };

const PHRASES: Record<string, PhraseSet> = {
  'preflight:phase_start': {
    operator: 'Preflight checks initiated.',
    casual: 'Running preflight.',
    quiet: 'Preflight.',
  },
  'preflight:phase_end': {
    operator: 'Preflight complete. All systems nominal.',
    casual: 'Preflight done.',
    quiet: 'OK.',
  },
  'intake:phase_start': {
    operator: 'Intake phase: ingesting sprint requirements.',
    casual: 'Reading requirements.',
    quiet: 'Intake.',
  },
  'intake:phase_end': {
    operator: 'Intake complete. Requirements locked.',
    casual: 'Requirements ready.',
    quiet: 'OK.',
  },
  'agent_invocation:phase_start': {
    operator: 'Agent invocation: dispatching to active adapter.',
    casual: 'Calling the agent.',
    quiet: 'Agent.',
  },
  'agent_invocation:phase_end': {
    operator: 'Agent invocation cycle complete.',
    casual: 'Agent done.',
    quiet: 'OK.',
  },
  'switching:phase_start': {
    operator: 'Agent switching sequence initiated.',
    casual: 'Switching agents.',
    quiet: 'Switch.',
  },
  'switching:phase_end': {
    operator: 'Agent switch complete. Continuity preserved.',
    casual: 'Switch done.',
    quiet: 'OK.',
  },
  'evidence:phase_start': {
    operator: 'Evidence collection phase active.',
    casual: 'Collecting evidence.',
    quiet: 'Evidence.',
  },
  'evidence:phase_end': {
    operator: 'Evidence collection complete.',
    casual: 'Evidence done.',
    quiet: 'OK.',
  },
  'gates:phase_start': {
    operator: 'Running deterministic gates.',
    casual: 'Running gates.',
    quiet: 'Gates.',
  },
  'gates:phase_end': {
    operator: 'Gates passed. Build/test/lint verified.',
    casual: 'Gates done.',
    quiet: 'OK.',
  },
  'closeout:phase_start': {
    operator: 'Closeout sequence initiated.',
    casual: 'Closing out.',
    quiet: 'Closeout.',
  },
  'closeout:phase_end': {
    operator: 'Closeout complete. Sprint finalized.',
    casual: 'All done.',
    quiet: 'Done.',
  },
  'idle:phase_start': {
    operator: 'System idle. Awaiting instruction.',
    casual: 'Standing by.',
    quiet: 'Idle.',
  },
};

function getPhrase(phase: NarrationPhase, type: NarrationEventType, settings: NarrationSettings): string {
  const key: PhraseKey = `${phase}:${type}`;
  const set = PHRASES[key];
  if (!set) return '';
  if (settings.verbosity === 'quiet') return set.quiet;
  return settings.tone === 'operator' ? set.operator : set.casual;
}

// ── Detail formatters ─────────────────────────────────────────

function formatCheckpoint(ev: NarrationEvent, settings: NarrationSettings): string {
  const id = ev.checkpointId ?? 'unknown';
  if (settings.verbosity === 'quiet') return `Checkpoint: ${id}.`;
  return settings.tone === 'operator'
    ? `Checkpoint saved: ${id}. State recoverable.`
    : `Saved checkpoint ${id}.`;
}

function formatEvidence(ev: NarrationEvent, settings: NarrationSettings): string {
  const n = ev.evidenceCount ?? 0;
  if (settings.verbosity === 'quiet') return `Evidence: ${n}.`;
  return settings.tone === 'operator'
    ? `Evidence artifact collected. Total count: ${n}.`
    : `Got evidence (#${n}).`;
}

function formatAgentSwitch(ev: NarrationEvent, settings: NarrationSettings): string {
  const agent = ev.agent ?? 'unknown';
  const mode = ev.type === 'agent_switch_auto' ? 'auto' : 'manual';
  const reason = ev.reason ?? '';
  if (settings.verbosity === 'quiet') return `Switch: ${agent} (${mode}).`;
  if (settings.tone === 'operator') {
    return `Agent switch [${mode}]: now active adapter is ${agent}.${reason ? ` Reason: ${reason}.` : ''}`;
  }
  return `Switched to ${agent} (${mode}).${reason ? ` ${reason}.` : ''}`;
}

function formatHealthSignal(ev: NarrationEvent, settings: NarrationSettings): string {
  const sig = ev.signalId ?? 'UNKNOWN';
  const sev = ev.severity ?? 'WARN';
  if (settings.verbosity === 'quiet') return `Signal: ${sig} [${sev}].`;
  return settings.tone === 'operator'
    ? `Health signal: ${sig} severity=${sev}. Monitoring.`
    : `Heads up: ${sig} (${sev}).`;
}

function formatGate(ev: NarrationEvent, settings: NarrationSettings): string {
  const gate = ev.detail ?? 'gate';
  const pass = ev.type === 'gate_pass';
  if (settings.verbosity === 'quiet') return `${gate}: ${pass ? 'PASS' : 'FAIL'}.`;
  return settings.tone === 'operator'
    ? `Gate ${gate}: ${pass ? 'PASSED' : 'FAILED'}.`
    : `${gate} ${pass ? 'passed' : 'failed'}.`;
}

function formatHardStop(ev: NarrationEvent, settings: NarrationSettings): string {
  const reason = ev.reason ?? 'unspecified';
  if (settings.verbosity === 'quiet') return `HARD STOP: ${reason}.`;
  return `HARD STOP: ${reason}. Awaiting operator intervention.`;
}

function formatRunComplete(ev: NarrationEvent, settings: NarrationSettings): string {
  if (settings.verbosity === 'quiet') return 'Complete.';
  return settings.tone === 'operator'
    ? 'Run complete. All acceptance tests evidenced. Ready for review.'
    : 'All done! Ready for review.';
}

// ── Narration line rendering ──────────────────────────────────

export interface NarrationLine {
  seq: number;
  text: string;
  phase: NarrationPhase;
  type: NarrationEventType;
  ariaLive: 'polite' | 'assertive' | 'off';
}

function eventToLine(ev: NarrationEvent, settings: NarrationSettings): NarrationLine {
  let text = '';
  let ariaLive: NarrationLine['ariaLive'] = 'polite';

  switch (ev.type) {
    case 'phase_start':
    case 'phase_end':
      text = getPhrase(ev.phase, ev.type, settings);
      break;
    case 'checkpoint':
      text = formatCheckpoint(ev, settings);
      break;
    case 'evidence_collected':
      text = formatEvidence(ev, settings);
      break;
    case 'agent_switch_auto':
    case 'agent_switch_manual':
      text = formatAgentSwitch(ev, settings);
      ariaLive = 'assertive';
      break;
    case 'health_signal':
      text = formatHealthSignal(ev, settings);
      ariaLive = 'assertive';
      break;
    case 'repair_action':
      text = ev.detail
        ? `Repair action: ${ev.detail}.`
        : 'Repair action initiated.';
      break;
    case 'gate_pass':
    case 'gate_fail':
      text = formatGate(ev, settings);
      ariaLive = ev.type === 'gate_fail' ? 'assertive' : 'polite';
      break;
    case 'hard_stop':
      text = formatHardStop(ev, settings);
      ariaLive = 'assertive';
      break;
    case 'run_complete':
      text = formatRunComplete(ev, settings);
      break;
  }

  return { seq: ev.seq, text, phase: ev.phase, type: ev.type, ariaLive };
}

// ── Public API (pure function) ────────────────────────────────

export function renderNarration(
  events: readonly NarrationEvent[],
  settings: NarrationSettings = DEFAULT_SETTINGS,
): NarrationLine[] {
  return events.map((ev) => eventToLine(ev, settings));
}

export function renderNarrationText(
  events: readonly NarrationEvent[],
  settings: NarrationSettings = DEFAULT_SETTINGS,
): string {
  return renderNarration(events, settings)
    .map((line) => line.text)
    .filter(Boolean)
    .join('\n');
}
