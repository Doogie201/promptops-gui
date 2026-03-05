export type ActionStatus = 'PASS' | 'FAIL' | 'HARD_STOP';

export type RepoRootStrategy = 'explicit_arg' | 'env_PROMPTOPS_REPO' | 'unresolved';

export type DashboardActionId = 'preflight' | 'gates' | 'pr_inventory' | 'run_status';

export interface ActionRequestEnvelope {
  action: DashboardActionId;
  requestId: string;
  args: Record<string, string>;
  repoRootStrategy: RepoRootStrategy;
}

export interface ReceiptSummary {
  id: string;
  cmd: string;
  exitCode: number;
  stdoutPath: string;
  stderrPath: string;
}

export interface ActionResponseEnvelope<TData> {
  action: DashboardActionId;
  request: ActionRequestEnvelope;
  status: ActionStatus;
  reasonCode: string;
  message: string;
  data: TData;
  receipts: ReceiptSummary[];
  receiptPaths: Record<string, string>;
  durableBundlePath: string | null;
  exitCode: number;
  resultHash: string;
}

export interface PreflightData {
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
}

export interface GatesData {
  failedCount: number;
}

export interface PrInventoryData {
  openCount: number;
  candidatePr: number | null;
  unresolvedThreadsAfter: number;
}

export interface RunStatusData {
  signalCount: number;
  diagnosisPath: string | null;
}

export interface OperatorApiFacade {
  runPreflight(args?: Record<string, string>): Promise<ActionResponseEnvelope<PreflightData>>;
  runGates(args?: Record<string, string>): Promise<ActionResponseEnvelope<GatesData>>;
  listOpenPrs(args?: Record<string, string>): Promise<ActionResponseEnvelope<PrInventoryData>>;
  getRunStatus(args?: Record<string, string>): Promise<ActionResponseEnvelope<RunStatusData>>;
}
