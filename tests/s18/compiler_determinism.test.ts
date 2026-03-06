import test from 'node:test';
import assert from 'node:assert';
import { buildProjectContextArtifact } from '../../src/s18/build_mode/project_bootstrap.ts';
import { generateSprintRequirements } from '../../src/s18/build_mode/planner.ts';
import { compilePromptFromRequirements } from '../../src/s18/build_mode/prompt_compiler.ts';

const VALID_TEMPLATE = JSON.stringify({
  sprint_id: '{{sprint_id}}',
  project_name: '{{project_name}}',
  repo_root: '{{repo_root}}',
  repo_root_strategy: '{{repo_root_strategy}}',
  requirements_json: '{{requirements_json}}',
  requirements_hash: '{{requirements_hash}}',
});

test('S18 compiler: same inputs produce byte-identical prompt artifact', () => {
  const context = buildProjectContextArtifact({
    ideaText: 'Compile deterministic prompt',
    explicitRepoRoot: '/tmp/promptops/repo-f',
  });
  const requirements = generateSprintRequirements({
    sprintId: 'S18',
    ideaText: 'Automate sprint loop',
    sprintTemplateText: '- Build sprint prompt',
    templateVersionHash: 'tmpl-v3',
    projectContext: context,
  });

  const first = compilePromptFromRequirements({
    sprintId: 'S18',
    ticketTemplateBody: VALID_TEMPLATE,
    ticketTemplateVersionHash: 'ticket-v3',
    requirements,
    projectContext: context,
  });
  const second = compilePromptFromRequirements({
    sprintId: 'S18',
    ticketTemplateBody: VALID_TEMPLATE,
    ticketTemplateVersionHash: 'ticket-v3',
    requirements,
    projectContext: context,
  });

  assert.strictEqual(first.promptJson, second.promptJson);
  assert.strictEqual(first.sha256, second.sha256);
});

test('S18 compiler: missing placeholders fail deterministically', () => {
  const context = buildProjectContextArtifact({
    ideaText: 'Compile deterministic prompt',
    explicitRepoRoot: '/tmp/promptops/repo-f',
  });
  const requirements = generateSprintRequirements({
    sprintId: 'S18',
    ideaText: 'Automate sprint loop',
    sprintTemplateText: '- Build sprint prompt',
    templateVersionHash: 'tmpl-v3',
    projectContext: context,
  });

  assert.throws(
    () =>
      compilePromptFromRequirements({
        sprintId: 'S18',
        ticketTemplateBody: JSON.stringify({ missing: '{{unknown_key}}' }),
        ticketTemplateVersionHash: 'ticket-v3',
        requirements,
        projectContext: context,
      }),
    /PROMPT_COMPILATION_FAILED:needs_input/,
  );
});
