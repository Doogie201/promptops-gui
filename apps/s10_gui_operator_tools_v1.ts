import type { ShellState } from '../src/s09/types.ts';
import type { ToolResult } from '../src/s10/operator_types.ts';

export interface OperatorToolCard {
  id: string;
  title: string;
  status: ToolResult['status'] | 'IDLE';
  reasonCode: string;
  message: string;
  continuityHash: string | null;
}

export interface OperatorToolsSnapshot {
  nav: {
    section: 'Operator Tools';
    items: string[];
  };
  guardrail: {
    wizardRoot: string;
    promptopsRepo: string;
    matches: boolean;
    blocked: boolean;
    remediation: string;
  };
  runTimelineState: 'STARTED' | 'RUNNING' | 'STOPPED';
  cards: OperatorToolCard[];
}

const TOOL_ORDER = [
  ['preflight', 'Preflight'],
  ['pr_protocol', 'PR Protocol'],
  ['gates', 'Gates'],
  ['diff', 'Diff Review'],
  ['out_of_sync', 'Out-of-sync'],
  ['closeout', 'Closeout'],
] as const;

export function createOperatorToolsSnapshot(
  shell: ShellState,
  wizardConfiguredRoot: string,
  promptopsRepo: string,
  toolResults: ToolResult[],
): OperatorToolsSnapshot {
  const matches = normalizePath(wizardConfiguredRoot) === normalizePath(promptopsRepo);
  const cards = TOOL_ORDER.map(([id, title]) => mapCard(id, title, toolResults.find((item) => item.tool === id)));
  return {
    nav: {
      section: 'Operator Tools',
      items: TOOL_ORDER.map(([, title]) => title),
    },
    guardrail: {
      wizardRoot: wizardConfiguredRoot,
      promptopsRepo,
      matches,
      blocked: !matches,
      remediation: matches
        ? 'Root configuration is aligned.'
        : 'Update Setup Wizard repo root to PROMPTOPS_REPO before running tools.',
    },
    runTimelineState: resolveTimelineState(shell, cards),
    cards,
  };
}

function mapCard(id: string, title: string, result: ToolResult | undefined): OperatorToolCard {
  if (!result) {
    return {
      id,
      title,
      status: 'IDLE',
      reasonCode: 'NONE',
      message: 'Not run yet.',
      continuityHash: null,
    };
  }
  return {
    id,
    title,
    status: result.status,
    reasonCode: result.reasonCode,
    message: result.message,
    continuityHash: String(result.summary.continuity_hash ?? ''),
  };
}

function resolveTimelineState(shell: ShellState, cards: OperatorToolCard[]): 'STARTED' | 'RUNNING' | 'STOPPED' {
  const hasRun = cards.some((card) => card.status !== 'IDLE');
  if (!hasRun) return 'STARTED';
  const hasStop = cards.some((card) => card.status === 'HARD_STOP' || card.status === 'FAIL');
  if (hasStop || shell.run?.status === 'completed' || shell.run?.status === 'cancelled') return 'STOPPED';
  return 'RUNNING';
}

function normalizePath(value: string): string {
  return value.trim().replace(/\/+$/, '');
}
