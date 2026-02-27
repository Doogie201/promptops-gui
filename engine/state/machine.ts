export type StatePhase = 'IDLE' | 'RUNNING' | 'ERROR' | 'DONE';
export type RunEvent = 'START' | 'FAIL' | 'COMPLETE' | 'RESET';

export class RunStateMachine {
  private phase: StatePhase = 'IDLE';

  get currentPhase(): StatePhase {
    return this.phase;
  }

  transition(event: RunEvent): void {
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
