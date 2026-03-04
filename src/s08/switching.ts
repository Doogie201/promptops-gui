import * as crypto from 'node:crypto';
import type {
  AdapterInputEnvelope,
  AdapterName,
  AdapterOutputEnvelope,
  ContinuityPacketV1,
  TimelineEvent,
} from './contract.ts';
import { type AgentAdapter, type AdapterInvocationResult } from './agent_adapters.ts';
import { buildNextAgentFirstMessage, canonicalJson, writeContinuityPacket } from './continuity_packet.ts';

export interface SwitchFlowConfig {
  primary: AgentAdapter;
  secondary: AgentAdapter;
  input: AdapterInputEnvelope;
  continuityRoot: string;
  maxPrimaryRetries?: number;
}

export interface ContinuityCheckpoint {
  checkpoint_id: string;
  packet_path: string;
  hash_path: string;
  sha256: string;
}

export interface SwitchFlowResult {
  status: 'success' | 'blocked' | 'error';
  sequence: AdapterName[];
  checkpoints: ContinuityCheckpoint[];
  invocations: AdapterInvocationResult[];
  idempotency_key: string;
  switch_reason: string;
  evidence_ledger_diff: {
    done_ids_before: string[];
    touched_ids_after_switch: string[];
    reworked_done_ids: string[];
  };
}

export function runManualSwitchFlow(config: SwitchFlowConfig): SwitchFlowResult {
  const first = config.primary.invoke(config.input);
  const firstCheckpoint = createCheckpoint(config, config.input, [toTimeline('evt-01', first)], 'checkpoint-01');
  const resumeInput = withContinuity(config.input, firstCheckpoint.sha256, firstCheckpoint.packet);
  const second = config.secondary.invoke(resumeInput);
  const secondCheckpoint = createCheckpoint(config, resumeInput, [toTimeline('evt-02', second)], 'checkpoint-02');
  return buildFlowResult(config, [first, second], [firstCheckpoint.artifact, secondCheckpoint.artifact], 'manual_switch');
}

export function runAutoSwitchFlow(config: SwitchFlowConfig): SwitchFlowResult {
  const retries = Math.max(0, config.maxPrimaryRetries ?? 1);
  const attempts: AdapterInvocationResult[] = [];
  let finalPrimary: AdapterInvocationResult | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const run = config.primary.invoke(config.input);
    attempts.push(run);
    finalPrimary = run;
    if (run.output.status !== 'error' && run.output.status !== 'exhausted') break;
    if (run.output.status === 'exhausted') break;
  }

  if (!finalPrimary) throw new Error('HARD_STOP: auto-switch flow could not start primary adapter');
  const reason = autoSwitchReason(finalPrimary.output.status, attempts.length, retries);
  const checkpoint = createCheckpoint(config, config.input, attempts.map((run, i) => toTimeline(`evt-${i + 1}`, run)), 'checkpoint-auto');
  const resumeInput = withContinuity(config.input, checkpoint.sha256, checkpoint.packet);
  const secondary = config.secondary.invoke(resumeInput);
  return buildFlowResult(config, [...attempts, secondary], [checkpoint.artifact], reason);
}

export function deterministicHandoffMessage(packet: ContinuityPacketV1): { hash: string; first_message: string } {
  const json = canonicalJson(packet);
  const hash = crypto.createHash('sha256').update(json).digest('hex');
  const firstMessage = buildNextAgentFirstMessage(hash, packet.outstanding_delta_ids);
  return { hash, first_message: firstMessage };
}

function withContinuity(input: AdapterInputEnvelope, sha256: string, packet: ContinuityPacketV1): AdapterInputEnvelope {
  return { ...input, continuity_sha256: sha256, continuity_packet: packet };
}

function createCheckpoint(
  config: SwitchFlowConfig,
  input: AdapterInputEnvelope,
  timeline: TimelineEvent[],
  checkpointId: string,
) {
  const packet: ContinuityPacketV1 = {
    version: 'continuity_packet_v1',
    rendered_ticket_json: input.rendered_ticket_json,
    template_version_hash: input.template_version_hash,
    evidence_ledger_snapshot: input.evidence_ledger_snapshot,
    repo_context_snapshot: input.repo_context_snapshot,
    run_timeline_tail: timeline.slice(-8),
    last_checkpoint_id: checkpointId,
    outstanding_delta_ids: input.outstanding_delta_ids,
    policy_bundle: input.policy_bundle,
  };
  const artifact = writeContinuityPacket(config.continuityRoot, checkpointId, packet);
  return { packet, artifact, sha256: artifact.sha256 };
}

function buildFlowResult(
  config: SwitchFlowConfig,
  runs: AdapterInvocationResult[],
  checkpoints: ContinuityCheckpoint[],
  switchReason: string,
): SwitchFlowResult {
  const doneBefore = config.input.evidence_ledger_snapshot.items
    .filter((item) => item.status === 'done')
    .map((item) => item.requirement_id)
    .sort();
  const touched = runs
    .slice(1)
    .flatMap((run) => run.output.parsed_evidence.touched_ids)
    .sort();
  const reworked = touched.filter((item) => doneBefore.includes(item));
  const keyMaterial = `${checkpoints.map((item) => item.sha256).join('|')}|${runs.map((run) => run.output.adapter).join('>')}`;
  const idempotencyKey = crypto.createHash('sha256').update(keyMaterial).digest('hex');
  const status = runs[runs.length - 1].output.status === 'success' ? 'success' : 'blocked';
  return {
    status,
    sequence: runs.map((run) => run.output.adapter),
    checkpoints,
    invocations: runs,
    idempotency_key: idempotencyKey,
    switch_reason: switchReason,
    evidence_ledger_diff: { done_ids_before: doneBefore, touched_ids_after_switch: touched, reworked_done_ids: reworked },
  };
}

function autoSwitchReason(status: string, attempts: number, retries: number): string {
  if (status === 'exhausted') return 'AUTO_SWITCH_EXHAUSTED';
  if (status === 'blocked') return 'AUTO_SWITCH_APPROVAL_BLOCKED';
  if (status === 'error' && attempts > retries) return 'AUTO_SWITCH_RETRY_EXCEEDED';
  return 'AUTO_SWITCH_MANUAL_FALLBACK';
}

function toTimeline(eventId: string, run: AdapterInvocationResult): TimelineEvent {
  return {
    event_id: eventId,
    adapter: run.output.adapter,
    status: run.output.status,
    reason: run.output.work_summary,
  };
}
