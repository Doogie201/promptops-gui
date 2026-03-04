import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CommandReceipt, CommandRequest } from '../../engine/command_executor.ts';
import { createClaudeAdapter, createCodexAdapter } from './agent_adapters.ts';
import type { AdapterInputEnvelope, ContinuityPacketV1 } from './contract.ts';
import { deterministicHandoffMessage, runAutoSwitchFlow, runManualSwitchFlow } from './switching.ts';
import { writeContinuityPacket } from './continuity_packet.ts';

interface MockResponse {
  stdout: string;
  stderr?: string;
  exitCode?: number;
}

const STAGING_ROOT = '/tmp/promptops/S08/adapters';
const CONTINUITY_ROOT = '/tmp/promptops/S08/continuity';
const TEST_ROOT = '/tmp/promptops/S08/tests';
const MOCK_REPO_ROOT = '/tmp/promptops/S08/mock-repo';

test('AT-S08-01 Manual switch', () => {
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  resetDir(MOCK_REPO_ROOT);
  const codexExec = makeMockExecutor(path.join(TEST_ROOT, 'at1', 'codex'), [
    { stdout: JSON.stringify({ status: 'needs_input', work_summary: 'switch to claude', parsed_evidence: { touched_ids: ['R-3'] } }) },
  ]);
  const claudeExec = makeMockExecutor(path.join(TEST_ROOT, 'at1', 'claude'), [
    { stdout: JSON.stringify({ status: 'success', work_summary: 'delta closed', parsed_evidence: { touched_ids: ['R-2'] } }) },
  ]);
  const result = runManualSwitchFlow({
    primary: createCodexAdapter({ repoRoot: MOCK_REPO_ROOT, stagingRoot: STAGING_ROOT, timeoutMs: 3_000, commandExecutor: codexExec }),
    secondary: createClaudeAdapter({ repoRoot: MOCK_REPO_ROOT, stagingRoot: STAGING_ROOT, timeoutMs: 3_000, commandExecutor: claudeExec }),
    input: makeInputEnvelope(),
    continuityRoot: path.join(CONTINUITY_ROOT, 'AT-S08-01'),
  });

  assert.strictEqual(result.status, 'success');
  assert.deepStrictEqual(result.sequence, ['codex', 'claude']);
  assert.deepStrictEqual(result.evidence_ledger_diff.reworked_done_ids, []);
  const secondFirstMessage = readFirstMessage(result.invocations[1].output.transcript_paths.request_jsonl);
  assert.ok(secondFirstMessage.includes('continuity_sha256='));
  assert.ok(secondFirstMessage.includes('do not redo evidenced work'));
  writeEvidence('AT-S08-01_run.json', {
    status: result.status,
    sequence: result.sequence,
    checkpoints: result.checkpoints,
    evidence_ledger_diff: result.evidence_ledger_diff,
    codex_transcript: result.invocations[0].output.transcript_paths,
    claude_transcript: result.invocations[1].output.transcript_paths,
  });
});

test('AT-S08-02 Auto switch', () => {
  resetDir(MOCK_REPO_ROOT);
  const codexExec = makeMockExecutor(path.join(TEST_ROOT, 'at2', 'codex'), [
    { stdout: JSON.stringify({ status: 'exhausted', work_summary: 'context exhausted', parsed_evidence: { touched_ids: [] } }) },
  ]);
  const claudeExec = makeMockExecutor(path.join(TEST_ROOT, 'at2', 'claude'), [
    { stdout: JSON.stringify({ status: 'success', work_summary: 'resumed and completed', parsed_evidence: { touched_ids: ['R-2'] } }) },
  ]);
  const result = runAutoSwitchFlow({
    primary: createCodexAdapter({ repoRoot: MOCK_REPO_ROOT, stagingRoot: STAGING_ROOT, timeoutMs: 3_000, commandExecutor: codexExec }),
    secondary: createClaudeAdapter({ repoRoot: MOCK_REPO_ROOT, stagingRoot: STAGING_ROOT, timeoutMs: 3_000, commandExecutor: claudeExec }),
    input: makeInputEnvelope(),
    continuityRoot: path.join(CONTINUITY_ROOT, 'AT-S08-02'),
    maxPrimaryRetries: 1,
  });

  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.switch_reason, 'AUTO_SWITCH_EXHAUSTED');
  assert.deepStrictEqual(result.sequence, ['codex', 'claude']);
  const message = readFirstMessage(result.invocations[1].output.transcript_paths.request_jsonl);
  assert.ok(message.includes('continuity_sha256='));
  assert.ok(message.includes('do not redo evidenced work'));
  writeEvidence('AT-S08-02_run.json', {
    status: result.status,
    switch_reason: result.switch_reason,
    checkpoints: result.checkpoints,
    codex_status: result.invocations[0].output.status,
    auto_switch_sequence: result.sequence,
    claude_transcript: result.invocations[1].output.transcript_paths,
  });
});

test('AT-S08-02b Auto switch does not run secondary when primary succeeds', () => {
  resetDir(MOCK_REPO_ROOT);
  const codexExec = makeMockExecutor(path.join(TEST_ROOT, 'at2b', 'codex'), [
    { stdout: JSON.stringify({ status: 'success', work_summary: 'already complete', parsed_evidence: { touched_ids: ['R-2'] } }) },
  ]);
  const claudeRoot = path.join(TEST_ROOT, 'at2b', 'claude');
  const claudeExec = makeMockExecutor(claudeRoot, [
    { stdout: JSON.stringify({ status: 'success', work_summary: 'should not run', parsed_evidence: { touched_ids: [] } }) },
  ]);
  const result = runAutoSwitchFlow({
    primary: createCodexAdapter({ repoRoot: MOCK_REPO_ROOT, stagingRoot: STAGING_ROOT, timeoutMs: 3_000, commandExecutor: codexExec }),
    secondary: createClaudeAdapter({ repoRoot: MOCK_REPO_ROOT, stagingRoot: STAGING_ROOT, timeoutMs: 3_000, commandExecutor: claudeExec }),
    input: makeInputEnvelope(),
    continuityRoot: path.join(CONTINUITY_ROOT, 'AT-S08-02b'),
    maxPrimaryRetries: 1,
  });

  assert.strictEqual(result.status, 'success');
  assert.strictEqual(result.switch_reason, 'AUTO_SWITCH_NOT_REQUIRED');
  assert.deepStrictEqual(result.sequence, ['codex']);
  assert.deepStrictEqual(fs.readdirSync(claudeRoot), []);
});

test('AT-S08-02c Secondary error stays error', () => {
  resetDir(MOCK_REPO_ROOT);
  const codexExec = makeMockExecutor(path.join(TEST_ROOT, 'at2c', 'codex'), [
    { stdout: JSON.stringify({ status: 'exhausted', work_summary: 'context exhausted', parsed_evidence: { touched_ids: [] } }) },
  ]);
  const claudeExec = makeMockExecutor(path.join(TEST_ROOT, 'at2c', 'claude'), [
    { stdout: JSON.stringify({ status: 'error', work_summary: 'secondary failed', parsed_evidence: { touched_ids: [] } }), exitCode: 1 },
  ]);
  const result = runAutoSwitchFlow({
    primary: createCodexAdapter({ repoRoot: MOCK_REPO_ROOT, stagingRoot: STAGING_ROOT, timeoutMs: 3_000, commandExecutor: codexExec }),
    secondary: createClaudeAdapter({ repoRoot: MOCK_REPO_ROOT, stagingRoot: STAGING_ROOT, timeoutMs: 3_000, commandExecutor: claudeExec }),
    input: makeInputEnvelope(),
    continuityRoot: path.join(CONTINUITY_ROOT, 'AT-S08-02c'),
    maxPrimaryRetries: 1,
  });

  assert.strictEqual(result.switch_reason, 'AUTO_SWITCH_EXHAUSTED');
  assert.strictEqual(result.status, 'error');
});

test('AT-S08-03 Deterministic handoff', () => {
  const packet = toPacket(makeInputEnvelope(), 'checkpoint-deterministic');
  const a = writeContinuityPacket(path.join(CONTINUITY_ROOT, 'AT-S08-03'), 'packet-a', packet);
  const b = writeContinuityPacket(path.join(CONTINUITY_ROOT, 'AT-S08-03'), 'packet-b', packet);
  const firstA = deterministicHandoffMessage(packet);
  const firstB = deterministicHandoffMessage(packet);

  assert.strictEqual(a.sha256, b.sha256);
  assert.strictEqual(firstA.hash, firstB.hash);
  assert.strictEqual(firstA.first_message, firstB.first_message);
  writeEvidence('AT-S08-03_run.json', {
    packet_a: a,
    packet_b: b,
    hashes_equal: a.sha256 === b.sha256,
    first_message_a: firstA.first_message,
    first_message_b: firstB.first_message,
    first_messages_equal: firstA.first_message === firstB.first_message,
  });
});

test('AT-S08-03b Codex JSONL payload parsing is deterministic', () => {
  resetDir(MOCK_REPO_ROOT);
  const codexExec = makeMockExecutor(path.join(TEST_ROOT, 'at3b', 'codex'), [
    {
      stdout: [
        JSON.stringify({ event: 'stream-start' }),
        JSON.stringify({
          status: 'needs_input',
          work_summary: 'jsonl parsed',
          parsed_evidence: { touched_ids: ['R-2'], diff_summary: ['src/s08/agent_adapters.ts'] },
        }),
      ].join('\n'),
    },
  ]);
  const adapter = createCodexAdapter({
    repoRoot: MOCK_REPO_ROOT,
    stagingRoot: STAGING_ROOT,
    timeoutMs: 3_000,
    commandExecutor: codexExec,
  });
  const result = adapter.invoke(makeInputEnvelope());
  assert.strictEqual(result.output.status, 'needs_input');
  assert.deepStrictEqual(result.output.parsed_evidence.touched_ids, ['R-2']);
  assert.deepStrictEqual(result.output.parsed_evidence.diff_summary, ['src/s08/agent_adapters.ts']);
});

function makeInputEnvelope(): AdapterInputEnvelope {
  return {
    rendered_ticket_json: { sprint: 'S08', objective: 'agent adapters + continuity' },
    template_version_hash: 'template-v1-hash-001',
    evidence_ledger_snapshot: {
      items: [
        { requirement_id: 'R-1', status: 'done', citations: ['/tmp/promptops/S08/preflight/01_primary_preflight.txt'] },
        { requirement_id: 'R-2', status: 'partial', citations: [] },
        { requirement_id: 'R-3', status: 'todo', citations: [] },
      ],
    },
    repo_context_snapshot: {
      branch: 'sprint/S08-agent-adapters-v1-continuity',
      diff_summary: [],
      preflight_receipts: ['/tmp/promptops/S08/preflight/01_primary_preflight.txt'],
    },
    run_timeline_tail: [{ event_id: 'evt-0', adapter: 'codex', status: 'needs_input', reason: 'start' }],
    last_checkpoint_id: 'checkpoint-0',
    outstanding_delta_ids: ['R-2', 'R-3'],
    policy_bundle: {
      budgets: { max_new_lines: 120, max_function_len: 80 },
      whitelist: ['src/**', 'docs/sprints/S08/**', '/tmp/promptops/S08/**'],
      policy: { no_scope_creep: true, deterministic: true },
    },
    no_rework_rule: {
      close_deltas_only: true,
      directive: 'do not redo evidenced work; close only listed deltas',
    },
  };
}

function toPacket(input: AdapterInputEnvelope, checkpointId: string): ContinuityPacketV1 {
  return {
    version: 'continuity_packet_v1',
    rendered_ticket_json: input.rendered_ticket_json,
    template_version_hash: input.template_version_hash,
    evidence_ledger_snapshot: input.evidence_ledger_snapshot,
    repo_context_snapshot: input.repo_context_snapshot,
    run_timeline_tail: input.run_timeline_tail,
    last_checkpoint_id: checkpointId,
    outstanding_delta_ids: input.outstanding_delta_ids,
    policy_bundle: input.policy_bundle,
  };
}

function makeMockExecutor(root: string, responses: MockResponse[]) {
  resetDir(root);
  let index = 0;
  return (req: CommandRequest): CommandReceipt => {
    const selected = responses[Math.min(index, responses.length - 1)];
    index += 1;
    const now = new Date().toISOString();
    const responseRoot = path.join(root, `receipt_${String(index).padStart(2, '0')}`);
    fs.mkdirSync(responseRoot, { recursive: true });
    const stdoutPath = path.join(responseRoot, 'stdout.log');
    const stderrPath = path.join(responseRoot, 'stderr.log');
    const receiptPath = path.join(responseRoot, 'receipt.json');
    fs.writeFileSync(stdoutPath, selected.stdout, 'utf8');
    fs.writeFileSync(stderrPath, selected.stderr ?? '', 'utf8');
    const receipt: CommandReceipt = {
      command: req.command,
      args: req.args,
      cwd: req.cwd,
      env_allowlist: Object.keys(req.env ?? {}).sort(),
      start_ts: now,
      end_ts: now,
      stdout: selected.stdout,
      stderr: selected.stderr ?? '',
      exit_code: selected.exitCode ?? 0,
      timeout: false,
      policy_decision: 'executed',
      normalized_hash: `mock-${index}`,
      raw_artifact_paths: { receipt: receiptPath, stdout: stdoutPath, stderr: stderrPath },
    };
    fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), 'utf8');
    return receipt;
  };
}

function readFirstMessage(requestJsonlPath: string): string {
  const line = fs.readFileSync(requestJsonlPath, 'utf8').trim().split('\n')[0] ?? '{}';
  const parsed = JSON.parse(line) as { first_message?: string };
  return parsed.first_message ?? '';
}

function writeEvidence(fileName: string, payload: Record<string, unknown>): void {
  fs.mkdirSync(TEST_ROOT, { recursive: true });
  fs.writeFileSync(path.join(TEST_ROOT, fileName), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function resetDir(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
}
