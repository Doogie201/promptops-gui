import fs from 'node:fs';
import path from 'node:path';
import { loadCheckpoint } from './checkpoints.ts';
import { stableHash } from './hash.ts';
import { BuildModeStateMachine, type BuildModeState } from './state_machine.ts';

export type ReplayHashParityStatus = 'match' | 'drift' | 'missing';
export type ReplaySelectionMode = 'explicit' | 'latest';

export interface ReplayHashParityBadge {
  status: ReplayHashParityStatus;
  label: string;
  expectedHash: string | null;
  actualHash: string;
  rendered: string;
}

export interface ReplayResumeModel {
  bundleRoot: string;
  checkpointId: string;
  selectionMode: ReplaySelectionMode;
  checkpointPath: string;
  hashPath: string;
  checkpointState: BuildModeState;
  checkpointPayload: Record<string, unknown>;
  parityBadge: ReplayHashParityBadge;
  resumeActionLabel: string;
  resumeActionEnabled: boolean;
  rendered: string;
  sha256: string;
}

const BUILD_MODE_STATES: ReadonlySet<BuildModeState> = new Set([
  'planning',
  'project_bootstrapped',
  'requirements_ready',
  'prompt_ready',
  'awaiting_agent_output',
  'evaluating',
  'delta_required',
  'done',
  'blocked',
]);

function resolveCheckpointId(bundleRoot: string, checkpointId?: string): {
  checkpointId: string;
  selectionMode: ReplaySelectionMode;
} {
  if (checkpointId?.trim()) {
    return {
      checkpointId: checkpointId.trim(),
      selectionMode: 'explicit',
    };
  }

  const candidates = fs
    .readdirSync(bundleRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((entry) => fs.existsSync(path.join(bundleRoot, entry, 'checkpoint.json')))
    .sort();

  if (candidates.length === 0) {
    throw new Error('REPLAY_RESUME_CHECKPOINT_NOT_FOUND');
  }

  return {
    checkpointId: candidates[candidates.length - 1] ?? '',
    selectionMode: 'latest',
  };
}

function readExpectedHash(hashPath: string): string | null {
  if (!fs.existsSync(hashPath)) {
    return null;
  }

  const raw = fs.readFileSync(hashPath, 'utf8').trim();
  const match = raw.match(/^([a-f0-9]{64})\s{2}checkpoint\.json$/);
  return match?.[1] ?? null;
}

function toBuildModeState(value: unknown): BuildModeState {
  if (typeof value !== 'string' || !BUILD_MODE_STATES.has(value as BuildModeState)) {
    throw new Error('REPLAY_RESUME_STATE_INVALID');
  }
  return value as BuildModeState;
}

function buildParityBadge(expectedHash: string | null, actualHash: string): ReplayHashParityBadge {
  let status: ReplayHashParityStatus = 'missing';
  if (expectedHash !== null) {
    status = expectedHash === actualHash ? 'match' : 'drift';
  }
  let label = 'HASH MISSING';
  if (status === 'match') {
    label = 'HASH MATCH';
  } else if (status === 'drift') {
    label = 'HASH DRIFT';
  }

  return {
    status,
    label,
    expectedHash,
    actualHash,
    rendered: `[${label}]`,
  };
}

export function buildReplayResumeModel(input: {
  bundleRoot: string;
  checkpointId?: string;
}): ReplayResumeModel {
  const bundleRoot = input.bundleRoot.trim();
  if (!bundleRoot) {
    throw new Error('REPLAY_RESUME_BUNDLE_ROOT_REQUIRED');
  }

  const selection = resolveCheckpointId(bundleRoot, input.checkpointId);
  const checkpointPath = path.join(bundleRoot, selection.checkpointId, 'checkpoint.json');
  const hashPath = path.join(bundleRoot, selection.checkpointId, 'checkpoint.sha256');
  const checkpointPayload = loadCheckpoint(checkpointPath);
  const checkpointState = toBuildModeState(checkpointPayload.state);
  const actualHash = stableHash(checkpointPayload);
  const parityBadge = buildParityBadge(readExpectedHash(hashPath), actualHash);
  const base = {
    bundleRoot,
    checkpointId: selection.checkpointId,
    selectionMode: selection.selectionMode,
    checkpointPath,
    hashPath,
    checkpointState,
    checkpointPayload,
    parityBadge,
    resumeActionLabel:
      selection.selectionMode === 'latest'
        ? `Resume latest checkpoint (${selection.checkpointId})`
        : `Resume checkpoint (${selection.checkpointId})`,
    resumeActionEnabled: parityBadge.status === 'match',
  };

  return {
    ...base,
    rendered: `${base.resumeActionLabel} | ${checkpointState} | ${parityBadge.rendered}`,
    sha256: stableHash(base),
  };
}

export function resumeStateMachineFromArtifactBundle(input: {
  bundleRoot: string;
  checkpointId?: string;
}): {
  model: ReplayResumeModel;
  machine: BuildModeStateMachine;
} {
  const model = buildReplayResumeModel(input);
  if (!model.resumeActionEnabled) {
    throw new Error(`REPLAY_RESUME_BLOCKED:${model.parityBadge.status}`);
  }

  return {
    model,
    machine: new BuildModeStateMachine(model.checkpointState),
  };
}
