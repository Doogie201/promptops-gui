import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createOperatorConsoleSnapshot } from '../../apps/s09_gui_shell_v1.ts';
import { canonicalJson } from '../s08/continuity_packet.ts';
import { buildEvidenceRows, summarizeEvidence } from './evidence_viewer.ts';
import {
  autoSwitchAgent,
  buildNavigationSkeleton,
  buildResumePayload,
  cancelRun,
  createShellState,
  goBack,
  goForward,
  manualSwitchAgent,
  navigateTo,
  operatorConsolePanels,
  pauseRun,
  resumeRun,
  setSafeMode,
  startRun,
} from './shell_state.ts';
import {
  createWizardState,
  evaluateWizard,
  withPinnedTemplateAndTask,
  withPolicyConfig,
  withRepoConfig,
  withSprintPlaceholderValues,
  withSprintRequirements,
} from './setup_wizard.ts';
import type { VersionedPin, WizardState } from './types.ts';

const TEST_ROOT = '/tmp/promptops/S09/tests';

test('AT-S09-01 Setup wizard + navigation + run entry', () => {
  let wizard = readyWizard('2026-03-04T00:00:00Z');
  wizard = withSprintRequirements(
    wizard,
    JSON.stringify(
      {
        'Sprint Metadata': {
          'Sprint ID': 'S09-gui-shell-setup-wizard-agent-switching',
          Objective: 'GUI shell v1',
        },
        placeholders: ['[[PR_NUMBER]]'],
      },
      null,
      2,
    ),
  );

  const evalBeforePrompt = evaluateWizard(wizard);
  assert.strictEqual(evalBeforePrompt.promptRequired, true);
  assert.deepStrictEqual(evalBeforePrompt.sprintScopedPlaceholders, ['PR_NUMBER']);

  wizard = withSprintPlaceholderValues(wizard, { PR_NUMBER: '12' });
  const evalAfterPrompt = evaluateWizard(wizard);
  assert.strictEqual(evalAfterPrompt.readyForRun, true);

  const shell = createShellState(wizard);
  const started = startRun(shell, '2026-03-04T00:00:01Z');
  assert.ok(started.run);
  assert.strictEqual(started.run?.status, 'running');
  assert.strictEqual(started.run?.phase, 'agent_invocation');
  assert.strictEqual(started.wizard.config.templatePin?.version, 'template-v3');
  assert.strictEqual(started.wizard.config.taskPin?.version, 'task-v2');
  assert.ok(!String(started.run?.waitingReason ?? '').toLowerCase().includes('template'));

  const nav = buildNavigationSkeleton(started);
  assert.strictEqual(nav.length, 8);
  assert.deepStrictEqual(nav.map((item) => item.id), [
    'home',
    'run',
    'history',
    'evidence',
    'templates',
    'agents',
    'settings',
    'diagnostics',
  ]);

  const moved = navigateTo(started, 'history', started.run?.runId ?? null);
  const back = goBack(moved);
  const forward = goForward(back);
  assert.strictEqual(back.route.screen, 'run');
  assert.strictEqual(forward.route.screen, 'history');

  const evidenceRows = buildEvidenceRows([
    {
      id: 'r-1',
      command: 'git status --porcelain=v1 --branch',
      exitCode: 0,
      cwd: '/tmp/repo',
      stdoutPath: '/tmp/stdout-1.log',
      stderrPath: '/tmp/stderr-1.log',
      durablePath: 'docs/sprints/S09/evidence/EVD-S09-01/r-1.txt',
    },
    {
      id: 'r-2',
      command: 'npm run -s verify',
      exitCode: 1,
      cwd: '/tmp/repo',
      stdoutPath: '/tmp/stdout-2.log',
      stderrPath: '/tmp/stderr-2.log',
    },
  ]);
  const summary = summarizeEvidence(evidenceRows);
  assert.deepStrictEqual(summary, { total: 2, failed: 1, success: 1 });
  const snapshot = createOperatorConsoleSnapshot(started);
  assert.strictEqual(snapshot.nav.length, 8);
  assert.strictEqual(snapshot.runSummary.phase, 'agent_invocation');

  writeEvidence('AT-S09-01_run.json', {
    wizard_eval_before_prompt: evalBeforePrompt,
    wizard_eval_after_prompt: evalAfterPrompt,
    run_status: started.run,
    navigation: nav,
    route_back: back.route,
    route_forward: forward.route,
    panels: operatorConsolePanels(),
    ui_snapshot: snapshot,
    evidence_summary: summary,
  });
});

test('AT-S09-02 Manual and auto switch flows in UI model', () => {
  let shell = createShellState(wizardWithNoSprintPlaceholders());
  shell = startRun(shell, '2026-03-04T00:01:00Z');
  assert.strictEqual(shell.run?.currentAgent, 'codex');

  shell = manualSwitchAgent(shell, 'claude', 'MANUAL_SWITCH_OPERATOR', '2026-03-04T00:01:10Z');
  assert.strictEqual(shell.run?.currentAgent, 'claude');
  assert.strictEqual(shell.run?.checkpoints.length, 1);
  assert.strictEqual(shell.run?.checkpoints[0]?.checkpointId, 'checkpoint-01');
  assert.ok((shell.run?.checkpoints[0]?.continuitySha256 ?? '').length === 64);
  assert.ok(shell.run?.checkpoints[0]?.nextAgentFirstMessage.includes('continuity_sha256='));
  assert.ok(shell.run?.checkpoints[0]?.nextAgentFirstMessage.includes('do not redo evidenced work'));

  const switchedBack = manualSwitchAgent(shell, 'codex', 'MANUAL_SWITCH_BACK', '2026-03-04T00:01:20Z');
  assert.strictEqual(switchedBack.run?.checkpoints.length, 2);
  assert.notStrictEqual(
    switchedBack.run?.checkpoints[0]?.continuitySha256,
    switchedBack.run?.checkpoints[1]?.continuitySha256,
  );

  const auto = autoSwitchAgent(switchedBack, 'exhausted', '2026-03-04T00:01:30Z');
  assert.strictEqual(auto.run?.lastAutoSwitchReason, 'AUTO_SWITCH_EXHAUSTED');

  writeEvidence('AT-S09-02_run.json', {
    sequence_after_manual: shell.run?.adapterSequence,
    checkpoints_after_manual: shell.run?.checkpoints,
    sequence_after_auto: auto.run?.adapterSequence,
    last_auto_switch_reason: auto.run?.lastAutoSwitchReason,
  });
});

test('blocks run until all sprint placeholders are resolved', () => {
  let wizard = readyWizard('2026-03-04T00:00:00Z');
  wizard = withSprintRequirements(
    wizard,
    JSON.stringify({
      'Sprint Metadata': { 'Sprint ID': 'S09-gui-shell-setup-wizard-agent-switching' },
      placeholders: ['[[PR_NUMBER]]', '[[SPRINT_BRANCH]]'],
    }),
  );
  wizard = withSprintPlaceholderValues(wizard, { PR_NUMBER: '13' });
  const partialEval = evaluateWizard(wizard);
  assert.strictEqual(partialEval.promptRequired, true);
  assert.strictEqual(partialEval.readyForRun, false);
  assert.deepStrictEqual(partialEval.sprintScopedPlaceholders, ['SPRINT_BRANCH']);

  const blocked = startRun(createShellState(wizard), '2026-03-04T00:00:40Z');
  assert.strictEqual(blocked.run?.status, 'paused');
  assert.strictEqual(blocked.run?.phase, 'wizard');
  assert.match(blocked.run?.waitingReason ?? '', /Wizard prerequisites incomplete/);
});

test('AT-S09-03 Cancel + resume determinism', () => {
  let shell = createShellState(wizardWithNoSprintPlaceholders());
  shell = startRun(shell, '2026-03-04T00:02:00Z');
  shell = manualSwitchAgent(shell, 'claude', 'MANUAL_SWITCH_OPERATOR', '2026-03-04T00:02:05Z');
  shell = pauseRun(shell, 'operator_pause', '2026-03-04T00:02:10Z');
  shell = setSafeMode(shell, true, '2026-03-04T00:02:11Z');
  shell = setSafeMode(shell, false, '2026-03-04T00:02:12Z');
  assert.strictEqual(shell.run?.phase, 'agent_invocation');
  assert.strictEqual(shell.run?.waitingReason, null);

  const cancelled = cancelRun(shell, 'operator_cancel', '2026-03-04T00:02:20Z');
  assert.strictEqual(cancelled.run?.status, 'cancelled');

  const payloadA = canonicalJson(buildResumePayload(cancelled));
  const payloadB = canonicalJson(buildResumePayload(cancelled));
  assert.strictEqual(payloadA, payloadB);

  const resumed = resumeRun(cancelled, '2026-03-04T00:02:30Z');
  assert.strictEqual(resumed.run?.status, 'running');
  assert.strictEqual(resumed.run?.lastCheckpointId, cancelled.run?.lastCheckpointId);
  assert.strictEqual(resumed.run?.phase, 'agent_invocation');
  assert.ok(isMonotonicEventIds(resumed.run?.timeline.map((item) => item.eventId) ?? []));

  writeEvidence('AT-S09-03_run.json', {
    cancelled_status: cancelled.run?.status,
    resume_payload_a: JSON.parse(payloadA),
    resume_payload_b: JSON.parse(payloadB),
    payload_identical: payloadA === payloadB,
    resumed_status: resumed.run?.status,
    resumed_checkpoint: resumed.run?.lastCheckpointId,
    timeline_ids: resumed.run?.timeline.map((item) => item.eventId),
  });
});

function readyWizard(nowIso: string): WizardState {
  const templatePin = makePin('template.s09.shell', 'template-v3', nowIso);
  const taskPin = makePin('task.s09.shell', 'task-v2', nowIso);
  return withPinnedTemplateAndTask(
    withPolicyConfig(
      withRepoConfig(createWizardState(nowIso), {
        owner: 'Doogie201',
        name: 'promptops-gui',
        baseBranch: 'main',
        rootStrategy: 'env:PROMPTOPS_REPO',
      }),
      {
        whitelist: ['apps/**', 'src/**', 'docs/sprints/S09/**', '/tmp/**'],
        budgets: { max_net_new_lines: 120, max_function_len: 80 },
        autoSwitch: true,
        manualSwitch: true,
        agentOrder: ['codex', 'claude'],
      },
    ),
    templatePin,
    taskPin,
  );
}

function wizardWithNoSprintPlaceholders(): WizardState {
  return withSprintRequirements(
    readyWizard('2026-03-04T00:00:00Z'),
    JSON.stringify({ 'Sprint Metadata': { 'Sprint ID': 'S09-gui-shell-setup-wizard-agent-switching' } }),
  );
}

function makePin(id: string, version: string, nowIso: string): VersionedPin {
  return {
    id,
    version,
    edits: [`pin:${version}`],
    updated_at: nowIso,
  };
}

function writeEvidence(fileName: string, payload: Record<string, unknown>): void {
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  fs.writeFileSync(path.join(TEST_ROOT, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function isMonotonicEventIds(ids: string[]): boolean {
  let previous = 0;
  for (const id of ids) {
    const numeric = Number(id.replace('evt-', ''));
    if (!Number.isFinite(numeric) || numeric <= previous) return false;
    previous = numeric;
  }
  return true;
}
