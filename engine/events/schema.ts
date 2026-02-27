import * as crypto from 'crypto';

export type EventType = 'SYS_START' | 'SYS_STOP' | 'USER_ACTION';

export interface BaseEvent {
  type: EventType;
  version: '1.0';
  payload: Record<string, unknown>;
}

/**
 * Deterministically serializes an object into a canonical JSON string.
 */
export function canonicalSerialize(obj: unknown): string {
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalSerialize).join(',') + ']';
  } else if (obj !== null && typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalSerialize((obj as Record<string, unknown>)[k])).join(',') + '}';
  } else {
    return JSON.stringify(obj);
  }
}

/**
 * Generates a SHA256 hash for an event using canonical serialization.
 */
export function idForEvent(event: BaseEvent): string {
  const bytes = canonicalSerialize(event);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
