/**
 * S14.B — Live Mission Control Dashboard (view-layer only)
 *
 * Consumes event stream read-only to produce dashboard state.
 * Never dispatches decision actions. Pure computation.
 */

import type { NarrationEvent, NarrationPhase } from './narration.ts';

// ── Dashboard model ───────────────────────────────────────────

export interface PhaseProgress {
  phase: NarrationPhase;
  status: 'pending' | 'active' | 'complete';
  eventCount: number;
}

export interface AgentSwitchEntry {
  seq: number;
  agent: string;
  mode: 'auto' | 'manual';
  reason: string;
}

export interface DashboardState {
  phases: PhaseProgress[];
  evidenceCount: number;
  lastCheckpointId: string | null;
  activeAgent: string | null;
  agentTimeline: AgentSwitchEntry[];
  activePhase: NarrationPhase;
  nextDecisionReason: string | null;
  totalEvents: number;
  hardStopped: boolean;
  runComplete: boolean;
}

// ── Phase ordering ────────────────────────────────────────────

const PHASE_ORDER: readonly NarrationPhase[] = [
  'preflight',
  'intake',
  'agent_invocation',
  'switching',
  'evidence',
  'gates',
  'closeout',
] as const;

function createInitialPhases(): PhaseProgress[] {
  return PHASE_ORDER.map((phase) => ({
    phase,
    status: 'pending' as const,
    eventCount: 0,
  }));
}

// ── Dashboard computation (pure function) ─────────────────────

export function computeDashboard(events: readonly NarrationEvent[]): DashboardState {
  const phases = createInitialPhases();
  let evidenceCount = 0;
  let lastCheckpointId: string | null = null;
  let activeAgent: string | null = null;
  const agentTimeline: AgentSwitchEntry[] = [];
  let activePhase: NarrationPhase = 'idle';
  let nextDecisionReason: string | null = null;
  let hardStopped = false;
  let runComplete = false;

  for (const ev of events) {
    const phaseEntry = phases.find((p) => p.phase === ev.phase);
    if (phaseEntry) {
      phaseEntry.eventCount++;
    }

    switch (ev.type) {
      case 'phase_start': {
        if (phaseEntry) phaseEntry.status = 'active';
        activePhase = ev.phase;
        break;
      }
      case 'phase_end': {
        if (phaseEntry) phaseEntry.status = 'complete';
        break;
      }
      case 'checkpoint': {
        lastCheckpointId = ev.checkpointId ?? lastCheckpointId;
        break;
      }
      case 'evidence_collected': {
        evidenceCount = ev.evidenceCount ?? evidenceCount + 1;
        break;
      }
      case 'agent_switch_auto':
      case 'agent_switch_manual': {
        activeAgent = ev.agent ?? activeAgent;
        agentTimeline.push({
          seq: ev.seq,
          agent: ev.agent ?? 'unknown',
          mode: ev.type === 'agent_switch_auto' ? 'auto' : 'manual',
          reason: ev.reason ?? '',
        });
        break;
      }
      case 'health_signal': {
        if (ev.severity === 'FAIL') {
          nextDecisionReason = `Health signal: ${ev.signalId ?? 'UNKNOWN'}`;
        }
        break;
      }
      case 'hard_stop': {
        hardStopped = true;
        nextDecisionReason = ev.reason ?? 'Hard stop triggered';
        break;
      }
      case 'run_complete': {
        runComplete = true;
        nextDecisionReason = null;
        break;
      }
    }
  }

  return {
    phases,
    evidenceCount,
    lastCheckpointId,
    activeAgent,
    agentTimeline,
    activePhase,
    nextDecisionReason,
    totalEvents: events.length,
    hardStopped,
    runComplete,
  };
}

// ── Dashboard text rendering (for tests + CLI) ────────────────

export function renderDashboardText(state: DashboardState): string {
  const lines: string[] = [];
  lines.push('=== Mission Control ===');
  lines.push('');

  lines.push('Phases:');
  for (const p of state.phases) {
    const icon = p.status === 'complete' ? '[x]' : p.status === 'active' ? '[>]' : '[ ]';
    lines.push(`  ${icon} ${p.phase} (${p.eventCount} events)`);
  }
  lines.push('');

  lines.push(`Evidence collected: ${state.evidenceCount}`);
  lines.push(`Last checkpoint: ${state.lastCheckpointId ?? 'none'}`);
  lines.push(`Active agent: ${state.activeAgent ?? 'none'}`);
  lines.push(`Active phase: ${state.activePhase}`);
  lines.push('');

  if (state.agentTimeline.length > 0) {
    lines.push('Agent Timeline:');
    for (const entry of state.agentTimeline) {
      lines.push(`  #${entry.seq} ${entry.agent} [${entry.mode}]${entry.reason ? ` - ${entry.reason}` : ''}`);
    }
    lines.push('');
  }

  if (state.hardStopped) {
    lines.push(`STATUS: HARD STOP - ${state.nextDecisionReason ?? 'unknown'}`);
  } else if (state.runComplete) {
    lines.push('STATUS: COMPLETE');
  } else if (state.nextDecisionReason) {
    lines.push(`Next decision: ${state.nextDecisionReason}`);
  } else {
    lines.push('STATUS: IN PROGRESS');
  }

  return lines.join('\n');
}

// ── CSS helpers for reduced motion ────────────────────────────

export interface DashboardStyles {
  animationDuration: string;
  transitionDuration: string;
  pulseAnimation: string;
}

export function getDashboardStyles(reducedMotion: boolean): DashboardStyles {
  return {
    animationDuration: reducedMotion ? '0ms' : '300ms',
    transitionDuration: reducedMotion ? '0ms' : '200ms',
    pulseAnimation: reducedMotion ? 'none' : 'ds-ambient-pulse 2s ease infinite',
  };
}
