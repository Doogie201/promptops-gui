import { stableHash } from './hash.ts';
import type { BuildModeState } from './state_machine.ts';

export type HumanGateId = 'requirements_approval' | 'delta_approval' | 'auto_advance_approval';
export type HumanGateDecision = 'approved' | 'rejected';
export type HumanGateStatus = 'pending' | HumanGateDecision;
export type HumanGateSequenceMap = Partial<Record<HumanGateId, number>>;

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
  requiredSequence: number | null;
  latestRecord: HumanGateRecord | null;
}

export interface HumanGateControlModel {
  currentState: BuildModeState;
  currentGateId: HumanGateId | null;
  currentGateRequiredSequence: number | null;
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

function normalizeRequiredSequence(value?: number): number | null {
  if (value === undefined) {
    return null;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('HUMAN_GATE_SEQUENCE_INVALID');
  }
  return value;
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
  requiredSequence?: number,
): HumanGateStatus {
  const latest = latestHumanGateRecord(records, gateId);
  if (!latest) {
    return 'pending';
  }

  const normalizedRequiredSequence = normalizeRequiredSequence(requiredSequence);
  if (normalizedRequiredSequence !== null && latest.sequence !== normalizedRequiredSequence) {
    return 'pending';
  }

  return latest.decision;
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
  requiredSequenceByGate?: HumanGateSequenceMap;
}): HumanGateControlModel {
  const currentGateId = requiredHumanGateForState(input.currentState);
  const gates = GATE_ORDER.map((gate) => ({
    id: gate.id,
    label: gate.label,
    status: humanGateStatus(input.records, gate.id, input.requiredSequenceByGate?.[gate.id]),
    requiredNow: currentGateId === gate.id,
    requiredSequence: normalizeRequiredSequence(input.requiredSequenceByGate?.[gate.id]),
    latestRecord: latestHumanGateRecord(input.records, gate.id),
  }));
  const currentGate = gates.find((gate) => gate.id === currentGateId) ?? null;

  return {
    currentState: input.currentState,
    currentGateId,
    currentGateRequiredSequence: currentGate?.requiredSequence ?? null,
    currentGateSatisfied: currentGate ? currentGate.status === 'approved' : true,
    gates,
    rendered: gates.map(renderGate).join(' | '),
  };
}

export function assertHumanGateAllowsTransition(input: {
  from: BuildModeState;
  to: BuildModeState;
  records: readonly HumanGateRecord[];
  requiredApprovalSequence?: number;
}): void {
  const gateId = requiredHumanGateForTransition(input.from, input.to);
  if (!gateId) {
    return;
  }

  const requiredApprovalSequence = normalizeRequiredSequence(input.requiredApprovalSequence);
  if (requiredApprovalSequence === null) {
    throw new Error(`HUMAN_GATE_SEQUENCE_REQUIRED:${gateId}`);
  }
  if (humanGateStatus(input.records, gateId, requiredApprovalSequence) !== 'approved') {
    throw new Error(`HUMAN_GATE_APPROVAL_REQUIRED:${gateId}`);
  }
}

export function transitionWithHumanGate(
  machine: HumanGateTransitionMachine,
  to: BuildModeState,
  records: readonly HumanGateRecord[],
  requiredApprovalSequence?: number,
): BuildModeState {
  assertHumanGateAllowsTransition({
    from: machine.currentState,
    to,
    records,
    requiredApprovalSequence,
  });
  machine.transition(to);
  return machine.currentState;
}

export function assertAutoAdvanceApproved(
  records: readonly HumanGateRecord[],
  requiredApprovalSequence?: number,
): HumanGateRecord {
  const normalizedRequiredSequence = normalizeRequiredSequence(requiredApprovalSequence);
  if (normalizedRequiredSequence === null) {
    throw new Error('HUMAN_GATE_SEQUENCE_REQUIRED:auto_advance_approval');
  }
  const latest = latestHumanGateRecord(records, 'auto_advance_approval');
  if (!latest || latest.sequence !== normalizedRequiredSequence || latest.decision !== 'approved') {
    throw new Error('HUMAN_GATE_APPROVAL_REQUIRED:auto_advance_approval');
  }
  return latest;
}
