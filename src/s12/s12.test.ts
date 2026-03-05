import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildAuditFlags,
  buildDiagnosticsDashboardModel,
  actionsForSignal,
  buildCheckpointDiff,
  buildContinuityPacketHash,
  buildEvidenceRef,
  buildSafeModeDiagnosis,
  computeRetryDecision,
  createAdapterDownSignal,
  detectLedgerInconsistent,
  detectLoopStuck,
  detectRepoDrift,
  detectTemplateDrift,
  detectWorktreeDrift,
  restoreSnapshotCheckpoint,
  type LedgerSnapshot,
  type LoopObservation,
  type RepoStateSnapshot,
  type TemplatePinSnapshot,
} from './health_drift.ts';

const ROOT = '/tmp/promptops/S12';
const TEST_EVIDENCE = path.join(ROOT, 'tests');
const DRIFT_EVIDENCE = path.join(ROOT, 'drift');
const ADAPTER_EVIDENCE = path.join(ROOT, 'adapters');
const DIAGNOSE_EVIDENCE = path.join(ROOT, 'diagnose');

prepareEvidenceRoot();

test('AT-S12-01 emits repo drift and restores stable checkpoint deterministically', () => {
  const before: RepoStateSnapshot = {
    branch: 'main',
    statusSummary: '## main...origin/main',
    ahead: 0,
    behind: 0,
    headSha: '1111111111111111111111111111111111111111',
    repoRoot: '/repo',
    primaryWorktree: '/repo',
  };
  const drifted: RepoStateSnapshot = {
    ...before,
    statusSummary: '## main...origin/main\n M src/s12/health_drift.ts',
    headSha: '2222222222222222222222222222222222222222',
  };
  const driftSignal = detectRepoDrift(before, drifted, 100, [buildEvidenceRef('/tmp/promptops/S12/drift/repo_delta.json', { before, drifted })]);

  assert.ok(driftSignal);
  assert.strictEqual(driftSignal.signalId, 'REPO_DRIFT');
  const actions = actionsForSignal('REPO_DRIFT', true);
  assert.ok(actions.some((item) => item.id === 'restore_last_checkpoint'));
  assert.ok(actions.some((item) => item.id === 're_run_preflight_full'));

  const restored = restoreSnapshotCheckpoint(before);
  const afterSignal = detectRepoDrift(before, restored, 101, []);
  assert.strictEqual(afterSignal, null);

  const delta = buildCheckpointDiff(before, drifted);
  assert.ok(delta.some((item) => item.field === 'statusSummary'));

  writeJson(path.join(DRIFT_EVIDENCE, 'AT-S12-01_repo_drift.json'), {
    before,
    drifted,
    drift_signal: driftSignal,
    restoration_actions: actions,
    post_restore_signal: afterSignal,
    delta,
  });
  writeJson(path.join(TEST_EVIDENCE, 'AT-S12-01_run.json'), {
    result: 'PASS',
    signal_id: driftSignal.signalId,
    signal_severity: driftSignal.severity,
    restored_stable: afterSignal === null,
  });
});

test('AT-S12-02 emits adapter down, applies bounded retries, then auto-switches deterministically', () => {
  const adapterDown = createAdapterDownSignal('codex', 'process_exit_137', 200, [
    buildEvidenceRef('/tmp/promptops/S12/adapters/codex_stderr.log', { error: 'process_exit_137' }),
  ]);
  assert.strictEqual(adapterDown.signalId, 'ADAPTER_DOWN');

  const retry1 = computeRetryDecision({
    currentAgent: 'codex',
    secondaryAgent: 'claude',
    failureCount: 0,
    autoSwitchEnabled: true,
  });
  const retry2 = computeRetryDecision({
    currentAgent: 'codex',
    secondaryAgent: 'claude',
    failureCount: 1,
    autoSwitchEnabled: true,
  });
  const switchDecision = computeRetryDecision({
    currentAgent: 'codex',
    secondaryAgent: 'claude',
    failureCount: 3,
    autoSwitchEnabled: true,
  });

  assert.strictEqual(retry1.action, 'retry');
  assert.strictEqual(retry2.action, 'retry');
  assert.strictEqual(switchDecision.action, 'switch_agent');
  assert.strictEqual(switchDecision.targetAgent, 'claude');

  const continuityA = buildContinuityPacketHash('run-s12-001', 'codex', 'claude', 'cp-001', switchDecision.reason, ['done_1']);
  const continuityB = buildContinuityPacketHash('run-s12-001', 'codex', 'claude', 'cp-001', switchDecision.reason, ['done_1']);
  assert.strictEqual(continuityA, continuityB);

  writeJson(path.join(ADAPTER_EVIDENCE, 'AT-S12-02_adapter_switch.json'), {
    adapter_down_signal: adapterDown,
    retry1,
    retry2,
    switch_decision: switchDecision,
    continuity_hash: continuityA,
  });
  writeJson(path.join(TEST_EVIDENCE, 'AT-S12-02_run.json'), {
    result: 'PASS',
    adapter_down: adapterDown.signalId,
    auto_switch_target: switchDecision.targetAgent,
    continuity_hash: continuityA,
  });
});

test('AT-S12-03 emits hard-stop template drift and recovers after restore', () => {
  const missingPin: TemplatePinSnapshot = {
    sprintId: 'S12-health-drift-detection',
    runId: 'run-s12-003',
    pinnedVersionId: 'v5',
    expectedTemplateHash: 'abc123',
    pinnedTemplateExists: false,
  };

  const drift = detectTemplateDrift(missingPin, 300, [
    buildEvidenceRef('/tmp/promptops/S12/drift/template_pin_missing.json', missingPin),
  ]);

  assert.ok(drift);
  assert.strictEqual(drift.signalId, 'TEMPLATE_DRIFT');
  assert.strictEqual(drift.hardFail, true);

  const restoredPin: TemplatePinSnapshot = {
    ...missingPin,
    pinnedTemplateExists: true,
    pinnedTemplateHash: 'abc123',
  };
  const afterRestore = detectTemplateDrift(restoredPin, 301, []);
  assert.strictEqual(afterRestore, null);

  writeJson(path.join(DRIFT_EVIDENCE, 'AT-S12-03_template_restore.json'), {
    missing_pin: missingPin,
    drift_signal: drift,
    restored_pin: restoredPin,
    post_restore_signal: afterRestore,
  });
  writeJson(path.join(TEST_EVIDENCE, 'AT-S12-03_run.json'), {
    result: 'PASS',
    hard_stop_signal: drift.signalId,
    hard_stop: drift.hardFail,
    resumed_after_restore: afterRestore === null,
  });
});

test('AT-S12-04 safe mode diagnosis is deterministic and blocks agent invocation', () => {
  const repoBaseline: RepoStateSnapshot = {
    branch: 'main',
    statusSummary: '## main...origin/main',
    ahead: 0,
    behind: 0,
    headSha: '3333333333333333333333333333333333333333',
    repoRoot: '/repo',
    primaryWorktree: '/repo',
  };
  const repoDrifted: RepoStateSnapshot = {
    ...repoBaseline,
    statusSummary: '## main...origin/main\n M docs/sprints/S12/evidence/INDEX.md',
  };
  const repoSignal = detectRepoDrift(repoBaseline, repoDrifted, 400, [
    buildEvidenceRef('/tmp/promptops/S12/diagnose/repo_signal.json', repoDrifted),
  ]);
  assert.ok(repoSignal);

  const ledgerBefore: LedgerSnapshot = {
    requirementIds: ['REQ-1', 'REQ-2'],
    doneLedgerCitations: { 'REQ-1': ['evidence/a.json'], 'REQ-2': ['evidence/b.json'] },
    hasRequirementsUpdateEvent: true,
  };
  const ledgerAfter: LedgerSnapshot = {
    requirementIds: ['REQ-1', 'REQ-9'],
    doneLedgerCitations: { 'REQ-1': ['evidence/a.json'], 'REQ-2': [] },
    hasRequirementsUpdateEvent: false,
  };
  const ledgerSignal = detectLedgerInconsistent(ledgerBefore, ledgerAfter, 401, [
    buildEvidenceRef('/tmp/promptops/S12/diagnose/ledger_signal.json', ledgerAfter),
  ]);
  assert.ok(ledgerSignal);

  const loopSignal = detectLoopStuck(
    [
      { signalSet: ['ADAPTER_DOWN', 'REPO_DRIFT'], deltaFingerprint: 'same' },
      { signalSet: ['ADAPTER_DOWN', 'REPO_DRIFT'], deltaFingerprint: 'same' },
      { signalSet: ['ADAPTER_DOWN', 'REPO_DRIFT'], deltaFingerprint: 'same' },
    ] satisfies LoopObservation[],
    402,
    [buildEvidenceRef('/tmp/promptops/S12/diagnose/loop_signal.json', { repeat: 3 })],
    3,
  );
  assert.ok(loopSignal);

  const diagnosisA = buildSafeModeDiagnosis({
    runId: 'run-s12-004',
    activeSignals: [repoSignal, ledgerSignal, loopSignal],
    lastKnownCheckpointId: 'cp-004',
    allowedActions: actionsForSignal('REPO_DRIFT', true),
    evidenceRefs: [
      buildEvidenceRef('/tmp/promptops/S12/diagnose/report_input.json', {
        repoSignal,
        ledgerSignal,
        loopSignal,
      }),
    ],
    agentInvocationEvents: [],
  });

  const diagnosisB = buildSafeModeDiagnosis({
    runId: 'run-s12-004',
    activeSignals: [repoSignal, ledgerSignal, loopSignal],
    lastKnownCheckpointId: 'cp-004',
    allowedActions: actionsForSignal('REPO_DRIFT', true),
    evidenceRefs: [
      buildEvidenceRef('/tmp/promptops/S12/diagnose/report_input.json', {
        repoSignal,
        ledgerSignal,
        loopSignal,
      }),
    ],
    agentInvocationEvents: [],
  });

  assert.strictEqual(diagnosisA.reportHash, diagnosisB.reportHash);
  assert.strictEqual(diagnosisA.safeModeCompliant, true);

  const violatingDiagnosis = buildSafeModeDiagnosis({
    runId: 'run-s12-004',
    activeSignals: [repoSignal],
    lastKnownCheckpointId: 'cp-004',
    allowedActions: actionsForSignal('REPO_DRIFT', true),
    evidenceRefs: [],
    agentInvocationEvents: ['agent_invoked:codex'],
  });
  assert.strictEqual(violatingDiagnosis.safeModeCompliant, false);

  const worktreeSignal = detectWorktreeDrift('/repo', '/unexpected', 403, [
    buildEvidenceRef('/tmp/promptops/S12/diagnose/worktree_signal.json', { expected: '/repo', current: '/unexpected' }),
  ], false);
  assert.ok(worktreeSignal?.hardFail);

  const dashboard = buildDiagnosticsDashboardModel(
    [repoSignal, ledgerSignal, loopSignal, worktreeSignal],
    buildCheckpointDiff(repoBaseline, repoDrifted),
    true,
    {
      protectedOverrideUsed: true,
      repeatedFailures: 2,
      manualAgentSwitches: 1,
      scopeIncidents: 0,
    },
  );
  const auditFlags = buildAuditFlags({
    protectedOverrideUsed: true,
    repeatedFailures: 2,
    manualAgentSwitches: 1,
    scopeIncidents: 0,
  });
  assert.strictEqual(dashboard.status, 'FAIL');
  assert.ok(dashboard.timelineDeltas.length > 0);
  assert.ok(dashboard.actionsBySignal.REPO_DRIFT.some((item) => item.id === 'restore_last_checkpoint'));
  assert.ok(auditFlags.includes('PROTECTED_TEMPLATE_OVERRIDE_USED'));

  writeJson(path.join(DIAGNOSE_EVIDENCE, 'AT-S12-04_safe_mode_report.json'), {
    diagnosis_a: diagnosisA,
    diagnosis_b: diagnosisB,
    violating_diagnosis: violatingDiagnosis,
    loop_signal: loopSignal,
    worktree_signal: worktreeSignal,
    dashboard,
    audit_flags: auditFlags,
  });
  writeJson(path.join(TEST_EVIDENCE, 'AT-S12-04_run.json'), {
    result: 'PASS',
    deterministic_hash: diagnosisA.reportHash,
    safe_mode_compliant: diagnosisA.safeModeCompliant,
    violation_detected: violatingDiagnosis.violations,
  });
});

function prepareEvidenceRoot(): void {
  for (const dir of [TEST_EVIDENCE, DRIFT_EVIDENCE, ADAPTER_EVIDENCE, DIAGNOSE_EVIDENCE]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
