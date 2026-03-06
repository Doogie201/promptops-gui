import test from 'node:test';
import assert from 'node:assert';
import { generateSprintRequirements } from '../../src/s18/build_mode/planner.ts';
import { buildProjectContextArtifact } from '../../src/s18/build_mode/project_bootstrap.ts';

function projectContext() {
  return buildProjectContextArtifact({
    ideaText: 'North star loop',
    explicitRepoRoot: '/tmp/promptops/repo-e',
  });
}

test('S18 planner: same input yields identical canonical JSON and hash', () => {
  const context = projectContext();
  const input = {
    sprintId: 'S18',
    ideaText: 'Automate sprint loop',
    sprintTemplateText: ['- Generate requirements', '- Validate requirements'].join('\n'),
    templateVersionHash: 'tmpl-v2',
    projectContext: context,
  };

  const first = generateSprintRequirements(input);
  const second = generateSprintRequirements(input);

  assert.strictEqual(first.canonicalJson, second.canonicalJson);
  assert.strictEqual(first.sha256, second.sha256);
  assert.strictEqual(first.requirements.length, 2);
});

test('S18 planner: fallback requirement is deterministic when template has no bullets', () => {
  const result = generateSprintRequirements({
    sprintId: 'S18',
    ideaText: 'Ship orchestrator',
    sprintTemplateText: 'no bullet format',
    templateVersionHash: 'tmpl-v2',
    projectContext: projectContext(),
  });

  assert.strictEqual(result.requirements.length, 1);
  assert.strictEqual(result.requirements[0].id, 'REQ-001');
  assert.match(result.requirements[0].text, /Ship orchestrator/);
});
