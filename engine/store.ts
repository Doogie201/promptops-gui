import * as fs from 'fs';
import * as path from 'path';
import { BaseEvent, idForEvent } from './events/schema';
import { RunStateMachine } from './state/machine';

export class EngineRun {
  public machine = new RunStateMachine();
  public events: Map<string, BaseEvent> = new Map();
  public eventLog: string[] = [];

  constructor(public runId: string, public persistDir: string) {
    this.hydrate();
  }

  private getLogFilePath(): string {
    return path.join(this.persistDir, `${this.runId}.jsonl`);
  }

  private hydrate(): void {
    const logFile = this.getLogFilePath();
    if (!fs.existsSync(logFile)) return;

    const lines = fs.readFileSync(logFile, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      const ev = JSON.parse(line) as BaseEvent;
      const id = idForEvent(ev);
      this.events.set(id, ev);
      this.eventLog.push(id);
      this.applyEventToMachine(ev);
    }
  }

  private applyEventToMachine(ev: BaseEvent) {
    try {
      if (ev.type === 'SYS_START' && this.machine.currentPhase === 'IDLE') {
        this.machine.transition('START');
      } else if (ev.type === 'SYS_STOP' && this.machine.currentPhase === 'RUNNING') {
        this.machine.transition('COMPLETE');
      } else if (ev.type === 'USER_ACTION') {
        // Assume user actions only happen when running
        if (this.machine.currentPhase === 'IDLE') {
           this.machine.transition('START');
        }
      }
    } catch (e) {
      // Ignore illegal transitions during replay/hydrate to maintain determinism
      // of the store itself, or handle them based on strict state machine rules.
    }
  }

  public dispatch(ev: BaseEvent): { newAction: boolean, id: string } {
    const id = idForEvent(ev);
    if (this.events.has(id)) {
      return { newAction: false, id };
    }

    const logFile = this.getLogFilePath();
    fs.mkdirSync(this.persistDir, { recursive: true });
    fs.appendFileSync(logFile, JSON.stringify(ev) + '\n');

    this.events.set(id, ev);
    this.eventLog.push(id);
    this.applyEventToMachine(ev);

    return { newAction: true, id };
  }
}
