import { buildNavigationSkeleton, operatorConsolePanels } from '../src/s09/shell_state.ts';
import type { ShellState } from '../src/s09/types.ts';

export interface OperatorConsoleSnapshot {
  nav: Array<{ id: string; active: boolean; label: string }>;
  panels: Record<string, string>;
  runSummary: {
    runId: string | null;
    phase: string | null;
    currentAgent: string | null;
    continuityHash: string | null;
    waitingReason: string | null;
  };
}

export function createOperatorConsoleSnapshot(state: ShellState): OperatorConsoleSnapshot {
  return {
    nav: buildNavigationSkeleton(state),
    panels: operatorConsolePanels(),
    runSummary: {
      runId: state.run?.runId ?? null,
      phase: state.run?.phase ?? null,
      currentAgent: state.run?.currentAgent ?? null,
      continuityHash: state.run?.continuityHash ?? null,
      waitingReason: state.run?.waitingReason ?? null,
    },
  };
}
