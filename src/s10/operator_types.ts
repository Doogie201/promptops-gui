export type ToolStatus = 'PASS' | 'FAIL' | 'HARD_STOP';

export type HardStopCode =
  | 'NONE'
  | 'MISSING_REPO_ROOT'
  | 'REPO_ROOT_MISMATCH'
  | 'REPO_ROOT_NOT_ON_MAIN_NOT_SYNCED'
  | 'GIT_OBJECT_INTEGRITY'
  | 'UNRELATED_OPEN_PRS'
  | 'PR_NOT_READY'
  | 'WHITELIST_VIOLATION'
  | 'OUT_OF_SYNC'
  | 'BUDGET_BREACH';

export interface CommandSpec {
  id: string;
  command: string;
  args: string[];
}

export interface CommandRecord {
  id: string;
  cmd: string;
  cwd: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  start_ts: string;
  end_ts: string;
  stdout_path: string;
  stderr_path: string;
}

export interface ToolRunContext {
  sprintId: string;
  tool: string;
  runId: string;
  timestamp: string;
  repoRoot: string;
  stagingRoot: string;
  durableRoot: string;
  bundleRoot: string;
  continuityHash: string;
}

export interface ToolResult {
  tool: string;
  status: ToolStatus;
  reasonCode: HardStopCode;
  message: string;
  receiptPaths: Record<string, string>;
  summary: Record<string, unknown>;
}

export interface ToolOptions {
  sprintId: string;
  runId: string;
  timestamp?: string;
  repoRoot: string;
  stagingBase: string;
  durableBase: string;
}

export type CommandRunner = (
  spec: CommandSpec,
  cwd: string,
  env: Record<string, string>,
  outStdPath: string,
  outErrPath: string,
) => Omit<CommandRecord, 'id' | 'cmd' | 'cwd' | 'stdout_path' | 'stderr_path'>;
