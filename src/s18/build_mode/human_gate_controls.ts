import { stableHash } from './hash.ts';
import type { BuildModeState } from './state_machine.ts';

export type HumanGateId = 'requirements_approval' | 'delta_approval' | 'auto_advance_approval';
export type HumanGateDecision = 'approved' | 'rejected';
export type HumanGateStatus = 'pending' | HumanGateDecision;

export interface HumanGateRecord {
  gateId: HumanGateId;
  decision: HumanGateDecision;
  actor: string;
  rationale: string;
  evidenceRefs: string[];
  sequence: number;
  sha256: string;
}

export interface HumanGateSnapshot {
  id: HumanGateId;
  label: string;
  status: HumanGateStatus;
  requiredNow: boolean;
  latestRecord: HumanGateRecord | null;
}

export interface HumanGateControlModel {
  currentState: BuildModeState;
  currentGateId: HumanGateId | null;
  currentGateSatisfied: boolean;
  gates: HumanGateSnapshot[];
  rendered: string;
}

export interface HumanGateTransitionMachine {
  currentState: BuildModeState;
  transition(to: BuildModeState): void;
}

const GATE_ORDER: ReadonlyArray<{ id: HumanGateId; label: string }> = [
  { id: 'requirements_approval', label: 'Requirements approval' },
  { id: 'delta_approval', label: 'Delta approval' },
  { id: 'auto_advance_approval', label: 'Auto-advance approval' },
];

function normalizeText(value?: string): string {
  return value?.trim() ?? '';
}

function normalizeEvidenceRefs(value?: readonly string[]): string[] {
  return [...new Set((value ?? []).map((entry) => entry.trim()).filter(Boolean))];
}

function assertHumanGateSequence(records: readonly HumanGateRecord[], gateId: HumanGateId): void {
  const seen = new Set<number>();
  for (const record of records) {
    if (record.gateId !== gateId) {
      continue;
    }
    if (seen.has(record.sequence)) {
      throw new Error(`HUMAN_GATE_SEQUENCE_COLLISION:${gateId}:${record.sequence}`);
    }
    seen.add(record.sequence);
  }
}

export function recordHumanGateDecision(input: {
  gateId: HumanGateId;
  decision: HumanGateDecision;
  actor: string;
  sequence: number;
  rationale?: string;
  evidenceRefs?: readonly string[];
}): HumanGateRecord {
  const actor = normalizeText(input.actor);
  if (!actor) {
    throw new Error('HUMAN_GATE_ACTOR_REQUIRED');
  }
  if (!Number.isInteger(input.sequence) || input.sequence < 1) {
    throw new Error('HUMAN_GATE_SEQUENCE_INVALID');
  }

  const base = {
    gateId: input.gateId,
    decision: input.decision,
    actor,
    rationale: normalizeText(input.rationale),
    evidenceRefs: normalizeEvidenceRefs(input.evidenceRefs),
    sequence: input.sequence,
  };

  return {
    ...base,
    sha256: stableHash(base),
  };
}

export function latestHumanGateRecord(
  records: readonly HumanGateRecord[],
  gateId: HumanGateId,
): HumanGateRecord | null {
  assertHumanGateSequence(records, gateId);
  const matching = records.filter((record) => record.gateId === gateId);
  if (matching.length === 0) {
    return null;
  }
  return matching.reduce((latest, record) => (record.sequence > latest.sequence ? record : latest));
}

export function humanGateStatus(
  records: readonly HumanGateRecord[],
  gateId: HumanGateId,
): HumanGateStatus {
  return latestHumanGateRecord(records, gateId)?.decision ?? 'pending';
}

export function requiredHumanGateForState(currentState: BuildModeState): HumanGateId | null {
  switch (currentState) {
    case 'requirements_ready':
      return 'requirements_approval';
    case 'delta_required':
      return 'delta_approval';
    case 'done':
      return 'auto_advance_approval';
    default:
      return null;
  }
}

function requiredHumanGateForTransition(from: BuildModeState, to: BuildModeState): HumanGateId | null {
  if (from === 'requirements_ready' && to === 'prompt_ready') {
    return 'requirements_approval';
  }
  if (from === 'delta_required' && to === 'prompt_ready') {
    return 'delta_approval';
  }
  return null;
}

function renderGate(snapshot: HumanGateSnapshot): string {
  const label = `${snapshot.label}: ${snapshot.status}`;
  return snapshot.requiredNow ? `[${label}]` : label;
}

export function buildHumanGateControlModel(input: {
  currentState: BuildModeState;
  records: readonly HumanGateRecord[];
}): HumanGateControlModel {
  const currentGateId = requiredHumanGateForState(input.currentState);
  const gates = GATE_ORDER.map((gate) => ({
    id: gate.id,
    label: gate.label,
    status: humanGateStatus(input.records, gate.id),
    requiredNow: currentGateId === gate.id,
    latestRecord: latestHumanGateRecord(input.records, gate.id),
  }));
  const currentGate = gates.find((gate) => gate.id === currentGateId) ?? null;

  return {
    currentState: input.currentState,
    currentGateId,
    currentGateSatisfied: currentGate ? currentGate.status === 'approved' : true,
    gates,
    rendered: gates.map(renderGate).join(' | '),
  };
}

export function assertHumanGateAllowsTransition(input: {
  from: BuildModeState;
  to: BuildModeState;
  records: readonly HumanGateRecord[];
}): void {
  const gateId = requiredHumanGateForTransition(input.from, input.to);
  if (!gateId) {
    return;
  }
  if (humanGateStatus(input.records, gateId) !== 'approved') {
    throw new Error(`HUMAN_GATE_APPROVAL_REQUIRED:${gateId}`);
  }
}

export function transitionWithHumanGate(
  machine: HumanGateTransitionMachine,
  to: BuildModeState,
  records: readonly HumanGateRecord[],
): BuildModeState {
  assertHumanGateAllowsTransition({
    from: machine.currentState,
    to,
    records,
  });
  machine.transition(to);
  return machine.currentState;
}

export function assertAutoAdvanceApproved(
  records: readonly HumanGateRecord[],
): HumanGateRecord {
  const latest = latestHumanGateRecord(records, 'auto_advance_approval');
  if (!latest || latest.decision !== 'approved') {
    throw new Error('HUMAN_GATE_APPROVAL_REQUIRED:auto_advance_approval');
  }
  return latest;
}
