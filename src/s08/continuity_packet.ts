import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ContinuityPacketV1 } from './contract.ts';

const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|api[_-]?key|access[_-]?key)/i;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface ContinuityArtifact {
  packet_path: string;
  hash_path: string;
  sha256: string;
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function continuitySha256(packet: ContinuityPacketV1): string {
  return crypto.createHash('sha256').update(canonicalJson(packet)).digest('hex');
}

export function validateContinuityPacket(packet: ContinuityPacketV1): string[] {
  const failures: string[] = [];
  if (packet.version !== 'continuity_packet_v1') failures.push('missing version continuity_packet_v1');
  if (!packet.template_version_hash) failures.push('missing template_version_hash');
  if (!packet.last_checkpoint_id) failures.push('missing last_checkpoint_id');
  if (!Array.isArray(packet.outstanding_delta_ids)) failures.push('missing outstanding_delta_ids');
  if (!packet.rendered_ticket_json) failures.push('missing rendered_ticket_json');
  if (!packet.evidence_ledger_snapshot?.items) failures.push('missing evidence_ledger_snapshot.items');
  if (!packet.repo_context_snapshot?.branch) failures.push('missing repo_context_snapshot.branch');
  if (!packet.repo_context_snapshot?.preflight_receipts) failures.push('missing repo_context_snapshot.preflight_receipts');
  if (!packet.run_timeline_tail) failures.push('missing run_timeline_tail');
  if (!packet.policy_bundle?.whitelist) failures.push('missing policy_bundle.whitelist');
  return failures;
}

export function writeContinuityPacket(
  root: string,
  checkpointId: string,
  packet: ContinuityPacketV1,
): ContinuityArtifact {
  const failures = validateContinuityPacket(packet);
  if (failures.length > 0) {
    throw new Error(`HARD_STOP: continuity packet missing required fields: ${failures.join(', ')}`);
  }
  const checkpointRoot = path.join(root, checkpointId);
  fs.mkdirSync(checkpointRoot, { recursive: true });
  const packetPath = path.join(checkpointRoot, 'continuity_packet.json');
  const hashPath = path.join(checkpointRoot, 'continuity_packet.sha256');
  const payload = canonicalJson(packet);
  const hash = crypto.createHash('sha256').update(payload).digest('hex');
  fs.writeFileSync(packetPath, payload, 'utf8');
  fs.writeFileSync(hashPath, `${hash}  continuity_packet.json\n`, 'utf8');
  return { packet_path: packetPath, hash_path: hashPath, sha256: hash };
}

export function buildNextAgentFirstMessage(sha256: string, outstandingDeltaIds: string[]): string {
  const deltas = outstandingDeltaIds.join(',');
  return `continuity_sha256=${sha256} | do not redo evidenced work; close only listed deltas | deltas=${deltas}`;
}

function canonicalize(value: unknown, parentKey = ''): JsonValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactSensitiveString(parentKey, value);
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, parentKey));

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  const output: Record<string, JsonValue> = {};
  for (const [key, item] of entries) {
    output[key] = canonicalize(item, key);
  }
  return output;
}

function redactSensitiveString(key: string, value: string): string {
  if (SENSITIVE_KEY_PATTERN.test(key)) return '<REDACTED:SENSITIVE>';
  return value;
}
