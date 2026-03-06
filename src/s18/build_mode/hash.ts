import crypto from 'node:crypto';
import { canonicalSerialize } from '../../../engine/events/schema.ts';

export function stableJson(value: unknown): string {
  return `${canonicalSerialize(value)}\n`;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function stableHash(value: unknown): string {
  return sha256(stableJson(value));
}
