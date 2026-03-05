import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  activateTemplateVersion,
  assessSettingsImpactOnPinnedTemplate,
  canonicalJson,
  compilePreview,
  confirmProtectedOverride,
  createDraftVersion,
  createTemplateRegistry,
  ensurePinnedTemplateExists,
  exportRegistryCanonical,
  importRegistryCanonical,
  migratePinnedRun,
  pinNewRun,
  requestProtectedOverride,
  revertMigration,
  rollbackToVersion,
  templateHash,
  type PreviewInput,
  type TemplateRegistryV2,
  type ValidationSettings,
} from './template_lifecycle.ts';

const ROOT = '/tmp/promptops/S11';
const TEST_EVIDENCE = path.join(ROOT, 'tests');
const TEMPLATE_EVIDENCE = path.join(ROOT, 'templates');
const PREVIEW_EVIDENCE = path.join(ROOT, 'preview');
const MIGRATE_EVIDENCE = path.join(ROOT, 'migrate');

const SETTINGS: ValidationSettings = {
  globalBindings: {
    REPO_OWNER: 'Doogie201',
    REPO_NAME: 'promptops-gui',
  },
  sprintPlaceholders: ['SPRINT_ID', 'PR_NUMBER', 'BRANCH_NAME'],
  forbiddenPlaceholders: ['FORBIDDEN_PLACEHOLDER'],
};

const PREVIEW_INPUT: PreviewInput = {
  sprintRequirements: {
    'Sprint Metadata': {
      'Sprint ID': 'S11-template-lifecycle-manager',
      'Objective (one sentence)': 'Implement template lifecycle manager',
      'Acceptance Tests': ['AT-S11-01', 'AT-S11-02', 'AT-S11-03', 'AT-S11-04'],
    },
  },
  globalBindings: SETTINGS.globalBindings,
  sprintBindings: {
    SPRINT_ID: 'S11-template-lifecycle-manager',
    PR_NUMBER: '99',
    BRANCH_NAME: 'sprint/S11-template-lifecycle-manager',
  },
};

prepareEvidenceRoot();

test('AT-S11-01 activation blocks missing contract keys and unbound placeholders with exact fields', () => {
  ensureEvidenceDirs();
  const base = createTemplateRegistry(createTemplateFixture(), 'operator', 'seed', 1000);
  const invalidTemplate = createTemplateFixture();
  delete invalidTemplate['Whitelist (allowed paths)'];
  invalidTemplate['Sprint Metadata'] = {
    'Sprint ID': '[[SPRINT_ID]]',
    'Objective (one sentence)': '[[UNKNOWN_PLACEHOLDER]]',
    'Acceptance Tests': ['AT-S11-01'],
  };
  invalidTemplate['Non-negotiables'] = {
    SECURITY: ['No leak [[FORBIDDEN_PLACEHOLDER]]'],
    DETERMINISM: ['Stable'],
    TESTING_AND_VALIDATION: ['REPO ROOT RESOLUTION POLICY required'],
    SCOPE: ['minimal'],
  };

  const draft = createDraftVersion(base, invalidTemplate, 'operator', 'invalid draft', 1010);
  const blocked = activateTemplateVersion(draft.registry, draft.version.versionId, SETTINGS, 'operator', 1020);

  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.reasonCode, 'ACTIVATION_BLOCKED');
  assert.ok(blocked.validation.missingTopLevelKeys.includes('Whitelist (allowed paths)'));
  assert.ok(blocked.validation.placeholderScan.unknown.includes('UNKNOWN_PLACEHOLDER'));
  assert.ok(blocked.validation.placeholderScan.forbidden.includes('FORBIDDEN_PLACEHOLDER'));

  writeJson(path.join(TEMPLATE_EVIDENCE, 'AT-S11-01_validation.json'), {
    blocked,
  });
  writeJson(path.join(TEST_EVIDENCE, 'AT-S11-01_run.json'), {
    result: 'PASS',
    blocked_reason: blocked.reasonCode,
    missing_top_level_keys: blocked.validation.missingTopLevelKeys,
    unknown_placeholders: blocked.validation.placeholderScan.unknown,
    forbidden_placeholders: blocked.validation.placeholderScan.forbidden,
  });
});

test('AT-S11-02 protected diff block + two-step override creates durable audit events', () => {
  ensureEvidenceDirs();
  const base = createTemplateRegistry(createTemplateFixture(), 'operator', 'seed', 2000);
  const weakened = createTemplateFixture();
  weakened['Hard Stops'] = ['only-one-hard-stop'];

  const draft = createDraftVersion(base, weakened, 'operator', 'weaken hard stops', 2010);
  const blocked = activateTemplateVersion(draft.registry, draft.version.versionId, SETTINGS, 'operator', 2020);

  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.reasonCode, 'PROTECTED_OVERRIDE_REQUIRED');
  assert.ok(blocked.validation.protectedDiff.weakenedSections.includes('Hard Stops'));

  const requested = requestProtectedOverride(draft.registry, draft.version.versionId, 'operator', 2030);
  const confirmed = confirmProtectedOverride(requested.registry, draft.version.versionId, requested.token, 'operator', 2040);
  assert.strictEqual(confirmed.ok, true);

  const activated = activateTemplateVersion(confirmed.registry, draft.version.versionId, SETTINGS, 'operator', 2050);
  assert.strictEqual(activated.ok, true);

  const requestedEvent = activated.registry.events.find((item) => item.type === 'override_requested');
  const confirmedEvent = activated.registry.events.find((item) => item.type === 'override_confirmed');
  assert.ok(requestedEvent);
  assert.ok(confirmedEvent);

  writeJson(path.join(TEMPLATE_EVIDENCE, 'AT-S11-02_override.json'), {
    blocked,
    override_request_token: requested.token,
    activated,
    requested_event: requestedEvent,
    confirmed_event: confirmedEvent,
  });
  writeJson(path.join(TEST_EVIDENCE, 'AT-S11-02_run.json'), {
    result: 'PASS',
    blocked_reason: blocked.reasonCode,
    weakened_sections: blocked.validation.protectedDiff.weakenedSections,
    override_token: requested.token,
    activation_ok: activated.ok,
  });
});

test('AT-S11-03 migration preserves done ledger and records idempotency old->new link', () => {
  ensureEvidenceDirs();
  const baseTemplate = createTemplateFixture();
  let registry: TemplateRegistryV2 = createTemplateRegistry(baseTemplate, 'operator', 'seed', 3000);

  const pin = pinNewRun(registry, 'S11-template-lifecycle-manager', 'run-001', 'operator', 3010);
  registry = pin.registry;

  const v2Template = createTemplateFixture();
  v2Template['Sprint Metadata'] = {
    'Sprint ID': '[[SPRINT_ID]]',
    'Objective (one sentence)': 'Updated objective for migration validation',
    'Acceptance Tests': ['AT-S11-01', 'AT-S11-02', 'AT-S11-03', 'AT-S11-04'],
  };
  const draft = createDraftVersion(registry, v2Template, 'operator', 'v2', 3020);
  const activateV2 = activateTemplateVersion(draft.registry, draft.version.versionId, SETTINGS, 'operator', 3030);
  assert.strictEqual(activateV2.ok, true);
  registry = activateV2.registry;

  const migrated = migratePinnedRun(
    registry,
    'S11-template-lifecycle-manager',
    'run-001',
    draft.version.versionId,
    PREVIEW_INPUT,
    ['ledger_done_1', 'ledger_done_2'],
    ['delta_1'],
    'operator',
    3040,
  );

  assert.notStrictEqual(migrated.migration.oldIdempotencyKey, migrated.migration.newIdempotencyKey);
  assert.deepStrictEqual(migrated.continuityPacket.done_ledger_ids, ['ledger_done_1', 'ledger_done_2']);
  assert.strictEqual(migrated.registry.runPins['run-001'], draft.version.versionId);

  const previewAgain = compilePreview(draft.version, PREVIEW_INPUT);
  assert.strictEqual(previewAgain.renderedCanonical, canonicalJson(previewAgain.renderedTicketJson));

  writeJson(path.join(MIGRATE_EVIDENCE, 'AT-S11-03_migration.json'), {
    migrated,
  });
  writeText(path.join(MIGRATE_EVIDENCE, 'AT-S11-03_continuity_packet.json'), canonicalJson(migrated.continuityPacket));
  writeText(
    path.join(MIGRATE_EVIDENCE, 'AT-S11-03_continuity_packet.sha256'),
    `${migrated.continuityPacketHash}  AT-S11-03_continuity_packet.json\n`,
  );
  writeJson(path.join(TEST_EVIDENCE, 'AT-S11-03_run.json'), {
    result: 'PASS',
    old_idempotency_key: migrated.migration.oldIdempotencyKey,
    new_idempotency_key: migrated.migration.newIdempotencyKey,
    continuity_packet_hash: migrated.continuityPacketHash,
    predicted_diff: migrated.predictedTopLevelDiff,
  });
});

test('AT-S11-04 rollback restores deterministic preview hash and pinned version behavior', () => {
  ensureEvidenceDirs();
  const baseTemplate = createTemplateFixture();
  let registry: TemplateRegistryV2 = createTemplateRegistry(baseTemplate, 'operator', 'seed', 4000);
  const pin = pinNewRun(registry, 'S11-template-lifecycle-manager', 'run-002', 'operator', 4010);
  registry = pin.registry;

  const baseVersionId = pin.pinnedVersionId;
  const baseVersion = registry.versions.find((item) => item.versionId === baseVersionId)!;
  const basePreview = compilePreview(baseVersion, PREVIEW_INPUT);
  const basePreviewRepeat = compilePreview(baseVersion, PREVIEW_INPUT);
  assert.strictEqual(basePreview.renderedHash, basePreviewRepeat.renderedHash);

  const v2Template = createTemplateFixture();
  v2Template['Sprint Metadata'] = {
    'Sprint ID': '[[SPRINT_ID]]',
    'Objective (one sentence)': 'Rollback test objective variation',
    'Acceptance Tests': ['AT-S11-01', 'AT-S11-02', 'AT-S11-03', 'AT-S11-04'],
  };
  const draft = createDraftVersion(registry, v2Template, 'operator', 'for rollback test', 4020);
  const activated = activateTemplateVersion(draft.registry, draft.version.versionId, SETTINGS, 'operator', 4030);
  assert.strictEqual(activated.ok, true);

  const migrated = migratePinnedRun(
    activated.registry,
    'S11-template-lifecycle-manager',
    'run-002',
    draft.version.versionId,
    PREVIEW_INPUT,
    ['done_1'],
    ['delta_1'],
    'operator',
    4040,
  );

  const reverted = revertMigration(
    migrated.registry,
    migrated.migration.migrationId,
    PREVIEW_INPUT,
    ['done_1'],
    ['delta_1'],
    'operator',
    4050,
  );

  const restoredVersion = reverted.registry.versions.find((item) => item.versionId === reverted.restoredVersionId)!;
  const restoredPreview = compilePreview(restoredVersion, PREVIEW_INPUT);
  assert.strictEqual(restoredPreview.renderedHash, basePreview.renderedHash);

  const rollbackActivation = rollbackToVersion(reverted.registry, baseVersionId, SETTINGS, 'operator', 4060);
  assert.strictEqual(rollbackActivation.ok, true);

  const pinGuard = ensurePinnedTemplateExists(rollbackActivation.registry, 'S11-template-lifecycle-manager', 'run-002');
  assert.strictEqual(pinGuard.ok, true);

  const settingsDrift = assessSettingsImpactOnPinnedTemplate(
    rollbackActivation.registry,
    'S11-template-lifecycle-manager',
    'run-002',
    { REPO_NAME: 'promptops-gui' },
  );
  assert.strictEqual(settingsDrift.ok, false);
  assert.ok(settingsDrift.missingGlobalBindings.includes('REPO_OWNER'));

  const unresolvedInput: PreviewInput = {
    ...PREVIEW_INPUT,
    globalBindings: { REPO_NAME: 'promptops-gui' },
  };
  const unresolvedA = compilePreview(restoredVersion, unresolvedInput);
  const unresolvedB = compilePreview(restoredVersion, unresolvedInput);
  assert.ok(unresolvedA.unresolvedRequirements.includes('unresolved_placeholders'));
  assert.ok(unresolvedB.unresolvedRequirements.includes('unresolved_placeholders'));

  const exported = exportRegistryCanonical(rollbackActivation.registry);
  const imported = importRegistryCanonical(exported);
  assert.strictEqual(imported.ok, true);

  writeJson(path.join(PREVIEW_EVIDENCE, 'AT-S11-04_preview_hashes.json'), {
    base_hash: basePreview.renderedHash,
    base_repeat_hash: basePreviewRepeat.renderedHash,
    restored_hash: restoredPreview.renderedHash,
  });
  writeJson(path.join(MIGRATE_EVIDENCE, 'AT-S11-04_revert.json'), {
    migration_id: migrated.migration.migrationId,
    restored_version_id: reverted.restoredVersionId,
    reverted_packet_hash: reverted.continuityPacketHash,
  });
  writeJson(path.join(TEST_EVIDENCE, 'AT-S11-04_run.json'), {
    result: 'PASS',
    rollback_activation_ok: rollbackActivation.ok,
    pin_guard: pinGuard,
    settings_drift: settingsDrift,
    unresolved_requirements_run_a: unresolvedA.unresolvedRequirements,
    unresolved_requirements_run_b: unresolvedB.unresolvedRequirements,
    import_ok: imported.ok,
  });
});

function createTemplateFixture(): Record<string, unknown> {
  return {
    'Sprint Metadata': {
      'Sprint ID': '[[SPRINT_ID]]',
      'Objective (one sentence)': 'Template objective for [[REPO_OWNER]]/[[REPO_NAME]]',
      'Acceptance Tests': ['AT-S11-01', 'AT-S11-02', 'AT-S11-03', 'AT-S11-04'],
    },
    'Non-negotiables': {
      SECURITY: ['no token leaks'],
      DETERMINISM: ['single source of truth'],
      TESTING_AND_VALIDATION: ['REPO ROOT RESOLUTION POLICY must be enforced'],
      SCOPE: ['smallest safe change set'],
    },
    'OPEN PR HANDLING PROTOCOL': {
      'Step 0 — Inventory open PRs (evidence required)': {
        Run: ['gh pr list --repo Doogie201/promptops-gui --state open --json number,title,url'],
      },
    },
    'Mandatory Preflight': {
      Commands: ['pwd', 'echo "$PROMPTOPS_REPO"', 'git rev-parse --show-toplevel'],
    },
    'Whitelist (allowed paths)': ['src/**', 'tests/**', 'docs/sprints/S11/**', '/tmp/**'],
    'Hard Stops': ['HARD STOP: MISSING_REPO_ROOT', 'HARD STOP: GIT_OBJECT_INTEGRITY'],
    'Evidence-First Output Contract': {
      'You must produce exactly two sections.': true,
      'SECTION 1 — MINIMAL EVIDENCE BUNDLE (single message)': ['Sprint header', 'PASS/FAIL verdict'],
      'SECTION 2 — APPENDIX (only if asked)': ['Full logs'],
    },
  };
}

function prepareEvidenceRoot(): void {
  for (const dir of [TEST_EVIDENCE, TEMPLATE_EVIDENCE, PREVIEW_EVIDENCE, MIGRATE_EVIDENCE]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureEvidenceDirs(): void {
  for (const dir of [TEST_EVIDENCE, TEMPLATE_EVIDENCE, PREVIEW_EVIDENCE, MIGRATE_EVIDENCE]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJson(filePath: string, payload: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

void templateHash;
