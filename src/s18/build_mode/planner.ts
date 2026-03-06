import { stableHash, stableJson } from './hash.ts';
import type { ProjectContextArtifact } from './project_bootstrap.ts';

export interface PlannedRequirement {
  id: string;
  text: string;
  acceptance: string[];
}

export interface SprintRequirementsArtifact {
  sprintId: string;
  projectId: string;
  projectName: string;
  repoRoot: string;
  templateVersionHash: string;
  requirements: PlannedRequirement[];
  canonicalJson: string;
  sha256: string;
}

export function generateSprintRequirements(input: {
  sprintId: string;
  ideaText: string;
  sprintTemplateText: string;
  templateVersionHash: string;
  projectContext: ProjectContextArtifact;
}): SprintRequirementsArtifact {
  const lines = input.sprintTemplateText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));

  const sourceLines = lines.length > 0 ? lines : [`- ${input.ideaText.trim() || 'Define sprint objective'}`];

  const requirements = sourceLines.map((line, index) => {
    const text = line.replace(/^-\s+/, '').replaceAll('{{IDEA}}', input.ideaText.trim() || 'idea');
    const id = `REQ-${String(index + 1).padStart(3, '0')}`;
    return {
      id,
      text,
      acceptance: [`${id} is complete with evidence.`],
    };
  });

  const core = {
    sprintId: input.sprintId,
    projectId: input.projectContext.projectId,
    projectName: input.projectContext.projectName,
    repoRoot: input.projectContext.repoRoot,
    templateVersionHash: input.templateVersionHash,
    requirements,
  };

  const canonicalJson = stableJson(core);
  return {
    ...core,
    canonicalJson,
    sha256: stableHash(core),
  };
}
