import { stableHash, stableJson } from './hash.ts';
import { injectProjectContextIntoPrompt } from './prompt_context.ts';
import type { ProjectContextArtifact } from './project_bootstrap.ts';
import type { SprintRequirementsArtifact } from './planner.ts';

export interface PromptArtifact {
  sprintId: string;
  projectId: string;
  projectName: string;
  repoRoot: string;
  repoRootStrategy: 'explicit_input' | 'env_PROMPTOPS_REPO';
  requirementsHash: string;
  templateVersionHash: string;
  promptJson: string;
  sha256: string;
}

interface TemplateCompileResult {
  state: 'needs_input' | 'ready' | 'invalid';
  outputJson?: string;
}

function compileTemplateBody(templateBody: string, context: Record<string, string>): TemplateCompileResult {
  const placeholderRegex = /\{\{([^}]+)\}\}/g;
  const missing = new Set<string>();

  let match: RegExpExecArray | null = null;
  while ((match = placeholderRegex.exec(templateBody)) !== null) {
    const key = match[1]?.trim() ?? '';
    if (!key || !(key in context) || context[key] === '') {
      missing.add(key);
    }
  }

  if (missing.size > 0) {
    return { state: 'needs_input' };
  }

  const rendered = templateBody.replace(placeholderRegex, (_full, keyRaw: string) => {
    const key = keyRaw.trim();
    const escaped = JSON.stringify(context[key] ?? '');
    return escaped.slice(1, -1);
  });

  try {
    const parsed = JSON.parse(rendered);
    return { state: 'ready', outputJson: stableJson(parsed) };
  } catch {
    return { state: 'invalid' };
  }
}

export function compilePromptFromRequirements(input: {
  sprintId: string;
  ticketTemplateBody: string;
  ticketTemplateVersionHash: string;
  requirements: SprintRequirementsArtifact;
  projectContext: ProjectContextArtifact;
}): PromptArtifact {
  const compiled = compileTemplateBody(input.ticketTemplateBody, {
    sprint_id: input.sprintId,
    project_name: input.projectContext.projectName,
    repo_root: input.projectContext.repoRoot,
    repo_root_strategy: input.projectContext.repoRootStrategy,
    requirements_json: input.requirements.canonicalJson,
    requirements_hash: input.requirements.sha256,
  });

  if (compiled.state !== 'ready' || !compiled.outputJson) {
    throw new Error(`PROMPT_COMPILATION_FAILED:${compiled.state}`);
  }

  const parsed = JSON.parse(compiled.outputJson) as Record<string, unknown>;
  const withContext = injectProjectContextIntoPrompt(parsed, input.projectContext);
  const promptJson = stableJson(withContext);
  const core = {
    sprintId: input.sprintId,
    projectId: input.projectContext.projectId,
    projectName: input.projectContext.projectName,
    repoRoot: input.projectContext.repoRoot,
    repoRootStrategy: input.projectContext.repoRootStrategy,
    requirementsHash: input.requirements.sha256,
    templateVersionHash: input.ticketTemplateVersionHash,
    promptJson,
  };

  return {
    ...core,
    sha256: stableHash(core),
  };
}
