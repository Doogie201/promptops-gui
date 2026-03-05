import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  renderNarration,
  renderNarrationText,
  DEFAULT_SETTINGS,
  type NarrationEvent,
  type NarrationSettings,
  type NarrationLine,
} from '../src/s14/narration.ts';
import {
  computeDashboard,
  renderDashboardText,
  getDashboardStyles,
  type DashboardState,
} from '../src/s14/dashboard.ts';

const EVIDENCE_ROOT = '/tmp/promptops/S14';
const JARVIS_DIR = path.join(EVIDENCE_ROOT, 'jarvis');
const UI_DIR = path.join(EVIDENCE_ROOT, 'ui');
const A11Y_DIR = path.join(EVIDENCE_ROOT, 'a11y');

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// ── Fixed test event stream ───────────────────────────────────

const TEST_EVENTS: NarrationEvent[] = [
  { seq: 1, phase: 'preflight', type: 'phase_start' },
  { seq: 2, phase: 'preflight', type: 'checkpoint', checkpointId: 'cp-001' },
  { seq: 3, phase: 'preflight', type: 'phase_end' },
  { seq: 4, phase: 'intake', type: 'phase_start' },
  { seq: 5, phase: 'intake', type: 'evidence_collected', evidenceCount: 1 },
  { seq: 6, phase: 'intake', type: 'phase_end' },
  { seq: 7, phase: 'agent_invocation', type: 'phase_start', agent: 'codex' },
  { seq: 8, phase: 'agent_invocation', type: 'evidence_collected', evidenceCount: 2 },
  { seq: 9, phase: 'agent_invocation', type: 'checkpoint', checkpointId: 'cp-002' },
  { seq: 10, phase: 'switching', type: 'agent_switch_auto', agent: 'claude', reason: 'context exhausted' },
  { seq: 11, phase: 'switching', type: 'phase_start' },
  { seq: 12, phase: 'switching', type: 'phase_end' },
  { seq: 13, phase: 'agent_invocation', type: 'phase_end' },
  { seq: 14, phase: 'evidence', type: 'phase_start' },
  { seq: 15, phase: 'evidence', type: 'evidence_collected', evidenceCount: 5 },
  { seq: 16, phase: 'evidence', type: 'phase_end' },
  { seq: 17, phase: 'gates', type: 'phase_start' },
  { seq: 18, phase: 'gates', type: 'gate_pass', detail: 'build' },
  { seq: 19, phase: 'gates', type: 'gate_pass', detail: 'test' },
  { seq: 20, phase: 'gates', type: 'gate_pass', detail: 'lint' },
  { seq: 21, phase: 'gates', type: 'phase_end' },
  { seq: 22, phase: 'closeout', type: 'phase_start' },
  { seq: 23, phase: 'closeout', type: 'checkpoint', checkpointId: 'cp-003' },
  { seq: 24, phase: 'closeout', type: 'run_complete' },
  { seq: 25, phase: 'closeout', type: 'phase_end' },
];

// ── AT-S14-01: Same event stream -> identical narration output ──

test('AT-S14-01: narration is deterministic (byte-identical across calls)', () => {
  ensureDir(JARVIS_DIR);

  const settings: NarrationSettings = { verbosity: 'verbose', tone: 'operator', reducedMotion: false };
  const output1 = renderNarrationText(TEST_EVENTS, settings);
  const output2 = renderNarrationText(TEST_EVENTS, settings);

  assert.strictEqual(output1, output2, 'Narration must be byte-identical across calls');
  assert.ok(output1.length > 0, 'Narration must produce non-empty output');

  fs.writeFileSync(
    path.join(JARVIS_DIR, 'narration_snapshot_operator_verbose.txt'),
    output1,
  );

  fs.writeFileSync(
    path.join(JARVIS_DIR, 'AT-S14-01_determinism.txt'),
    `=== AT-S14-01: Narration Determinism ===\n\n` +
      `Run 1 length: ${output1.length} bytes\n` +
      `Run 2 length: ${output2.length} bytes\n` +
      `Byte-identical: ${output1 === output2 ? 'PASS' : 'FAIL'}\n\n` +
      `--- Output ---\n${output1}\n`,
  );
});

test('AT-S14-01: narration lines match event count', () => {
  const lines = renderNarration(TEST_EVENTS, DEFAULT_SETTINGS);
  assert.strictEqual(lines.length, TEST_EVENTS.length, 'One narration line per event');
});

test('AT-S14-01: narration varies with settings but stays deterministic', () => {
  ensureDir(JARVIS_DIR);

  const configs: NarrationSettings[] = [
    { verbosity: 'verbose', tone: 'operator', reducedMotion: false },
    { verbosity: 'verbose', tone: 'casual', reducedMotion: false },
    { verbosity: 'quiet', tone: 'operator', reducedMotion: false },
  ];

  const outputs = configs.map((s) => renderNarrationText(TEST_EVENTS, s));

  // Each config produces different output
  assert.notStrictEqual(outputs[0], outputs[1], 'Operator != casual');
  assert.notStrictEqual(outputs[0], outputs[2], 'Verbose != quiet');
  assert.notStrictEqual(outputs[1], outputs[2], 'Casual != quiet');

  // Each config is individually deterministic
  for (let i = 0; i < configs.length; i++) {
    const again = renderNarrationText(TEST_EVENTS, configs[i]);
    assert.strictEqual(again, outputs[i], `Config ${i} must be deterministic`);
  }

  for (let i = 0; i < configs.length; i++) {
    const label = `${configs[i].tone}_${configs[i].verbosity}`;
    fs.writeFileSync(
      path.join(JARVIS_DIR, `narration_snapshot_${label}.txt`),
      outputs[i],
    );
  }
});

test('AT-S14-01: narration is pure (no time/random dependency)', () => {
  // Run 100 times to prove no jitter
  const baseline = renderNarrationText(TEST_EVENTS, DEFAULT_SETTINGS);
  for (let i = 0; i < 100; i++) {
    const result = renderNarrationText(TEST_EVENTS, DEFAULT_SETTINGS);
    assert.strictEqual(result, baseline, `Iteration ${i} must match baseline`);
  }
});

// ── AT-S14-02: Agent switching events render correctly ────────

test('AT-S14-02: agent switch events appear in dashboard timeline', () => {
  ensureDir(UI_DIR);

  const dashboard = computeDashboard(TEST_EVENTS);

  assert.strictEqual(dashboard.agentTimeline.length, 1, 'Should have 1 agent switch');
  assert.strictEqual(dashboard.agentTimeline[0].agent, 'claude');
  assert.strictEqual(dashboard.agentTimeline[0].mode, 'auto');
  assert.strictEqual(dashboard.agentTimeline[0].reason, 'context exhausted');

  const text = renderDashboardText(dashboard);
  assert.ok(text.includes('claude [auto]'), 'Dashboard text must show agent switch');

  fs.writeFileSync(
    path.join(UI_DIR, 'agent_switch_timeline.txt'),
    `=== AT-S14-02: Agent Switch Timeline ===\n\n${text}\n`,
  );
});

test('AT-S14-02: manual + auto switches render distinctly', () => {
  const mixedEvents: NarrationEvent[] = [
    { seq: 1, phase: 'agent_invocation', type: 'phase_start', agent: 'codex' },
    { seq: 2, phase: 'switching', type: 'agent_switch_auto', agent: 'claude', reason: 'exhausted' },
    { seq: 3, phase: 'switching', type: 'agent_switch_manual', agent: 'codex', reason: 'operator override' },
    { seq: 4, phase: 'switching', type: 'agent_switch_auto', agent: 'claude', reason: 'retry exceeded' },
  ];

  const dashboard = computeDashboard(mixedEvents);
  assert.strictEqual(dashboard.agentTimeline.length, 3);
  assert.strictEqual(dashboard.agentTimeline[0].mode, 'auto');
  assert.strictEqual(dashboard.agentTimeline[1].mode, 'manual');
  assert.strictEqual(dashboard.agentTimeline[2].mode, 'auto');

  const narration = renderNarration(mixedEvents, DEFAULT_SETTINGS);
  const switchLines = narration.filter(
    (l) => l.type === 'agent_switch_auto' || l.type === 'agent_switch_manual',
  );
  assert.strictEqual(switchLines.length, 3);
  assert.ok(switchLines[0].text.includes('[auto]'));
  assert.ok(switchLines[1].text.includes('[manual]'));
});

test('AT-S14-02: dashboard does not mutate input events', () => {
  const frozen = Object.freeze(TEST_EVENTS.map((e) => Object.freeze({ ...e })));
  const dashboard = computeDashboard(frozen);
  assert.ok(dashboard.totalEvents === TEST_EVENTS.length);
  // If Object.freeze prevented mutation, we'd get a TypeError; reaching here = PASS
});

test('AT-S14-02: narration does not mutate input events', () => {
  const frozen = Object.freeze(TEST_EVENTS.map((e) => Object.freeze({ ...e })));
  const lines = renderNarration(frozen, DEFAULT_SETTINGS);
  assert.ok(lines.length === TEST_EVENTS.length);
});

test('AT-S14-02: dashboard tracks phase progress correctly', () => {
  ensureDir(UI_DIR);

  const dashboard = computeDashboard(TEST_EVENTS);

  const completed = dashboard.phases.filter((p) => p.status === 'complete');
  assert.ok(completed.length >= 5, 'Multiple phases should be complete');

  assert.strictEqual(dashboard.evidenceCount, 5);
  assert.strictEqual(dashboard.lastCheckpointId, 'cp-003');
  assert.strictEqual(dashboard.runComplete, true);
  assert.strictEqual(dashboard.hardStopped, false);

  fs.writeFileSync(
    path.join(UI_DIR, 'dashboard_state.json'),
    JSON.stringify(dashboard, null, 2),
  );

  fs.writeFileSync(
    path.join(UI_DIR, 'AT-S14-02_dashboard.txt'),
    `=== AT-S14-02: Dashboard State ===\n\n` +
      `Completed phases: ${completed.length}\n` +
      `Evidence: ${dashboard.evidenceCount}\n` +
      `Last checkpoint: ${dashboard.lastCheckpointId}\n` +
      `Active agent: ${dashboard.activeAgent}\n` +
      `Run complete: ${dashboard.runComplete}\n` +
      `Hard stopped: ${dashboard.hardStopped}\n` +
      `Agent switches: ${dashboard.agentTimeline.length}\n` +
      `Result: PASS\n`,
  );
});

test('AT-S14-02: hard stop event renders correctly', () => {
  const hardStopEvents: NarrationEvent[] = [
    { seq: 1, phase: 'preflight', type: 'phase_start' },
    { seq: 2, phase: 'preflight', type: 'hard_stop', reason: 'GIT_OBJECT_INTEGRITY' },
  ];

  const dashboard = computeDashboard(hardStopEvents);
  assert.strictEqual(dashboard.hardStopped, true);
  assert.strictEqual(dashboard.nextDecisionReason, 'GIT_OBJECT_INTEGRITY');

  const narration = renderNarration(hardStopEvents, DEFAULT_SETTINGS);
  assert.ok(narration[1].text.includes('HARD STOP'));
  assert.strictEqual(narration[1].ariaLive, 'assertive');
});

// ── AT-S14-03: Reduced motion eliminates risky animations ─────

test('AT-S14-03: reduced motion disables dashboard animations', () => {
  ensureDir(A11Y_DIR);

  const normal = getDashboardStyles(false);
  const reduced = getDashboardStyles(true);

  assert.notStrictEqual(normal.animationDuration, '0ms');
  assert.strictEqual(reduced.animationDuration, '0ms');
  assert.strictEqual(reduced.transitionDuration, '0ms');
  assert.strictEqual(reduced.pulseAnimation, 'none');

  fs.writeFileSync(
    path.join(A11Y_DIR, 'reduced_motion_styles.txt'),
    `=== AT-S14-03: Reduced Motion Styles ===\n\n` +
      `Normal animation: ${normal.animationDuration}\n` +
      `Reduced animation: ${reduced.animationDuration}\n` +
      `Normal transition: ${normal.transitionDuration}\n` +
      `Reduced transition: ${reduced.transitionDuration}\n` +
      `Normal pulse: ${normal.pulseAnimation}\n` +
      `Reduced pulse: ${reduced.pulseAnimation}\n` +
      `Result: PASS\n`,
  );
});

test('AT-S14-03: narration aria-live attributes are set correctly', () => {
  const lines = renderNarration(TEST_EVENTS, DEFAULT_SETTINGS);

  // Phase starts/ends should be polite
  const phaseLines = lines.filter((l) => l.type === 'phase_start' || l.type === 'phase_end');
  for (const line of phaseLines) {
    assert.strictEqual(line.ariaLive, 'polite', `${line.type} should be polite`);
  }

  // Agent switches should be assertive
  const switchLines = lines.filter(
    (l) => l.type === 'agent_switch_auto' || l.type === 'agent_switch_manual',
  );
  for (const line of switchLines) {
    assert.strictEqual(line.ariaLive, 'assertive', 'Agent switch should be assertive');
  }

  fs.writeFileSync(
    path.join(A11Y_DIR, 'aria_live_audit.txt'),
    `=== AT-S14-03: ARIA Live Audit ===\n\n` +
      `Phase events (polite): ${phaseLines.length} checked, all polite: PASS\n` +
      `Agent switch events (assertive): ${switchLines.length} checked, all assertive: PASS\n` +
      `Total lines audited: ${lines.length}\n`,
  );
});

test('AT-S14-03: reduced motion narration settings work correctly', () => {
  const reducedSettings: NarrationSettings = {
    verbosity: 'verbose',
    tone: 'operator',
    reducedMotion: true,
  };

  const normalOutput = renderNarrationText(TEST_EVENTS, DEFAULT_SETTINGS);
  const reducedOutput = renderNarrationText(TEST_EVENTS, reducedSettings);

  // Narration text itself should be identical (reduced motion affects CSS, not text)
  assert.strictEqual(normalOutput, reducedOutput, 'Narration text is the same regardless of motion setting');

  fs.writeFileSync(
    path.join(A11Y_DIR, 'AT-S14-03_summary.txt'),
    `=== AT-S14-03: Reduced Motion Summary ===\n\n` +
      `Dashboard animations: 0ms under reduced motion: PASS\n` +
      `Dashboard transitions: 0ms under reduced motion: PASS\n` +
      `Dashboard pulse: none under reduced motion: PASS\n` +
      `ARIA live attributes: correctly assigned: PASS\n` +
      `Narration text unchanged by motion setting: PASS\n`,
  );
});

// ── Unit tests (supplemental) ─────────────────────────────────

test('dashboard starts with all phases pending', () => {
  const dashboard = computeDashboard([]);
  assert.strictEqual(dashboard.phases.length, 7);
  for (const p of dashboard.phases) {
    assert.strictEqual(p.status, 'pending');
    assert.strictEqual(p.eventCount, 0);
  }
  assert.strictEqual(dashboard.evidenceCount, 0);
  assert.strictEqual(dashboard.lastCheckpointId, null);
  assert.strictEqual(dashboard.activeAgent, null);
  assert.strictEqual(dashboard.runComplete, false);
  assert.strictEqual(dashboard.hardStopped, false);
});

test('empty event stream produces empty narration', () => {
  const lines = renderNarration([], DEFAULT_SETTINGS);
  assert.strictEqual(lines.length, 0);
  const text = renderNarrationText([], DEFAULT_SETTINGS);
  assert.strictEqual(text, '');
});

test('health signal with FAIL severity sets nextDecisionReason', () => {
  const events: NarrationEvent[] = [
    { seq: 1, phase: 'preflight', type: 'health_signal', signalId: 'REPO_DRIFT', severity: 'FAIL' },
  ];
  const dashboard = computeDashboard(events);
  assert.strictEqual(dashboard.nextDecisionReason, 'Health signal: REPO_DRIFT');
});

test('health signal with WARN severity does not set nextDecisionReason', () => {
  const events: NarrationEvent[] = [
    { seq: 1, phase: 'preflight', type: 'health_signal', signalId: 'REPO_DRIFT', severity: 'WARN' },
  ];
  const dashboard = computeDashboard(events);
  assert.strictEqual(dashboard.nextDecisionReason, null);
});
