import test from 'node:test';
import assert from 'node:assert';
import {
  autoProjectNameFromIdea,
  buildProjectContextArtifact,
  resolveRepoRoot,
} from '../../src/s18/build_mode/project_bootstrap.ts';

test('S18 bootstrap: deterministic project naming and explicit repo root', () => {
  const name = autoProjectNameFromIdea('PromptOps Build Mode: Orchestrate Sprints!');
  assert.strictEqual(name, 'promptops-build-mode-orchestrate-sprints');

  const resolved = resolveRepoRoot(' ./repo ', undefined);
  assert.ok(resolved);
  assert.strictEqual(resolved?.strategy, 'explicit_input');
  assert.ok(resolved?.repoRoot.endsWith('/repo'));

  const first = buildProjectContextArtifact({
    ideaText: 'Build orchestrator',
    explicitRepoRoot: '/tmp/promptops/repo-a',
    projectNameOverride: 'My Product',
  });
  const second = buildProjectContextArtifact({
    ideaText: 'Build orchestrator',
    explicitRepoRoot: '/tmp/promptops/repo-a',
    projectNameOverride: 'My Product',
  });

  assert.strictEqual(first.projectName, 'my-product');
  assert.strictEqual(first.projectNameSource, 'manual');
  assert.strictEqual(first.repoRootStrategy, 'explicit_input');
  assert.strictEqual(first.sha256, second.sha256);
});

test('S18 bootstrap: env fallback works when explicit input is absent', () => {
  const artifact = buildProjectContextArtifact({
    ideaText: 'Ship app',
    envPromptopsRepo: '/tmp/promptops/repo-b',
  });

  assert.strictEqual(artifact.projectNameSource, 'auto');
  assert.strictEqual(artifact.projectName, 'ship-app');
  assert.strictEqual(artifact.repoRoot, '/tmp/promptops/repo-b');
  assert.strictEqual(artifact.repoRootStrategy, 'env_PROMPTOPS_REPO');
});

test('S18 bootstrap: missing repo root hard-stops deterministically', () => {
  assert.throws(
    () =>
      buildProjectContextArtifact({
        ideaText: 'No root provided',
      }),
    /HARD STOP: MISSING_REPO_ROOT/,
  );
});
