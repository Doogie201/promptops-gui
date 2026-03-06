import fs from 'node:fs';
import path from 'node:path';
import { sha256, stableJson } from './hash.ts';

export interface CheckpointArtifact {
  checkpointPath: string;
  hashPath: string;
  sha256: string;
}

export function writeCheckpoint(root: string, checkpointId: string, payload: Record<string, unknown>): CheckpointArtifact {
  const checkpointDir = path.join(root, checkpointId);
  fs.mkdirSync(checkpointDir, { recursive: true });
  const checkpointPath = path.join(checkpointDir, 'checkpoint.json');
  const hashPath = path.join(checkpointDir, 'checkpoint.sha256');
  const json = stableJson(payload);
  const hash = sha256(json);
  fs.writeFileSync(checkpointPath, json, 'utf8');
  fs.writeFileSync(hashPath, `${hash}  checkpoint.json\n`, 'utf8');
  return { checkpointPath, hashPath, sha256: hash };
}

export function loadCheckpoint(checkpointPath: string): Record<string, unknown> {
  const raw = fs.readFileSync(checkpointPath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}
