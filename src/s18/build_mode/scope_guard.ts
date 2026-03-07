import { stableHash } from './hash.ts';

export type ScopeGuardStatus = 'in_scope' | 'out_of_scope';
export type ScopeChangeRequestStatus =
  | 'not_required'
  | 'missing'
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'partial';

export interface ScopeChangeRequestArtifact {
  change_id: string;
  requested_by: string;
  reason: string;
  impact_on_scope: string;
  files_affected: string[];
  risk_level: 'low' | 'med' | 'high';
  approval_decision: 'approved' | 'pending' | 'rejected';
}

export interface ScopeGuardEntry {
  path: string;
  inScope: boolean;
  matchedRule: string | null;
  rendered: string;
}

export interface ScopeGuardModel {
  status: ScopeGuardStatus;
  requestedPaths: string[];
  outOfScopePaths: string[];
  entries: ScopeGuardEntry[];
  scopeChangeRequestStatus: ScopeChangeRequestStatus;
  scopeChangeRequestId: string | null;
  scopeChangeRequired: boolean;
  dispatchAllowed: boolean;
  summary: string;
  rendered: string;
  sha256: string;
}

function matchesPathPattern(filePath: string, pattern: string): boolean {
  if (pattern.endsWith('/**')) {
    return filePath.startsWith(pattern.slice(0, -3));
  }
  return filePath === pattern;
}

function normalizePaths(paths: readonly string[]): string[] {
  return [...new Set(paths.map((value) => value.trim()).filter(Boolean))].sort();
}

function resolveMatchedRule(filePath: string, allowedPaths: readonly string[]): string | null {
  return allowedPaths.find((pattern) => matchesPathPattern(filePath, pattern)) ?? null;
}

function buildEntries(
  requestedPaths: readonly string[],
  allowedPaths: readonly string[],
): ScopeGuardEntry[] {
  return requestedPaths.map((filePath) => {
    const matchedRule = resolveMatchedRule(filePath, allowedPaths);
    const inScope = matchedRule !== null;
    const rendered = inScope
      ? `IN ${filePath} <= ${matchedRule}`
      : `OUT ${filePath} <= NO_MATCH`;

    return {
      path: filePath,
      inScope,
      matchedRule,
      rendered,
    };
  });
}

function resolveScopeChangeRequestStatus(
  outOfScopePaths: readonly string[],
  scopeChangeRequest?: ScopeChangeRequestArtifact,
): ScopeChangeRequestStatus {
  if (outOfScopePaths.length === 0) {
    return 'not_required';
  }
  if (!scopeChangeRequest) {
    return 'missing';
  }
  if (scopeChangeRequest.approval_decision === 'rejected') {
    return 'rejected';
  }
  if (scopeChangeRequest.approval_decision === 'pending') {
    return 'pending';
  }

  const coveredPaths = normalizePaths(scopeChangeRequest.files_affected);
  const coversAll = outOfScopePaths.every((filePath) =>
    coveredPaths.some((pattern) => matchesPathPattern(filePath, pattern)),
  );
  return coversAll ? 'approved' : 'partial';
}

function summarizeScopeGuard(input: {
  requestedPaths: readonly string[];
  outOfScopePaths: readonly string[];
  scopeChangeRequestStatus: ScopeChangeRequestStatus;
  scopeChangeRequestId: string | null;
}): string {
  if (input.requestedPaths.length === 0) {
    return 'No planned paths declared; dispatch blocked until scope is explicit';
  }
  if (input.outOfScopePaths.length === 0) {
    return `All ${input.requestedPaths.length} planned path(s) are in scope`;
  }
  if (input.scopeChangeRequestStatus === 'approved') {
    return `Out-of-scope paths covered by approved SCR ${input.scopeChangeRequestId ?? 'UNKNOWN'}`;
  }
  return `${input.outOfScopePaths.length} out-of-scope path(s) require approved SCR`;
}

function renderScopeGuard(model: Omit<ScopeGuardModel, 'rendered' | 'sha256'>): string {
  const lines = [`Scope guard: ${model.status === 'in_scope' ? 'IN SCOPE' : 'OUT OF SCOPE'}`];
  lines.push(`Summary: ${model.summary}`);
  lines.push(`SCR: ${model.scopeChangeRequestStatus}${model.scopeChangeRequestId ? ` (${model.scopeChangeRequestId})` : ''}`);
  if (model.entries.length === 0) {
    lines.push('Paths: none declared');
  } else {
    lines.push(...model.entries.map((entry) => `- ${entry.rendered}`));
  }
  return lines.join('\n');
}

export function buildScopeGuardModel(input: {
  requestedPaths: readonly string[];
  allowedPaths: readonly string[];
  scopeChangeRequest?: ScopeChangeRequestArtifact;
}): ScopeGuardModel {
  const requestedPaths = normalizePaths(input.requestedPaths);
  const allowedPaths = normalizePaths(input.allowedPaths);
  const entries = buildEntries(requestedPaths, allowedPaths);
  const outOfScopePaths = entries.filter((entry) => !entry.inScope).map((entry) => entry.path);
  const scopeChangeRequestStatus = resolveScopeChangeRequestStatus(outOfScopePaths, input.scopeChangeRequest);
  const scopeChangeRequestId = input.scopeChangeRequest?.change_id ?? null;
  const status: ScopeGuardStatus =
    requestedPaths.length > 0 && outOfScopePaths.length === 0 ? 'in_scope' : 'out_of_scope';
  const scopeChangeRequired = outOfScopePaths.length > 0;
  const dispatchAllowed =
    requestedPaths.length > 0 && (outOfScopePaths.length === 0 || scopeChangeRequestStatus === 'approved');
  const summary = summarizeScopeGuard({
    requestedPaths,
    outOfScopePaths,
    scopeChangeRequestStatus,
    scopeChangeRequestId,
  });
  const base = {
    status,
    requestedPaths,
    outOfScopePaths,
    entries,
    scopeChangeRequestStatus,
    scopeChangeRequestId,
    scopeChangeRequired,
    dispatchAllowed,
    summary,
  };

  return {
    ...base,
    rendered: renderScopeGuard(base),
    sha256: stableHash(base),
  };
}

export function assertScopeGuardReadyForDispatch(model: ScopeGuardModel): void {
  if (!model.dispatchAllowed) {
    throw new Error('SCOPE_GUARD_DISPATCH_BLOCKED');
  }
}
