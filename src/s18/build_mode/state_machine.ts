export type BuildModeState =
  | 'planning'
  | 'project_bootstrapped'
  | 'requirements_ready'
  | 'prompt_ready'
  | 'awaiting_agent_output'
  | 'evaluating'
  | 'delta_required'
  | 'done'
  | 'blocked';

const ALLOWED: Record<BuildModeState, BuildModeState[]> = {
  planning: ['project_bootstrapped', 'requirements_ready', 'blocked'],
  project_bootstrapped: ['requirements_ready', 'blocked'],
  requirements_ready: ['prompt_ready', 'blocked'],
  prompt_ready: ['awaiting_agent_output', 'blocked'],
  awaiting_agent_output: ['evaluating', 'blocked'],
  evaluating: ['done', 'delta_required', 'blocked'],
  delta_required: ['prompt_ready', 'blocked'],
  done: [],
  blocked: ['planning'],
};

export function isAllowedTransition(from: BuildModeState, to: BuildModeState): boolean {
  return ALLOWED[from].includes(to);
}

export class BuildModeStateMachine {
  private state: BuildModeState;

  constructor(initialState: BuildModeState = 'planning') {
    this.state = initialState;
  }

  get currentState(): BuildModeState {
    return this.state;
  }

  transition(to: BuildModeState): void {
    if (!isAllowedTransition(this.state, to)) {
      throw new Error(`Illegal transition: ${this.state} -> ${to}`);
    }
    this.state = to;
  }
}
