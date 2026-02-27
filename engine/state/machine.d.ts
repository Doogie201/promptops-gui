export type StatePhase = 'IDLE' | 'RUNNING' | 'ERROR' | 'DONE';
export type RunEvent = 'START' | 'FAIL' | 'COMPLETE' | 'RESET';
export declare class RunStateMachine {
    private phase;
    get currentPhase(): StatePhase;
    transition(event: RunEvent): void;
}
//# sourceMappingURL=machine.d.ts.map