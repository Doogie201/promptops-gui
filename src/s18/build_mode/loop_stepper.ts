import type { BuildModeState } from './state_machine.ts';

export type LoopStepId = 'planning' | 'requirements' | 'prompt' | 'run' | 'evaluate' | 'outcome';
export type LoopStepStatus = 'complete' | 'current' | 'upcoming';
export type LoopOutcome = 'delta' | 'done' | null;

export interface LoopStep {
  id: LoopStepId;
  label: string;
  status: LoopStepStatus;
  states: readonly BuildModeState[];
}

export interface LoopStepperModel {
  currentState: BuildModeState;
  currentStepId: LoopStepId;
  currentPinLabel: string;
  blocked: boolean;
  blockedFromState: Exclude<BuildModeState, 'blocked'> | null;
  loopBackTarget: 'prompt' | null;
  outcome: LoopOutcome;
  steps: LoopStep[];
  rendered: string;
}

const STEP_SEQUENCE: ReadonlyArray<{
  id: LoopStepId;
  label: string;
  states: readonly BuildModeState[];
}> = [
  { id: 'planning', label: 'Planning', states: ['planning'] },
  { id: 'requirements', label: 'Requirements', states: ['project_bootstrapped', 'requirements_ready'] },
  { id: 'prompt', label: 'Prompt', states: ['prompt_ready'] },
  { id: 'run', label: 'Run', states: ['awaiting_agent_output'] },
  { id: 'evaluate', label: 'Evaluate', states: ['evaluating'] },
  { id: 'outcome', label: 'Delta/Done', states: ['delta_required', 'done'] },
];

function getPinnedState(
  currentState: BuildModeState,
  blockedFromState?: Exclude<BuildModeState, 'blocked'>,
): Exclude<BuildModeState, 'blocked'> {
  if (currentState !== 'blocked') {
    return currentState;
  }
  if (!blockedFromState) {
    throw new Error('LOOP_STEPPER_BLOCKED_CONTEXT_REQUIRED');
  }
  return blockedFromState;
}

function stepIdForState(state: Exclude<BuildModeState, 'blocked'>): LoopStepId {
  const step = STEP_SEQUENCE.find((entry) => entry.states.includes(state));
  if (!step) {
    throw new Error(`LOOP_STEPPER_STATE_UNMAPPED:${state}`);
  }
  return step.id;
}

function labelForStep(
  stepId: LoopStepId,
  currentStepId: LoopStepId,
  pinnedState: Exclude<BuildModeState, 'blocked'>,
): string {
  if (stepId !== 'outcome') {
    const base = STEP_SEQUENCE.find((entry) => entry.id === stepId)?.label ?? stepId;
    return stepId === currentStepId ? `[${base}]` : base;
  }
  if (currentStepId !== 'outcome') {
    return 'Delta/Done';
  }
  return pinnedState === 'delta_required' ? '[Delta]/Done' : 'Delta/[Done]';
}

function statusForStep(index: number, currentIndex: number): LoopStepStatus {
  if (index < currentIndex) {
    return 'complete';
  }
  if (index === currentIndex) {
    return 'current';
  }
  return 'upcoming';
}

function outcomeForState(state: Exclude<BuildModeState, 'blocked'>): LoopOutcome {
  if (state === 'delta_required') {
    return 'delta';
  }
  if (state === 'done') {
    return 'done';
  }
  return null;
}

export function buildLoopStepperModel(input: {
  currentState: BuildModeState;
  blockedFromState?: Exclude<BuildModeState, 'blocked'>;
}): LoopStepperModel {
  const pinnedState = getPinnedState(input.currentState, input.blockedFromState);
  const currentStepId = stepIdForState(pinnedState);
  const currentIndex = STEP_SEQUENCE.findIndex((entry) => entry.id === currentStepId);
  const steps = STEP_SEQUENCE.map((entry, index) => ({
    id: entry.id,
    label: labelForStep(entry.id, currentStepId, pinnedState),
    status: statusForStep(index, currentIndex),
    states: entry.states,
  }));

  const rendered = steps.map((step) => step.label).join(' -> ');
  return {
    currentState: input.currentState,
    currentStepId,
    currentPinLabel: steps[currentIndex]?.label ?? '',
    blocked: input.currentState === 'blocked',
    blockedFromState: input.currentState === 'blocked' ? pinnedState : null,
    loopBackTarget: pinnedState === 'delta_required' ? 'prompt' : null,
    outcome: outcomeForState(pinnedState),
    steps,
    rendered: input.currentState === 'blocked' ? `${rendered} | BLOCKED` : rendered,
  };
}
