import { stableHash } from './hash.ts';
import {
  autoProjectNameFromIdea,
  buildProjectContextArtifact,
  type ProjectContextArtifact,
  type RepoRootStrategy,
  resolveRepoRoot,
} from './project_bootstrap.ts';

export interface FirstRunWizardDraft {
  ideaText: string;
  projectNameSuggestion: string;
  projectNameOverride: string;
  projectName: string;
  projectNameSource: 'auto' | 'manual';
  repoRootInput: string;
  repoRoot: string | null;
  repoRootStrategy: RepoRootStrategy | null;
  repoRootConfirmed: boolean;
}

export interface FirstRunWizardArtifact {
  ideaText: string;
  projectName: string;
  projectNameSource: 'auto' | 'manual';
  repoRoot: string;
  repoRootStrategy: RepoRootStrategy;
  repoRootConfirmed: true;
  projectContext: ProjectContextArtifact;
  sha256: string;
}

export function createFirstRunWizardDraft(input: {
  ideaText?: string;
  explicitRepoRoot?: string;
  envPromptopsRepo?: string;
  projectNameOverride?: string;
  repoRootConfirmed?: boolean;
}): FirstRunWizardDraft {
  const ideaText = input.ideaText?.trim() ?? '';
  const projectNameOverride = input.projectNameOverride?.trim() ?? '';
  const projectNameSource = projectNameOverride ? 'manual' : 'auto';
  const projectNameSuggestion = autoProjectNameFromIdea(ideaText);
  const projectName = autoProjectNameFromIdea(projectNameOverride || ideaText);
  const resolved = resolveRepoRoot(input.explicitRepoRoot, input.envPromptopsRepo);

  return {
    ideaText,
    projectNameSuggestion,
    projectNameOverride,
    projectName,
    projectNameSource,
    repoRootInput: input.explicitRepoRoot?.trim() ?? input.envPromptopsRepo?.trim() ?? '',
    repoRoot: resolved?.repoRoot ?? null,
    repoRootStrategy: resolved?.strategy ?? null,
    repoRootConfirmed: false,
  };
}

export function confirmFirstRunWizardRepoRoot(draft: FirstRunWizardDraft): FirstRunWizardDraft {
  if (!draft.repoRoot || !draft.repoRootStrategy) {
    throw new Error('WIZARD_REPO_ROOT_UNRESOLVED');
  }

  return {
    ...draft,
    repoRootConfirmed: true,
  };
}

export function finalizeFirstRunWizard(draft: FirstRunWizardDraft): FirstRunWizardArtifact {
  if (!draft.ideaText) {
    throw new Error('WIZARD_IDEA_REQUIRED');
  }
  if (!draft.repoRoot || !draft.repoRootStrategy || !draft.repoRootConfirmed) {
    throw new Error('WIZARD_REPO_ROOT_CONFIRMATION_REQUIRED');
  }

  const projectContext = buildProjectContextArtifact({
    ideaText: draft.ideaText,
    explicitRepoRoot: draft.repoRootStrategy === 'explicit_input' ? draft.repoRoot : undefined,
    envPromptopsRepo: draft.repoRootStrategy === 'env_PROMPTOPS_REPO' ? draft.repoRoot : undefined,
    projectNameOverride: draft.projectNameSource === 'manual' ? draft.projectNameOverride : undefined,
  });

  const artifact = {
    ideaText: draft.ideaText,
    projectName: draft.projectName,
    projectNameSource: draft.projectNameSource,
    repoRoot: draft.repoRoot,
    repoRootStrategy: draft.repoRootStrategy,
    repoRootConfirmed: true as const,
    projectContext,
  };

  return {
    ...artifact,
    sha256: stableHash(artifact),
  };
}
