import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

export interface Requirement {
  id: string;
  description: string;
  evidencePath?: string;
}

export type RequirementStatus = 'done' | 'partial' | 'todo' | 'blocked';

export interface LedgerEntry {
  requirementId: string;
  status: RequirementStatus;
  reason: string;
  citations: string[];
}

export interface DeltaTicket {
  ticketId: string;
  outstanding: LedgerEntry[];
}

export interface EvaluationReport {
  complete: boolean;
  verdict: 'complete' | 'delta' | 'needs_input';
  ledger: LedgerEntry[];
  needsInput?: LedgerEntry[];
  deltaTicket?: DeltaTicket;
}

export interface EvaluatorPaths {
  ledgerPath?: string;
  deltaTicketPath?: string;
}

export class Evaluator {
  private readonly paths: EvaluatorPaths;

  constructor(paths: EvaluatorPaths = {}) {
    this.paths = paths;
  }

  public evaluate(agentOutput: string, requirements: Requirement[]): EvaluationReport {
    const normalizedOutput = normalize(agentOutput);
    const priorDoneEvidence = loadPriorDoneEvidence(this.paths.ledgerPath);
    const orderedRequirements = requirements
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id));
    const ledger = orderedRequirements.map((requirement) =>
      applyRepeatRequestRule(
        evaluateRequirement(requirement, normalizedOutput),
        priorDoneEvidence.get(requirement.id)
      )
    );
    writeCanonicalJson(this.paths.ledgerPath, ledger);

    const needsInput = ledger.filter((entry) => entry.status === 'blocked');
    const outstanding = ledger.filter((entry) => entry.status === 'partial' || entry.status === 'todo');
    if (outstanding.length === 0) {
      removeFileIfExists(this.paths.deltaTicketPath);
      const complete = needsInput.length === 0;
      return {
        complete,
        verdict: complete ? 'complete' : 'needs_input',
        ledger,
        needsInput: needsInput.length > 0 ? needsInput : undefined
      };
    }

    const deltaTicket: DeltaTicket = {
      ticketId: stableTicketId(outstanding),
      outstanding
    };
    writeCanonicalJson(this.paths.deltaTicketPath, deltaTicket);
    return {
      complete: false,
      verdict: 'delta',
      ledger,
      needsInput: needsInput.length > 0 ? needsInput : undefined,
      deltaTicket
    };
  }
}

function applyRepeatRequestRule(entry: LedgerEntry, priorDoneCitations: string[] | undefined): LedgerEntry {
  if (!priorDoneCitations || entry.status === 'done') {
    return entry;
  }
  const priorCitations = priorDoneCitations.map((citation) => `prior_done:${citation}`);
  return {
    requirementId: entry.requirementId,
    status: 'blocked',
    reason: 'Repeat request detected for an already-evidenced requirement; operator input required.',
    citations: stableUnique(entry.citations.concat(['ledger:repeat_request_detected']).concat(priorCitations))
  };
}

function evaluateRequirement(requirement: Requirement, normalizedOutput: string): LedgerEntry {
  const requirementId = requirement.id;
  const requirementText = normalize(requirement.description);
  const baseCitation = requirement.evidencePath ? [`requirement:${requirement.evidencePath}`] : [];

  if (
    normalizedOutput.includes(requirementId.toLowerCase()) ||
    (requirementText.length > 0 && normalizedOutput.includes(requirementText))
  ) {
    return {
      requirementId,
      status: 'done',
      reason: 'Requirement is explicitly evidenced in agent output.',
      citations: baseCitation.concat([`agent_output:match:${requirementId}`])
    };
  }

  const matchedKeywords = extractKeywords(requirementText).filter((word) => normalizedOutput.includes(word));
  if (matchedKeywords.length > 0) {
    return {
      requirementId,
      status: 'partial',
      reason: 'Requirement has partial evidence but remains incomplete.',
      citations: baseCitation.concat(matchedKeywords.map((word) => `agent_output:keyword:${word}`))
    };
  }

  return {
    requirementId,
    status: 'todo',
    reason: 'No evidence found in agent output.',
    citations: baseCitation
  };
}

function extractKeywords(text: string): string[] {
  const seen = new Set<string>();
  const words = text.match(/[a-z0-9]{4,}/g) ?? [];
  for (const word of words) {
    seen.add(word);
  }
  return Array.from(seen).sort();
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function stableTicketId(outstanding: LedgerEntry[]): string {
  return crypto.createHash('sha256').update(JSON.stringify(outstanding)).digest('hex').slice(0, 16);
}

function loadPriorDoneEvidence(ledgerPath: string | undefined): Map<string, string[]> {
  if (!ledgerPath || !fs.existsSync(ledgerPath)) {
    return new Map<string, string[]>();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    if (!Array.isArray(parsed)) {
      return new Map<string, string[]>();
    }
    const result = new Map<string, string[]>();
    for (const rawEntry of parsed) {
      const requirementId = asString(rawEntry?.requirementId);
      const status = asString(rawEntry?.status);
      const citations = asStringArray(rawEntry?.citations);
      if (!requirementId || citations.length === 0) {
        continue;
      }
      if (status === 'done') {
        result.set(requirementId, stableUnique(citations));
        continue;
      }
      if (status === 'blocked') {
        const priorDone = citations
          .filter((citation) => citation.startsWith('prior_done:'))
          .map((citation) => citation.replace(/^prior_done:/, ''));
        if (priorDone.length > 0) {
          result.set(requirementId, stableUnique(priorDone));
        }
      }
    }
    return result;
  } catch {
    return new Map<string, string[]>();
  }
}

function removeFileIfExists(filePath: string | undefined): void {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function stableUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function writeCanonicalJson(filePath: string | undefined, payload: unknown): void {
  if (!filePath) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}
