import { assertDeltaReviewReadyForDispatch, type DeltaReviewModel } from './delta_review.ts';
import { BuildModeStateMachine, type BuildModeState } from './state_machine.ts';

export type EvaluationVerdict = 'complete' | 'delta' | 'needs_input';

export function applyEvaluationVerdict(
  machine: BuildModeStateMachine,
  verdict: EvaluationVerdict,
): BuildModeState {
  if (machine.currentState !== 'evaluating') {
    throw new Error(`Expected evaluating state, got ${machine.currentState}`);
  }

  if (verdict === 'complete') {
    machine.transition('done');
    return machine.currentState;
  }

  if (verdict === 'delta') {
    machine.transition('delta_required');
    return machine.currentState;
  }

  machine.transition('blocked');
  return machine.currentState;
}

export function dispatchPromptWithDeltaReview(
  machine: BuildModeStateMachine,
  review: DeltaReviewModel,
): BuildModeState {
  if (machine.currentState !== 'prompt_ready') {
    throw new Error(`Expected prompt_ready state, got ${machine.currentState}`);
  }

  assertDeltaReviewReadyForDispatch(review);
  machine.transition('awaiting_agent_output');
  return machine.currentState;
}
