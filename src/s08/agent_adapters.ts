import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  executeSandboxedCommand,
  type CommandReceipt,
  type CommandRequest,
} from '../../engine/command_executor.ts';
import {
  continuityFirstLine,
  normalizeAdapterStatus,
  type AdapterInputEnvelope,
  type AdapterName,
  type AdapterOutputEnvelope,
  type DeterministicErrorType,
  validateNoReworkRule,
} from './contract.ts';
import { buildNextAgentFirstMessage, canonicalJson, continuitySha256 } from './continuity_packet.ts';

export interface AdapterRuntimeOptions {
  repoRoot: string;
  stagingRoot: string;
  timeoutMs: number;
  commandExecutor?: (req: CommandRequest) => CommandReceipt;
  env?: Record<string, string>;
}

export interface AdapterInvocationResult {
  output: AdapterOutputEnvelope;
  receipt: CommandReceipt;
  run_id: string;
  run_root: string;
  first_message: string;
}

export interface AgentAdapter {
  name: AdapterName;
  invoke(input: AdapterInputEnvelope): AdapterInvocationResult;
}

let runCounter = 0;

export function createCodexAdapter(options: AdapterRuntimeOptions): AgentAdapter {
  return createAdapter('codex', options);
}

export function createClaudeAdapter(options: AdapterRuntimeOptions): AgentAdapter {
  return createAdapter('claude', options);
}

function createAdapter(name: AdapterName, options: AdapterRuntimeOptions): AgentAdapter {
  return {
    name,
    invoke(input: AdapterInputEnvelope): AdapterInvocationResult {
      return invokeAdapter(name, input, options);
    },
  };
}

function invokeAdapter(name: AdapterName, input: AdapterInputEnvelope, options: AdapterRuntimeOptions): AdapterInvocationResult {
  const validationError = validateNoReworkRule(input);
  if (validationError) throw new Error(validationError);

  const continuityHash = continuityHashForInput(input);
  if (!continuityHash) throw new Error('HARD_STOP: continuity sha256 must be provided or derivable from packet');

  const runId = nextRunId(name);
  const runRoot = path.join(options.stagingRoot, name, runId);
  fs.mkdirSync(runRoot, { recursive: true });
  const transcriptPaths = writeRequestArtifacts(runRoot, input, continuityHash);
  const scriptPath = writeAdapterScript(name, runRoot);
  const receipt = executeAdapterCommand(name, options, runRoot, scriptPath, transcriptPaths.promptTxt);
  const output = buildOutputEnvelope(name, receipt, transcriptPaths, runRoot);
  const responseRecord = {
    adapter: name,
    status: output.status,
    deterministic_error_type: output.deterministic_error_type,
    exit_code: receipt.exit_code,
    stdout: receipt.stdout,
    stderr: receipt.stderr,
    parsed_payload: output.parsed_payload,
  };
  fs.writeFileSync(transcriptPaths.responseJsonl, `${JSON.stringify(responseRecord)}\n`, 'utf8');
  fs.writeFileSync(transcriptPaths.normalizedOutput, canonicalJson(output), 'utf8');
  return { output, receipt, run_id: runId, run_root: runRoot, first_message: transcriptPaths.firstMessage };
}

function executeAdapterCommand(
  name: AdapterName,
  options: AdapterRuntimeOptions,
  runRoot: string,
  scriptPath: string,
  promptPath: string,
): CommandReceipt {
  const commandRequest: CommandRequest = {
    command: 'bash',
    args: [scriptPath, promptPath],
    cwd: options.repoRoot,
    repoRoot: options.repoRoot,
    timeoutMs: options.timeoutMs,
    env: options.env,
    allowedRoots: [options.repoRoot, options.stagingRoot, '/tmp/promptops/S08'],
    receiptDir: path.join(runRoot, 'receipts'),
  };
  const exec = options.commandExecutor ?? executeSandboxedCommand;
  const receipt = exec(commandRequest);
  if (name === 'codex' || name === 'claude') return receipt;
  return receipt;
}

function buildOutputEnvelope(
  adapter: AdapterName,
  receipt: CommandReceipt,
  paths: TranscriptPaths,
  runRoot: string,
): AdapterOutputEnvelope {
  const parsed = parsePayload(receipt.stdout);
  const parsedStatus = parsed ? normalizeAdapterStatus(parsed.status) : inferStatus(receipt);
  const parsedEvidence = toParsedEvidence(parsed, receipt);
  return {
    adapter,
    status: parsedStatus,
    raw_output: receipt.stdout,
    parsed_payload: parsed,
    parsed_evidence: parsedEvidence,
    work_summary: toWorkSummary(parsed, receipt),
    deterministic_error_type: inferErrorType(parsedStatus, receipt.stderr, receipt.exit_code),
    transcript_paths: {
      request_jsonl: paths.requestJsonl,
      response_jsonl: paths.responseJsonl,
      normalized_output: paths.normalizedOutput,
      prompt_txt: paths.promptTxt,
    },
  };
}

interface TranscriptPaths {
  promptTxt: string;
  requestJsonl: string;
  responseJsonl: string;
  normalizedOutput: string;
  firstMessage: string;
}

function writeRequestArtifacts(runRoot: string, input: AdapterInputEnvelope, hash: string): TranscriptPaths {
  const promptTxt = path.join(runRoot, 'prompt.txt');
  const requestJsonl = path.join(runRoot, 'request.jsonl');
  const responseJsonl = path.join(runRoot, 'response.jsonl');
  const normalizedOutput = path.join(runRoot, 'normalized_output.json');
  const firstMessage = buildNextAgentFirstMessage(hash, input.outstanding_delta_ids);
  const prompt = `${continuityFirstLine(hash)}\n${firstMessage}\n${canonicalJson(input)}`;
  fs.writeFileSync(promptTxt, prompt, 'utf8');
  fs.writeFileSync(requestJsonl, `${JSON.stringify({ first_message: firstMessage, continuity_sha256: hash })}\n`, 'utf8');
  return { promptTxt, requestJsonl, responseJsonl, normalizedOutput, firstMessage };
}

function writeAdapterScript(adapter: AdapterName, runRoot: string): string {
  const scriptPath = path.join(runRoot, `invoke_${adapter}.sh`);
  const codex = 'codex app-server --stdio-jsonl < "$PROMPT_FILE"';
  const claude = 'claude -p "$(cat "$PROMPT_FILE")" --output-format json';
  const cmd = adapter === 'codex' ? codex : claude;
  const script = ['#!/usr/bin/env bash', 'set -euo pipefail', 'PROMPT_FILE="$1"', cmd, ''].join('\n');
  fs.writeFileSync(scriptPath, script, { encoding: 'utf8', mode: 0o755 });
  return scriptPath;
}

function parsePayload(stdout: string): Record<string, unknown> | null {
  if (!stdout || stdout.trim().length === 0) return null;
  try {
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function inferStatus(receipt: CommandReceipt) {
  if (receipt.exit_code === 0) return 'success';
  if (/exhaust|context length|token limit/i.test(receipt.stderr)) return 'exhausted';
  if (/approval|required|permission/i.test(receipt.stderr)) return 'blocked';
  return 'error';
}

function inferErrorType(status: string, stderr: string, exitCode: number): DeterministicErrorType {
  if (status === 'success' || status === 'needs_input') return 'none';
  if (status === 'exhausted') return 'exhausted';
  if (status === 'blocked' && /approval|required|permission/i.test(stderr)) return 'approval_required';
  if (status === 'error' && exitCode !== 0 && /timed out|timeout|temporarily/i.test(stderr)) return 'transient_failure';
  if (status === 'error') return 'invalid_output';
  return 'none';
}

function toParsedEvidence(parsed: Record<string, unknown> | null, receipt: CommandReceipt) {
  const fromParsed = (parsed?.parsed_evidence as Record<string, unknown> | undefined) ?? {};
  const touched = Array.isArray(fromParsed.touched_ids) ? fromParsed.touched_ids.map(String) : [];
  const diff = Array.isArray(fromParsed.diff_summary) ? fromParsed.diff_summary.map(String) : [];
  const ats = Array.isArray(fromParsed.at_results) ? fromParsed.at_results.map(String) : [];
  const receiptPath = receipt.raw_artifact_paths.receipt;
  return { receipt_paths: [receiptPath], diff_summary: diff, at_results: ats, touched_ids: touched };
}

function toWorkSummary(parsed: Record<string, unknown> | null, receipt: CommandReceipt): string {
  if (parsed && typeof parsed.work_summary === 'string') return parsed.work_summary;
  if (receipt.exit_code === 0) return 'adapter invocation completed';
  return `adapter invocation failed with exit ${receipt.exit_code}`;
}

function nextRunId(adapter: AdapterName): string {
  runCounter += 1;
  return `${adapter}-run-${String(runCounter).padStart(4, '0')}`;
}

function continuityHashForInput(input: AdapterInputEnvelope): string {
  if (input.continuity_sha256) return input.continuity_sha256;
  if (input.continuity_packet) return continuitySha256(input.continuity_packet);
  const synthetic = {
    version: 'continuity_packet_v1' as const,
    rendered_ticket_json: input.rendered_ticket_json,
    template_version_hash: input.template_version_hash,
    evidence_ledger_snapshot: input.evidence_ledger_snapshot,
    repo_context_snapshot: input.repo_context_snapshot,
    run_timeline_tail: input.run_timeline_tail,
    last_checkpoint_id: input.last_checkpoint_id,
    outstanding_delta_ids: input.outstanding_delta_ids,
    policy_bundle: input.policy_bundle,
  };
  return continuitySha256(synthetic);
}
