import path from 'node:path';
import { stableHash } from './hash.ts';

export type RepoRootStrategy = 'explicit_input' | 'env_PROMPTOPS_REPO';

export interface ProjectContextArtifact {
  projectId: string;
  projectName: string;
  projectNameSource: 'auto' | 'manual';
  repoRoot: string;
  repoRootStrategy: RepoRootStrategy;
  sha256: string;
}

interface ResolvedRepoRoot {
  repoRoot: string;
  strategy: RepoRootStrategy;
}

export function autoProjectNameFromIdea(ideaText: string): string {
  const raw = ideaText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!raw) return 'project';
  return raw.slice(0, 63);
}

export function resolveRepoRoot(explicitInput?: string, envPromptopsRepo?: string): ResolvedRepoRoot | null {
  if (explicitInput && explicitInput.trim()) {
    return { repoRoot: path.resolve(explicitInput.trim()), strategy: 'explicit_input' };
  }
  if (envPromptopsRepo && envPromptopsRepo.trim()) {
    return { repoRoot: path.resolve(envPromptopsRepo.trim()), strategy: 'env_PROMPTOPS_REPO' };
  }
  return null;
}

export function buildProjectContextArtifact(input: {
  ideaText: string;
  explicitRepoRoot?: string;
  envPromptopsRepo?: string;
  projectNameOverride?: string;
}): ProjectContextArtifact {
  const resolved = resolveRepoRoot(input.explicitRepoRoot, input.envPromptopsRepo);
  if (!resolved) {
    throw new Error('HARD STOP: MISSING_REPO_ROOT (set PROMPTOPS_REPO or provide repo path)');
  }

  const override = input.projectNameOverride?.trim();
  const projectNameSource = override ? 'manual' : 'auto';
  const projectName = override ? autoProjectNameFromIdea(override) : autoProjectNameFromIdea(input.ideaText);
  const projectId = stableHash({ projectName, repoRoot: resolved.repoRoot }).slice(0, 16);

  const base = {
    projectId,
    projectName,
    projectNameSource,
    repoRoot: resolved.repoRoot,
    repoRootStrategy: resolved.strategy,
  };

  return {
    ...base,
    sha256: stableHash(base),
  };
}
