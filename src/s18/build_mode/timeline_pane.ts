import { posix as pathPosix } from 'node:path';
import { stableHash } from './hash.ts';
import type { BuildModeState } from './state_machine.ts';

export interface TimelineTransitionReceipt {
  transitionId: string;
  from: BuildModeState;
  to: BuildModeState;
  inputHashes: readonly string[];
  outputHashes: readonly string[];
  receiptPaths: readonly string[];
  exitCode: number;
  evidencePaths?: readonly string[];
  checkpointId?: string;
  checkpointPath?: string;
}

export type TimelineLinkKind = 'receipt' | 'evidence' | 'checkpoint';
export type TimelineEntryStatus = 'complete' | 'current';

export interface TimelineLink {
  kind: TimelineLinkKind;
  path: string;
  label: string;
}

export interface TimelinePaneEntry {
  sequence: number;
  transitionId: string;
  from: BuildModeState;
  to: BuildModeState;
  status: TimelineEntryStatus;
  failed: boolean;
  exitCode: number;
  checkpointId: string | null;
  checkpointPath: string | null;
  receiptPaths: string[];
  evidencePaths: string[];
  links: TimelineLink[];
  rendered: string;
  sha256: string;
}

export interface TimelinePaneModel {
  currentState: BuildModeState;
  currentTransitionId: string | null;
  currentSequence: number | null;
  lastCheckpointId: string | null;
  totalTransitions: number;
  totalLinks: number;
  entries: TimelinePaneEntry[];
  rendered: string;
  sha256: string;
}

function normalizePath(value?: string): string | null {
  const trimmed = value?.trim().replaceAll('\\', '/');
  if (!trimmed) {
    return null;
  }

  const normalized = pathPosix.normalize(trimmed);
  if (normalized === '.' || normalized === '') {
    return null;
  }

  if (normalized.startsWith('./')) {
    return normalized.slice(2);
  }

  return normalized;
}

function normalizePaths(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map(normalizePath).filter((value): value is string => Boolean(value)))].sort();
}

function requireTransitionId(value: string): string {
  const transitionId = value.trim();
  if (!transitionId) {
    throw new Error('TIMELINE_PANE_TRANSITION_ID_REQUIRED');
  }
  return transitionId;
}

function buildLinks(input: {
  transitionId: string;
  receiptPaths: string[];
  evidencePaths: string[];
  checkpointId?: string;
  checkpointPath?: string;
}): TimelineLink[] {
  if (input.receiptPaths.length === 0) {
    throw new Error(`TIMELINE_PANE_RECEIPTS_REQUIRED:${input.transitionId}`);
  }

  const links: TimelineLink[] = input.receiptPaths.map((entry, index) => ({
    kind: 'receipt',
    path: entry,
    label: `Receipt ${index + 1}`,
  }));

  const evidencePaths = input.evidencePaths.filter((entry) => !input.receiptPaths.includes(entry));
  links.push(
    ...evidencePaths.map((entry, index) => ({
      kind: 'evidence' as const,
      path: entry,
      label: `Evidence ${index + 1}`,
    })),
  );

  const checkpointPath = normalizePath(input.checkpointPath);
  if (checkpointPath) {
    links.push({
      kind: 'checkpoint',
      path: checkpointPath,
      label: input.checkpointId?.trim() ? `Checkpoint ${input.checkpointId.trim()}` : 'Checkpoint',
    });
  }

  return links;
}

function renderEntry(entry: Omit<TimelinePaneEntry, 'rendered' | 'sha256'>): string {
  const head = `#${String(entry.sequence).padStart(2, '0')} ${entry.from} -> ${entry.to} [${entry.status}] exit=${entry.exitCode}`;
  const detail = [
    `  receipts: ${entry.receiptPaths.join(', ')}`,
    `  evidence: ${entry.evidencePaths.length > 0 ? entry.evidencePaths.join(', ') : 'none'}`,
    `  checkpoint: ${entry.checkpointPath ?? 'none'}`,
  ];
  if (entry.failed) {
    detail.push('  failure: exitCode != 0');
  }
  return [head, ...detail].join('\n');
}

function buildEntry(
  receipt: TimelineTransitionReceipt,
  sequence: number,
  currentIndex: number,
): TimelinePaneEntry {
  const transitionId = requireTransitionId(receipt.transitionId);
  const receiptPaths = normalizePaths(receipt.receiptPaths);
  const evidencePaths = normalizePaths(receipt.evidencePaths);
  const checkpointPath = normalizePath(receipt.checkpointPath);
  const base = {
    sequence,
    transitionId,
    from: receipt.from,
    to: receipt.to,
    status: currentIndex === sequence - 1 ? 'current' : 'complete',
    failed: receipt.exitCode !== 0,
    exitCode: receipt.exitCode,
    checkpointId: receipt.checkpointId?.trim() || null,
    checkpointPath,
    receiptPaths,
    evidencePaths,
    links: buildLinks({
      transitionId,
      receiptPaths,
      evidencePaths,
      checkpointId: receipt.checkpointId,
      checkpointPath: receipt.checkpointPath,
    }),
  };

  return {
    ...base,
    rendered: renderEntry(base),
    sha256: stableHash(base),
  };
}

function findCurrentIndex(
  transitions: readonly TimelineTransitionReceipt[],
  currentState: BuildModeState,
): number {
  for (let index = transitions.length - 1; index >= 0; index -= 1) {
    if (transitions[index]?.to === currentState) {
      return index;
    }
  }
  return -1;
}

function assertUniqueTransitionIds(transitions: readonly TimelineTransitionReceipt[]): void {
  const seen = new Set<string>();
  for (const transition of transitions) {
    const transitionId = requireTransitionId(transition.transitionId);
    if (seen.has(transitionId)) {
      throw new Error(`TIMELINE_PANE_TRANSITION_ID_COLLISION:${transitionId}`);
    }
    seen.add(transitionId);
  }
}

function renderPane(entries: readonly TimelinePaneEntry[], currentState: BuildModeState): string {
  if (entries.length === 0) {
    return `Timeline empty | current=${currentState}`;
  }
  return entries.map((entry) => entry.rendered).join('\n');
}

export function buildDeterministicTimelinePane(input: {
  currentState: BuildModeState;
  transitions: readonly TimelineTransitionReceipt[];
}): TimelinePaneModel {
  assertUniqueTransitionIds(input.transitions);
  const currentIndex = input.transitions.length === 0 ? -1 : findCurrentIndex(input.transitions, input.currentState);
  const entries = input.transitions.map((receipt, index) => buildEntry(receipt, index + 1, currentIndex));
  const currentEntry = currentIndex >= 0 ? entries[currentIndex] ?? null : null;
  const lastCheckpointEntry = [...entries].reverse().find((entry) => entry.checkpointId !== null) ?? null;
  const base = {
    currentState: input.currentState,
    currentTransitionId: currentEntry?.transitionId ?? null,
    currentSequence: currentEntry?.sequence ?? null,
    lastCheckpointId: lastCheckpointEntry?.checkpointId ?? null,
    totalTransitions: entries.length,
    totalLinks: entries.reduce((count, entry) => count + entry.links.length, 0),
    entries,
  };

  return {
    ...base,
    rendered: renderPane(entries, input.currentState),
    sha256: stableHash(base),
  };
}
