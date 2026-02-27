export type EventType = 'SYS_START' | 'SYS_STOP' | 'USER_ACTION';
export interface BaseEvent {
    type: EventType;
    version: '1.0';
    payload: Record<string, unknown>;
}
/**
 * Deterministically serializes an object into a canonical JSON string.
 */
export declare function canonicalSerialize(obj: unknown): string;
/**
 * Generates a SHA256 hash for an event using canonical serialization.
 */
export declare function idForEvent(event: BaseEvent): string;
//# sourceMappingURL=schema.d.ts.map