import test from 'node:test';
import assert from 'node:assert';
import {
  confirmFirstRunWizardRepoRoot,
  createFirstRunWizardDraft,
  finalizeFirstRunWizard,
} from '../../src/s18/build_mode/first_run_wizard.ts';

test('S18-UXQ-01 wizard: captures idea and auto project name deterministically', () => {
  const draft = createFirstRunWizardDraft({
    ideaText: 'PromptOps build mode cockpit',
    explicitRepoRoot: '/tmp/promptops/repo-wizard-a',
  });

  assert.strictEqual(draft.ideaText, 'PromptOps build mode cockpit');
  assert.strictEqual(draft.projectNameSuggestion, 'promptops-build-mode-cockpit');
  assert.strictEqual(draft.projectName, 'promptops-build-mode-cockpit');
  assert.strictEqual(draft.projectNameSource, 'auto');
  assert.strictEqual(draft.repoRoot, '/tmp/promptops/repo-wizard-a');
  assert.strictEqual(draft.repoRootConfirmed, false);
});

test('S18-UXQ-01 wizard: manual project name override survives finalization', () => {
  const draft = createFirstRunWizardDraft({
    ideaText: 'PromptOps build mode cockpit',
    explicitRepoRoot: '/tmp/promptops/repo-wizard-b',
    projectNameOverride: 'Operator Console',
  });

  const artifact = finalizeFirstRunWizard(confirmFirstRunWizardRepoRoot(draft));
  assert.strictEqual(artifact.projectName, 'operator-console');
  assert.strictEqual(artifact.projectNameSource, 'manual');
  assert.strictEqual(artifact.repoRoot, '/tmp/promptops/repo-wizard-b');
  assert.strictEqual(artifact.repoRootConfirmed, true);
  assert.strictEqual(artifact.projectContext.projectName, 'operator-console');
  assert.strictEqual(artifact.projectContext.projectNameSource, 'manual');
});

test('S18-UXQ-01 wizard: repo root confirmation is mandatory and resets on changed input', () => {
  const confirmed = confirmFirstRunWizardRepoRoot(
    createFirstRunWizardDraft({
      ideaText: 'Ship first-run wizard',
      explicitRepoRoot: '/tmp/promptops/repo-wizard-c',
    }),
  );

  const changedRootDraft = createFirstRunWizardDraft({
    ideaText: confirmed.ideaText,
    explicitRepoRoot: '/tmp/promptops/repo-wizard-d',
    projectNameOverride: confirmed.projectNameOverride,
  });

  assert.strictEqual(changedRootDraft.repoRootConfirmed, false);
  assert.throws(() => finalizeFirstRunWizard(changedRootDraft), /WIZARD_REPO_ROOT_CONFIRMATION_REQUIRED/);
  assert.throws(() => confirmFirstRunWizardRepoRoot(createFirstRunWizardDraft({ ideaText: 'No root yet' })), /WIZARD_REPO_ROOT_UNRESOLVED/);
});

test('S18-UXQ-01 wizard: create draft ignores preconfirmed repo-root input', () => {
  const draft = createFirstRunWizardDraft({
    ideaText: 'Ship first-run wizard',
    explicitRepoRoot: '/tmp/promptops/repo-wizard-e',
    repoRootConfirmed: true,
  });

  assert.strictEqual(draft.repoRootConfirmed, false);
  assert.throws(() => finalizeFirstRunWizard(draft), /WIZARD_REPO_ROOT_CONFIRMATION_REQUIRED/);
});

test('S18-UXQ-01 wizard: finalization uses confirmed repo root rather than mutable draft input', () => {
  const confirmed = confirmFirstRunWizardRepoRoot(
    createFirstRunWizardDraft({
      ideaText: 'Ship first-run wizard',
      explicitRepoRoot: '/tmp/promptops/repo-wizard-f',
      projectNameOverride: 'Operator Console',
    }),
  );

  const artifact = finalizeFirstRunWizard({
    ...confirmed,
    repoRootInput: './mutated-relative-root',
  });

  assert.strictEqual(artifact.repoRoot, '/tmp/promptops/repo-wizard-f');
  assert.strictEqual(artifact.projectContext.repoRoot, '/tmp/promptops/repo-wizard-f');
  assert.strictEqual(artifact.projectContext.projectName, 'operator-console');
});
