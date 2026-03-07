import { sha256, stableHash } from './hash.ts';
import type { SprintRequirementsArtifact } from './planner.ts';
import type { PromptArtifact } from './prompt_compiler.ts';

export type DeltaReviewMode = 'initial' | 'delta';
export type DeltaReviewChangeKind = 'added' | 'removed' | 'changed';

export interface DeltaReviewEntry {
  path: string;
  kind: DeltaReviewChangeKind;
  previousValue: string | null;
  currentValue: string | null;
  rendered: string;
}

export interface DeltaReviewSection {
  id: 'requirements' | 'prompt';
  label: string;
  previousHash: string | null;
  currentHash: string;
  changed: boolean;
  changeCount: number;
  entries: DeltaReviewEntry[];
  summary: string;
  rendered: string;
}

export interface DeltaReviewModel {
  mode: DeltaReviewMode;
  reviewRequired: boolean;
  hasMaterialChanges: boolean;
  readyForDispatch: boolean;
  sections: DeltaReviewSection[];
  rendered: string;
  sha256: string;
}

interface RequirementLike {
  id: string;
  text: string;
  acceptance: string[];
}

type FlatValueMap = Map<string, string>;

function summarizeScalar(value: unknown): string {
  const raw = JSON.stringify(value);
  if (raw.length <= 96 && !raw.includes('\\n')) {
    return raw;
  }
  return JSON.stringify(`sha256:${sha256(raw).slice(0, 16)} len:${raw.length}`);
}

function renderEntry(entry: {
  path: string;
  kind: DeltaReviewChangeKind;
  previousValue: string | null;
  currentValue: string | null;
}): string {
  if (entry.kind === 'added') {
    return `+ ${entry.path}: ${entry.currentValue}`;
  }
  if (entry.kind === 'removed') {
    return `- ${entry.path}: ${entry.previousValue}`;
  }
  return `~ ${entry.path}: ${entry.previousValue} -> ${entry.currentValue}`;
}

function createEntry(input: {
  path: string;
  kind: DeltaReviewChangeKind;
  previousValue: string | null;
  currentValue: string | null;
}): DeltaReviewEntry {
  return {
    ...input,
    rendered: renderEntry(input),
  };
}

function toRequirementMap(value: SprintRequirementsArtifact | undefined): Map<string, RequirementLike> {
  if (!value) {
    return new Map();
  }
  return new Map(value.requirements.map((requirement) => [requirement.id, requirement]));
}

function summarizeRequirement(requirement: RequirementLike): string {
  return summarizeScalar({
    text: requirement.text,
    acceptance: requirement.acceptance,
  });
}

function diffRequirements(
  previousRequirements: SprintRequirementsArtifact | undefined,
  currentRequirements: SprintRequirementsArtifact,
): DeltaReviewEntry[] {
  const previousMap = toRequirementMap(previousRequirements);
  const currentMap = toRequirementMap(currentRequirements);
  const ids = [...new Set([...previousMap.keys(), ...currentMap.keys()])].sort();
  const entries: DeltaReviewEntry[] = [];

  for (const id of ids) {
    const previous = previousMap.get(id);
    const current = currentMap.get(id);
    if (!previous && current) {
      entries.push(
        createEntry({
          path: id,
          kind: 'added',
          previousValue: null,
          currentValue: summarizeRequirement(current),
        }),
      );
      continue;
    }
    if (previous && !current) {
      entries.push(
        createEntry({
          path: id,
          kind: 'removed',
          previousValue: summarizeRequirement(previous),
          currentValue: null,
        }),
      );
      continue;
    }
    if (!previous || !current) {
      continue;
    }
    const previousSummary = summarizeRequirement(previous);
    const currentSummary = summarizeRequirement(current);
    if (previousSummary !== currentSummary) {
      entries.push(
        createEntry({
          path: id,
          kind: 'changed',
          previousValue: previousSummary,
          currentValue: currentSummary,
        }),
      );
    }
  }

  return entries;
}

function flattenValue(value: unknown, path: string, target: FlatValueMap): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      target.set(path, '[]');
      return;
    }
    value.forEach((entry, index) => {
      flattenValue(entry, `${path}[${index}]`, target);
    });
    return;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    if (keys.length === 0) {
      target.set(path, '{}');
      return;
    }
    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      flattenValue((value as Record<string, unknown>)[key], nextPath, target);
    }
    return;
  }

  target.set(path || '$', summarizeScalar(value));
}

function flattenPrompt(prompt: PromptArtifact | undefined): FlatValueMap {
  const flattened = new Map<string, string>();
  if (!prompt) {
    return flattened;
  }
  flattenValue(JSON.parse(prompt.promptJson) as Record<string, unknown>, '', flattened);
  return flattened;
}

function diffPrompt(previousPrompt: PromptArtifact | undefined, currentPrompt: PromptArtifact): DeltaReviewEntry[] {
  const previousMap = flattenPrompt(previousPrompt);
  const currentMap = flattenPrompt(currentPrompt);
  const paths = [...new Set([...previousMap.keys(), ...currentMap.keys()])].sort();
  const entries: DeltaReviewEntry[] = [];

  for (const path of paths) {
    const previousValue = previousMap.get(path) ?? null;
    const currentValue = currentMap.get(path) ?? null;
    if (previousValue === currentValue) {
      continue;
    }
    let kind: DeltaReviewChangeKind = 'changed';
    if (previousValue === null) {
      kind = 'added';
    } else if (currentValue === null) {
      kind = 'removed';
    }
    entries.push(createEntry({ path, kind, previousValue, currentValue }));
  }

  return entries;
}

function renderSection(label: string, summary: string, entries: readonly DeltaReviewEntry[]): string {
  const lines = [`${label}: ${summary}`];
  if (entries.length === 0) {
    lines.push('  no changes');
  } else {
    lines.push(...entries.map((entry) => `  ${entry.rendered}`));
  }
  return lines.join('\n');
}

function buildSection(input: {
  id: 'requirements' | 'prompt';
  label: string;
  previousHash: string | null;
  currentHash: string;
  entries: DeltaReviewEntry[];
  missingPreviousSummary: string;
}): DeltaReviewSection {
  const changed = input.entries.length > 0;
  let summary = input.missingPreviousSummary;
  if (input.previousHash !== null) {
    summary = changed ? `${input.entries.length} change(s) vs prior` : 'No material changes vs prior';
  }

  return {
    id: input.id,
    label: input.label,
    previousHash: input.previousHash,
    currentHash: input.currentHash,
    changed,
    changeCount: input.entries.length,
    entries: input.entries,
    summary,
    rendered: renderSection(input.label, summary, input.entries),
  };
}

export function buildDiffFirstDeltaReview(input: {
  previousRequirements?: SprintRequirementsArtifact;
  currentRequirements: SprintRequirementsArtifact;
  previousPrompt?: PromptArtifact;
  currentPrompt: PromptArtifact;
}): DeltaReviewModel {
  const requirementsSection = buildSection({
    id: 'requirements',
    label: 'Requirements delta',
    previousHash: input.previousRequirements?.sha256 ?? null,
    currentHash: input.currentRequirements.sha256,
    entries: diffRequirements(input.previousRequirements, input.currentRequirements),
    missingPreviousSummary: 'Initial requirements set; no prior artifact',
  });
  const promptSection = buildSection({
    id: 'prompt',
    label: 'Prompt delta',
    previousHash: input.previousPrompt?.sha256 ?? null,
    currentHash: input.currentPrompt.sha256,
    entries: diffPrompt(input.previousPrompt, input.currentPrompt),
    missingPreviousSummary: 'Initial prompt set; no prior artifact',
  });
  const sections = [requirementsSection, promptSection];
  const mode: DeltaReviewMode =
    input.previousRequirements || input.previousPrompt ? 'delta' : 'initial';
  const hasMaterialChanges = sections.some((section) => section.changed);
  const review = {
    mode,
    reviewRequired: mode === 'delta',
    hasMaterialChanges,
    readyForDispatch: mode === 'initial' || hasMaterialChanges,
    sections,
    rendered: sections.map((section) => section.rendered).join('\n---\n'),
  };

  return {
    ...review,
    sha256: stableHash(review),
  };
}
