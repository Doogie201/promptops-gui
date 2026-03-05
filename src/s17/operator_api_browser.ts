import type {
  ActionResponseEnvelope,
  DashboardActionId,
  GatesData,
  OperatorApiFacade,
  PreflightData,
  PrInventoryData,
  RunStatusData,
} from './contracts.ts';

const BRIDGE_ERROR =
  'Operator execution bridge is not configured in browser-only mode. Use the Node façade in tests/automation.';

export function createBrowserOperatorApi(): OperatorApiFacade {
  return {
    runPreflight: (args = {}) =>
      Promise.resolve(
        blockedEnvelope<PreflightData>('preflight', args, {
          branch: 'unknown',
          dirty: true,
          ahead: 0,
          behind: 0,
        }),
      ),
    runGates: (args = {}) => Promise.resolve(blockedEnvelope<GatesData>('gates', args, { failedCount: 1 })),
    listOpenPrs: (args = {}) =>
      Promise.resolve(
        blockedEnvelope<PrInventoryData>('pr_inventory', args, {
          openCount: 0,
          candidatePr: null,
          unresolvedThreadsAfter: 0,
        }),
      ),
    getRunStatus: (args = {}) =>
      Promise.resolve(blockedEnvelope<RunStatusData>('run_status', args, { signalCount: 0, diagnosisPath: null })),
  };
}

function blockedEnvelope<TData>(
  action: DashboardActionId,
  args: Record<string, string>,
  data: TData,
): ActionResponseEnvelope<TData> {
  const requestId = args.requestId ?? `${action}_browser_blocked`;
  return {
    action,
    request: {
      action,
      requestId,
      args,
      repoRootStrategy: 'unresolved',
    },
    status: 'HARD_STOP',
    reasonCode: 'MISSING_REPO_ROOT',
    message: BRIDGE_ERROR,
    data,
    receipts: [],
    receiptPaths: {},
    durableBundlePath: null,
    exitCode: 1,
    resultHash: `${action}:browser_blocked`,
  };
}
