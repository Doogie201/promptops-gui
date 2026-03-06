import type { ProjectContextArtifact } from './project_bootstrap.ts';

export function injectProjectContextIntoPrompt(
  promptPayload: Record<string, unknown>,
  context: ProjectContextArtifact,
): Record<string, unknown> {
  return {
    ...promptPayload,
    project_context: {
      projectId: context.projectId,
      projectName: context.projectName,
      repoRoot: context.repoRoot,
      repoRootStrategy: context.repoRootStrategy,
      projectContextHash: context.sha256,
    },
  };
}
