import test from 'node:test';
import assert from 'node:assert';
import { buildProjectContextArtifact } from '../../src/s18/build_mode/project_bootstrap.ts';
import { generateSprintRequirements } from '../../src/s18/build_mode/planner.ts';
import { compilePromptFromRequirements } from '../../src/s18/build_mode/prompt_compiler.ts';
import { buildDiffFirstDeltaReview } from '../../src/s18/build_mode/delta_review.ts';

const TICKET_TEMPLATE = JSON.stringify({
  sprint_id: '{{sprint_id}}',
  project_name: '{{project_name}}',
  repo_root: '{{repo_root}}',
  repo_root_strategy: '{{repo_root_strategy}}',
  requirements_json: '{{requirements_json}}',
  requirements_hash: '{{requirements_hash}}',
});

function buildArtifacts(input: {
  repoRoot: string;
  sprintTemplateText: string;
  ticketTemplateBody?: string;
}) {
  const context = buildProjectContextArtifact({
    ideaText: 'PromptOps delta review',
    explicitRepoRoot: input.repoRoot,
  });
  const requirements = generateSprintRequirements({
    sprintId: 'S18',
    ideaText: 'Ship diff-first delta review',
    sprintTemplateText: input.sprintTemplateText,
    templateVersionHash: 'tmpl-delta-v1',
    projectContext: context,
  });
  const prompt = compilePromptFromRequirements({
    sprintId: 'S18',
    ticketTemplateBody: input.ticketTemplateBody ?? TICKET_TEMPLATE,
    ticketTemplateVersionHash: 'ticket-delta-v1',
    requirements,
    projectContext: context,
  });

  return { context, requirements, prompt };
}

test('S18-UXQ-04 delta review: same inputs produce byte-identical review output', () => {
  const previous = buildArtifacts({
    repoRoot: '/tmp/promptops/repo-g',
    sprintTemplateText: ['- Keep current requirement set', '- Capture receipts'].join('\n'),
  });
  const current = buildArtifacts({
    repoRoot: '/tmp/promptops/repo-g',
    sprintTemplateText: ['- Update requirement set', '- Capture receipts'].join('\n'),
  });

  const first = buildDiffFirstDeltaReview({
    previousRequirements: previous.requirements,
    currentRequirements: current.requirements,
    previousPrompt: previous.prompt,
    currentPrompt: current.prompt,
  });
  const second = buildDiffFirstDeltaReview({
    previousRequirements: previous.requirements,
    currentRequirements: current.requirements,
    previousPrompt: previous.prompt,
    currentPrompt: current.prompt,
  });

  assert.strictEqual(first.rendered, second.rendered);
  assert.strictEqual(first.sha256, second.sha256);
});

test('S18-UXQ-04 delta review: shows deterministic diff for changed requirements and prompt fields', () => {
  const previous = buildArtifacts({
    repoRoot: '/tmp/promptops/repo-h',
    sprintTemplateText: ['- Keep current requirement set', '- Capture receipts'].join('\n'),
  });
  const current = buildArtifacts({
    repoRoot: '/tmp/promptops/repo-h',
    sprintTemplateText: ['- Update requirement set', '- Capture receipts', '- Add delta review gate'].join('\n'),
  });

  const review = buildDiffFirstDeltaReview({
    previousRequirements: previous.requirements,
    currentRequirements: current.requirements,
    previousPrompt: previous.prompt,
    currentPrompt: current.prompt,
  });

  assert.strictEqual(review.mode, 'delta');
  assert.strictEqual(review.reviewRequired, true);
  assert.strictEqual(review.hasMaterialChanges, true);
  assert.strictEqual(review.readyForDispatch, true);
  assert.match(review.sections[0].rendered, /Requirements delta: 2 change\(s\) vs prior/);
  assert.match(review.sections[0].rendered, /~ REQ-001:/);
  assert.match(review.sections[0].rendered, /\+ REQ-003:/);
  assert.match(review.sections[1].rendered, /~ requirements_hash:/);
});

test('S18-UXQ-04 delta review: initial prompt path records absence of prior artifacts', () => {
  const current = buildArtifacts({
    repoRoot: '/tmp/promptops/repo-i',
    sprintTemplateText: '- Build initial prompt',
  });

  const review = buildDiffFirstDeltaReview({
    currentRequirements: current.requirements,
    currentPrompt: current.prompt,
  });

  assert.strictEqual(review.mode, 'initial');
  assert.strictEqual(review.reviewRequired, false);
  assert.strictEqual(review.readyForDispatch, true);
  assert.match(review.sections[0].rendered, /Initial requirements set; no prior artifact/);
  assert.match(review.sections[1].rendered, /Initial prompt set; no prior artifact/);
});

test('S18-UXQ-04 delta review: no-op delta remains reviewable and blocks redundant dispatch', () => {
  const previous = buildArtifacts({
    repoRoot: '/tmp/promptops/repo-j',
    sprintTemplateText: ['- Keep current requirement set', '- Capture receipts'].join('\n'),
  });

  const review = buildDiffFirstDeltaReview({
    previousRequirements: previous.requirements,
    currentRequirements: previous.requirements,
    previousPrompt: previous.prompt,
    currentPrompt: previous.prompt,
  });

  assert.strictEqual(review.mode, 'delta');
  assert.strictEqual(review.reviewRequired, true);
  assert.strictEqual(review.hasMaterialChanges, false);
  assert.strictEqual(review.readyForDispatch, false);
  assert.match(review.sections[0].rendered, /No material changes vs prior/);
  assert.match(review.sections[1].rendered, /No material changes vs prior/);
});
