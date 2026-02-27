"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunStateMachine = void 0;
class RunStateMachine {
    phase = 'IDLE';
    get currentPhase() {
        return this.phase;
    }
    transition(event) {
        switch (this.phase) {
            case 'IDLE':
                if (event === 'START') {
                    this.phase = 'RUNNING';
                    return;
                }
                break;
            case 'RUNNING':
                if (event === 'FAIL') {
                    this.phase = 'ERROR';
                    return;
                }
                if (event === 'COMPLETE') {
                    this.phase = 'DONE';
                    return;
                }
                break;
            case 'ERROR':
            case 'DONE':
                if (event === 'RESET') {
                    this.phase = 'IDLE';
                    return;
                }
                break;
        }
        throw new Error(`Illegal transition: cannot process event '${event}' while in phase '${this.phase}'`);
    }
}
exports.RunStateMachine = RunStateMachine;
