import test from 'node:test';
import assert from 'node:assert';
import { buildProjectContextArtifact } from '../../src/s18/build_mode/project_bootstrap.ts';
import { injectProjectContextIntoPrompt } from '../../src/s18/build_mode/prompt_context.ts';
import { generateSprintRequirements } from '../../src/s18/build_mode/planner.ts';
import { compilePromptFromRequirements } from '../../src/s18/build_mode/prompt_compiler.ts';

const TICKET_TEMPLATE_BODY = JSON.stringify({
  sprint_id: '{{sprint_id}}',
  project_name: '{{project_name}}',
  repo_root: '{{repo_root}}',
  repo_root_strategy: '{{repo_root_strategy}}',
  requirements_json: '{{requirements_json}}',
  requirements_hash: '{{requirements_hash}}',
});

test('S18 prompt context: injects deterministic project context fields', () => {
  const context = buildProjectContextArtifact({
    ideaText: 'Create Build Mode',
    explicitRepoRoot: '/tmp/promptops/repo-c',
  });

  const base = { type: 'json_prompt', sprint: 'S18' } as const;
  const withContext = injectProjectContextIntoPrompt(base, context);

  assert.deepStrictEqual(base, { type: 'json_prompt', sprint: 'S18' });
  assert.strictEqual(withContext.project_context.projectId, context.projectId);
  assert.strictEqual(withContext.project_context.repoRoot, '/tmp/promptops/repo-c');
  assert.strictEqual(withContext.project_context.repoRootStrategy, 'explicit_input');
});

test('S18 compiler: generated prompt includes repo root + strategy context', () => {
  const context = buildProjectContextArtifact({
    ideaText: 'Create Build Mode',
    explicitRepoRoot: '/tmp/promptops/repo-d',
  });

  const requirements = generateSprintRequirements({
    sprintId: 'S18',
    ideaText: 'Automate sprint loop',
    sprintTemplateText: '- Translate idea to sprint requirements',
    templateVersionHash: 'tmpl-v1',
    projectContext: context,
  });

  const compiled = compilePromptFromRequirements({
    sprintId: 'S18',
    ticketTemplateBody: TICKET_TEMPLATE_BODY,
    ticketTemplateVersionHash: 'ticket-v1',
    requirements,
    projectContext: context,
  });

  const parsed = JSON.parse(compiled.promptJson) as {
    repo_root: string;
    repo_root_strategy: string;
    project_context: { repoRoot: string; repoRootStrategy: string };
  };

  assert.strictEqual(compiled.repoRoot, '/tmp/promptops/repo-d');
  assert.strictEqual(compiled.repoRootStrategy, 'explicit_input');
  assert.strictEqual(parsed.repo_root, '/tmp/promptops/repo-d');
  assert.strictEqual(parsed.repo_root_strategy, 'explicit_input');
  assert.strictEqual(parsed.project_context.repoRoot, '/tmp/promptops/repo-d');
  assert.strictEqual(parsed.project_context.repoRootStrategy, 'explicit_input');
});
