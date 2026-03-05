import * as crypto from 'node:crypto';

export type LifecycleState = 'active' | 'draft' | 'archived';

export interface TemplateVersion {
  versionId: string;
  lifecycleState: LifecycleState;
  template: Record<string, unknown>;
  contentHash: string;
  createdAt: number;
  author: string;
  note: string;
}

export interface TemplateEvent {
  eventId: string;
  type:
    | 'version_created'
    | 'version_activated'
    | 'version_rolled_back'
    | 'override_requested'
    | 'override_confirmed'
    | 'run_pinned'
    | 'run_migrated'
    | 'run_migration_reverted';
  at: number;
  actor: string;
  details: Record<string, unknown>;
}

export interface OverrideRequest {
  versionId: string;
  token: string;
  requestedAt: number;
  requestedBy: string;
}

export interface OverrideConfirmation {
  versionId: string;
  token: string;
  confirmedAt: number;
  confirmedBy: string;
}

export interface MigrationLink {
  migrationId: string;
  sprintId: string;
  runId: string;
  fromVersionId: string;
  toVersionId: string;
  oldIdempotencyKey: string;
  newIdempotencyKey: string;
  continuityPacketHash: string;
}

export interface TemplateRegistryV2 {
  versions: TemplateVersion[];
  activeVersionId: string;
  runPins: Record<string, string>;
  sprintPins: Record<string, string>;
  events: TemplateEvent[];
  pendingOverrides: Record<string, OverrideRequest>;
  confirmedOverrides: Record<string, OverrideConfirmation>;
  migrations: MigrationLink[];
  clock: number;
}

export interface ValidationSettings {
  globalBindings: Record<string, string>;
  sprintPlaceholders: string[];
  forbiddenPlaceholders: string[];
  requiredTopLevelKeys?: string[];
}

export interface PlaceholderScan {
  all: string[];
  globalBound: string[];
  sprintBound: string[];
  forbidden: string[];
  unknown: string[];
  missingGlobalBindings: string[];
}

export interface ProtectedDiffResult {
  weakenedSections: string[];
  details: string[];
}

export interface ValidationResult {
  valid: boolean;
  missingTopLevelKeys: string[];
  missingSubKeys: string[];
  placeholderScan: PlaceholderScan;
  determinismViolations: string[];
  protectedDiff: ProtectedDiffResult;
  blockers: string[];
}

export interface ActivationResult {
  ok: boolean;
  registry: TemplateRegistryV2;
  versionId: string;
  validation: ValidationResult;
  reasonCode: 'NONE' | 'ACTIVATION_BLOCKED' | 'PROTECTED_OVERRIDE_REQUIRED';
}

export interface PreviewInput {
  sprintRequirements: Record<string, unknown>;
  globalBindings: Record<string, string>;
  sprintBindings: Record<string, string>;
}

export interface PreviewOutput {
  versionId: string;
  renderedTicketJson: Record<string, unknown>;
  renderedCanonical: string;
  renderedHash: string;
  placeholderBindingsUsed: string[];
  unresolvedPlaceholders: string[];
  unresolvedRequirements: string[];
  requiredSettingsFields: string[];
  optionalSettingsFields: string[];
}

export interface MigrationResult {
  registry: TemplateRegistryV2;
  migration: MigrationLink;
  continuityPacket: Record<string, unknown>;
  continuityPacketHash: string;
  predictedTopLevelDiff: string[];
}

export interface RevertMigrationResult {
  registry: TemplateRegistryV2;
  continuityPacket: Record<string, unknown>;
  continuityPacketHash: string;
  restoredVersionId: string;
}

export interface SettingsImpactWarning {
  ok: boolean;
  code: 'NONE' | 'PINNED_TEMPLATE_SETTINGS_DRIFT';
  message: string;
  missingGlobalBindings: string[];
}

const PLACEHOLDER_PATTERN = /\[\[\s*([^\]]+?)\s*\]\]/g;
const DETERMINISM_RISK_PATTERNS = [
  /date\.now\s*\(/i,
  /math\.random\s*\(/i,
  /new\s+date\s*\(/i,
  /\[\[\s*(now|timestamp|random|uuid)\s*\]\]/i,
];
const PROTECTED_SECTION_KEYS = [
  'Non-negotiables',
  'Hard Stops',
  'Evidence-First Output Contract',
  'OPEN PR HANDLING PROTOCOL',
  'Mandatory Preflight',
  'Worktree rules',
  'PRIMARY WORKTREE POLICY',
  'REPO ROOT RESOLUTION POLICY',
] as const;
const REQUIRED_TOP_LEVEL_KEYS_DEFAULT = [
  'Sprint Metadata',
  'Non-negotiables',
  'Whitelist (allowed paths)',
  'Hard Stops',
  'Evidence-First Output Contract',
];

const REQUIRED_SUB_KEYS: Record<string, string[]> = {
  'Sprint Metadata': ['Sprint ID', 'Objective (one sentence)', 'Acceptance Tests'],
  'Non-negotiables': ['SECURITY', 'DETERMINISM', 'TESTING_AND_VALIDATION', 'SCOPE'],
  'Evidence-First Output Contract': [
    'You must produce exactly two sections.',
    'SECTION 1 — MINIMAL EVIDENCE BUNDLE (single message)',
    'SECTION 2 — APPENDIX (only if asked)',
  ],
};

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function templateHash(template: Record<string, unknown>): string {
  return sha256Hex(canonicalJson(template));
}

export function createTemplateRegistry(
  initialTemplate: Record<string, unknown>,
  author: string,
  note: string,
  createdAt: number,
): TemplateRegistryV2 {
  const firstVersion: TemplateVersion = {
    versionId: 'v1',
    lifecycleState: 'active',
    template: deepClone(initialTemplate),
    contentHash: templateHash(initialTemplate),
    createdAt,
    author,
    note,
  };
  const events: TemplateEvent[] = [
    makeEvent('version_created', createdAt, author, { versionId: firstVersion.versionId, contentHash: firstVersion.contentHash }),
    makeEvent('version_activated', createdAt, author, { versionId: firstVersion.versionId, reason: 'initial' }),
  ];
  return {
    versions: [firstVersion],
    activeVersionId: firstVersion.versionId,
    runPins: {},
    sprintPins: {},
    events,
    pendingOverrides: {},
    confirmedOverrides: {},
    migrations: [],
    clock: createdAt,
  };
}

export function createDraftVersion(
  registry: TemplateRegistryV2,
  template: Record<string, unknown>,
  author: string,
  note: string,
  at: number,
): { registry: TemplateRegistryV2; version: TemplateVersion } {
  const normalizedAt = monotonicAt(registry.clock, at);
  const nextVersionId = `v${registry.versions.length + 1}`;
  const version: TemplateVersion = {
    versionId: nextVersionId,
    lifecycleState: 'draft',
    template: deepClone(template),
    contentHash: templateHash(template),
    createdAt: normalizedAt,
    author,
    note,
  };
  return {
    version,
    registry: {
      ...registry,
      versions: [...registry.versions, version],
      events: [
        ...registry.events,
        makeEvent('version_created', normalizedAt, author, {
          versionId: nextVersionId,
          lifecycleState: 'draft',
          contentHash: version.contentHash,
          note,
        }),
      ],
      clock: normalizedAt,
    },
  };
}

export function validateTemplateContract(
  template: Record<string, unknown>,
  settings: ValidationSettings,
  baselineTemplate?: Record<string, unknown>,
): ValidationResult {
  const requiredTopLevel = settings.requiredTopLevelKeys ?? REQUIRED_TOP_LEVEL_KEYS_DEFAULT;
  const missingTopLevelKeys = requiredTopLevel.filter((key) => !hasOwn(template, key));
  const missingSubKeys = collectMissingSubKeys(template);
  const placeholderScan = scanPlaceholders(template, settings);
  const determinismViolations = detectDeterminismViolations(template);
  const protectedDiff = evaluateProtectedDiff(baselineTemplate, template);

  const blockers = [
    ...missingTopLevelKeys.map((key) => `missing_top_level:${key}`),
    ...missingSubKeys.map((key) => `missing_sub_key:${key}`),
    ...placeholderScan.forbidden.map((name) => `forbidden_placeholder:${name}`),
    ...placeholderScan.unknown.map((name) => `unknown_placeholder:${name}`),
    ...placeholderScan.missingGlobalBindings.map((name) => `missing_global_binding:${name}`),
    ...determinismViolations.map((item) => `determinism_violation:${item}`),
  ];

  return {
    valid: blockers.length === 0,
    missingTopLevelKeys,
    missingSubKeys,
    placeholderScan,
    determinismViolations,
    protectedDiff,
    blockers,
  };
}

export function requestProtectedOverride(
  registry: TemplateRegistryV2,
  versionId: string,
  actor: string,
  at: number,
): { registry: TemplateRegistryV2; token: string } {
  const normalizedAt = monotonicAt(registry.clock, at);
  const token = sha256Hex(`${versionId}:${actor}:${normalizedAt}`).slice(0, 16);
  const request: OverrideRequest = { versionId, token, requestedAt: normalizedAt, requestedBy: actor };
  const nextRegistry: TemplateRegistryV2 = {
    ...registry,
    pendingOverrides: { ...registry.pendingOverrides, [versionId]: request },
    events: [...registry.events, makeEvent('override_requested', normalizedAt, actor, request)],
    clock: normalizedAt,
  };
  return { registry: nextRegistry, token };
}

export function confirmProtectedOverride(
  registry: TemplateRegistryV2,
  versionId: string,
  token: string,
  actor: string,
  at: number,
): { ok: boolean; registry: TemplateRegistryV2 } {
  const pending = registry.pendingOverrides[versionId];
  if (!pending || pending.token !== token) return { ok: false, registry };
  const normalizedAt = monotonicAt(registry.clock, at);
  const confirmation: OverrideConfirmation = {
    versionId,
    token,
    confirmedAt: normalizedAt,
    confirmedBy: actor,
  };
  const nextPending = { ...registry.pendingOverrides };
  delete nextPending[versionId];
  return {
    ok: true,
    registry: {
      ...registry,
      pendingOverrides: nextPending,
      confirmedOverrides: { ...registry.confirmedOverrides, [versionId]: confirmation },
      events: [...registry.events, makeEvent('override_confirmed', normalizedAt, actor, confirmation)],
      clock: normalizedAt,
    },
  };
}

export function activateTemplateVersion(
  registry: TemplateRegistryV2,
  versionId: string,
  settings: ValidationSettings,
  actor: string,
  at: number,
): ActivationResult {
  const candidate = findVersion(registry, versionId);
  if (!candidate) {
    return blockedActivation(registry, versionId, 'ACTIVATION_BLOCKED', ['missing_version']);
  }
  const active = findVersion(registry, registry.activeVersionId);
  const validation = validateTemplateContract(candidate.template, settings, active?.template);

  const hasProtectedWeakening = validation.protectedDiff.weakenedSections.length > 0;
  const hasConfirmedOverride = Boolean(registry.confirmedOverrides[versionId]);
  const protectedBlocked = hasProtectedWeakening && !hasConfirmedOverride;
  if (validation.blockers.length > 0 || protectedBlocked) {
    const reasonCode = protectedBlocked ? 'PROTECTED_OVERRIDE_REQUIRED' : 'ACTIVATION_BLOCKED';
    return {
      ok: false,
      versionId,
      reasonCode,
      validation,
      registry,
    };
  }

  const normalizedAt = monotonicAt(registry.clock, at);
  const updatedVersions = registry.versions.map((item) => {
    if (item.versionId === versionId) return { ...item, lifecycleState: 'active' as const };
    if (item.versionId === registry.activeVersionId) return { ...item, lifecycleState: 'archived' as const };
    return item;
  });

  const nextConfirmed = { ...registry.confirmedOverrides };
  delete nextConfirmed[versionId];

  return {
    ok: true,
    versionId,
    reasonCode: 'NONE',
    validation,
    registry: {
      ...registry,
      versions: updatedVersions,
      activeVersionId: versionId,
      confirmedOverrides: nextConfirmed,
      events: [
        ...registry.events,
        makeEvent('version_activated', normalizedAt, actor, {
          versionId,
          contentHash: candidate.contentHash,
          protectedOverrideUsed: hasProtectedWeakening,
        }),
      ],
      clock: normalizedAt,
    },
  };
}

export function rollbackToVersion(
  registry: TemplateRegistryV2,
  versionId: string,
  settings: ValidationSettings,
  actor: string,
  at: number,
): ActivationResult {
  const result = activateTemplateVersion(registry, versionId, settings, actor, at);
  if (!result.ok) return result;
  const normalizedAt = result.registry.clock;
  return {
    ...result,
    registry: {
      ...result.registry,
      events: [
        ...result.registry.events,
        makeEvent('version_rolled_back', normalizedAt, actor, { versionId }),
      ],
    },
  };
}

export function pinNewRun(
  registry: TemplateRegistryV2,
  sprintId: string,
  runId: string,
  actor: string,
  at: number,
): { registry: TemplateRegistryV2; pinnedVersionId: string } {
  const existing = registry.runPins[runId];
  if (existing) return { registry, pinnedVersionId: existing };
  const normalizedAt = monotonicAt(registry.clock, at);
  const pinnedVersionId = registry.activeVersionId;
  return {
    pinnedVersionId,
    registry: {
      ...registry,
      runPins: { ...registry.runPins, [runId]: pinnedVersionId },
      sprintPins: { ...registry.sprintPins, [sprintId]: pinnedVersionId },
      events: [
        ...registry.events,
        makeEvent('run_pinned', normalizedAt, actor, { sprintId, runId, versionId: pinnedVersionId }),
      ],
      clock: normalizedAt,
    },
  };
}

export function compilePreview(
  version: TemplateVersion,
  input: PreviewInput,
): PreviewOutput {
  const allBindings = { ...input.globalBindings, ...input.sprintBindings };
  const placeholders = collectPlaceholders(version.template);
  const used = placeholders.filter((name) => allBindings[name] !== undefined).sort();
  const unresolved = placeholders.filter((name) => allBindings[name] === undefined).sort();
  const rendered = renderTemplate(version.template, allBindings);

  const unresolvedRequirements = evaluateUnresolvedRequirements(rendered);
  const requiredSettingsFields = placeholders.filter((name) => hasOwn(input.globalBindings, name)).sort();
  const optionalSettingsFields = Object.keys(input.globalBindings)
    .filter((name) => !requiredSettingsFields.includes(name))
    .sort();

  const renderedCanonical = canonicalJson(rendered);
  return {
    versionId: version.versionId,
    renderedTicketJson: rendered,
    renderedCanonical,
    renderedHash: sha256Hex(renderedCanonical),
    placeholderBindingsUsed: used,
    unresolvedPlaceholders: unresolved,
    unresolvedRequirements,
    requiredSettingsFields,
    optionalSettingsFields,
  };
}

export function migratePinnedRun(
  registry: TemplateRegistryV2,
  sprintId: string,
  runId: string,
  targetVersionId: string,
  input: PreviewInput,
  doneLedgerIds: string[],
  outstandingDeltaIds: string[],
  actor: string,
  at: number,
): MigrationResult {
  const fromVersionId = registry.runPins[runId];
  if (!fromVersionId) throw new Error('HARD_STOP: TEMPLATE_MISSING_FOR_PINNED_SPRINT');
  const fromVersion = findVersionOrThrow(registry, fromVersionId);
  const targetVersion = findVersionOrThrow(registry, targetVersionId);
  const beforePreview = compilePreview(fromVersion, input);
  const afterPreview = compilePreview(targetVersion, input);

  const oldIdempotencyKey = buildIdempotencyKey(sprintId, runId, fromVersion.contentHash);
  const newIdempotencyKey = buildIdempotencyKey(sprintId, runId, targetVersion.contentHash);
  const continuityPacket = buildContinuityPacket(
    sprintId,
    runId,
    targetVersion,
    doneLedgerIds,
    outstandingDeltaIds,
    oldIdempotencyKey,
    newIdempotencyKey,
    afterPreview.renderedTicketJson,
  );
  const continuityPacketHash = sha256Hex(canonicalJson(continuityPacket));

  const normalizedAt = monotonicAt(registry.clock, at);
  const migrationId = `migration-${registry.migrations.length + 1}`;
  const migration: MigrationLink = {
    migrationId,
    sprintId,
    runId,
    fromVersionId,
    toVersionId: targetVersionId,
    oldIdempotencyKey,
    newIdempotencyKey,
    continuityPacketHash,
  };

  return {
    migration,
    continuityPacket,
    continuityPacketHash,
    predictedTopLevelDiff: topLevelDiff(beforePreview.renderedTicketJson, afterPreview.renderedTicketJson),
    registry: {
      ...registry,
      runPins: { ...registry.runPins, [runId]: targetVersionId },
      sprintPins: { ...registry.sprintPins, [sprintId]: targetVersionId },
      migrations: [...registry.migrations, migration],
      events: [
        ...registry.events,
        makeEvent('run_migrated', normalizedAt, actor, {
          migrationId,
          sprintId,
          runId,
          fromVersionId,
          toVersionId: targetVersionId,
          oldIdempotencyKey,
          newIdempotencyKey,
          continuityPacketHash,
        }),
      ],
      clock: normalizedAt,
    },
  };
}

export function revertMigration(
  registry: TemplateRegistryV2,
  migrationId: string,
  input: PreviewInput,
  doneLedgerIds: string[],
  outstandingDeltaIds: string[],
  actor: string,
  at: number,
): RevertMigrationResult {
  const migration = registry.migrations.find((item) => item.migrationId === migrationId);
  if (!migration) throw new Error(`missing migration: ${migrationId}`);

  const restoredVersion = findVersionOrThrow(registry, migration.fromVersionId);
  const restoredPreview = compilePreview(restoredVersion, input);
  const restoredIdempotency = buildIdempotencyKey(migration.sprintId, migration.runId, restoredVersion.contentHash);

  const continuityPacket = buildContinuityPacket(
    migration.sprintId,
    migration.runId,
    restoredVersion,
    doneLedgerIds,
    outstandingDeltaIds,
    migration.newIdempotencyKey,
    restoredIdempotency,
    restoredPreview.renderedTicketJson,
  );
  const continuityPacketHash = sha256Hex(canonicalJson(continuityPacket));
  const normalizedAt = monotonicAt(registry.clock, at);

  return {
    continuityPacket,
    continuityPacketHash,
    restoredVersionId: restoredVersion.versionId,
    registry: {
      ...registry,
      runPins: { ...registry.runPins, [migration.runId]: restoredVersion.versionId },
      sprintPins: { ...registry.sprintPins, [migration.sprintId]: restoredVersion.versionId },
      events: [
        ...registry.events,
        makeEvent('run_migration_reverted', normalizedAt, actor, {
          migrationId,
          sprintId: migration.sprintId,
          runId: migration.runId,
          restoredVersionId: restoredVersion.versionId,
          restoredIdempotency,
          continuityPacketHash,
        }),
      ],
      clock: normalizedAt,
    },
  };
}

export function ensurePinnedTemplateExists(
  registry: TemplateRegistryV2,
  sprintId: string,
  runId: string,
): { ok: boolean; code: 'NONE' | 'TEMPLATE_MISSING_FOR_PINNED_SPRINT'; message: string } {
  const pinned = registry.runPins[runId] ?? registry.sprintPins[sprintId];
  if (!pinned) {
    return {
      ok: false,
      code: 'TEMPLATE_MISSING_FOR_PINNED_SPRINT',
      message: 'Pinned template is missing for sprint/run; restore via import or rollback.',
    };
  }
  const version = findVersion(registry, pinned);
  if (!version) {
    return {
      ok: false,
      code: 'TEMPLATE_MISSING_FOR_PINNED_SPRINT',
      message: `Pinned template version ${pinned} is unavailable; restore via import or rollback.`,
    };
  }
  return { ok: true, code: 'NONE', message: `Pinned template ${pinned} exists.` };
}

export function assessSettingsImpactOnPinnedTemplate(
  registry: TemplateRegistryV2,
  sprintId: string,
  runId: string,
  nextGlobalBindings: Record<string, string>,
): SettingsImpactWarning {
  const pinned = registry.runPins[runId] ?? registry.sprintPins[sprintId];
  if (!pinned) return { ok: true, code: 'NONE', message: 'No pinned sprint template.', missingGlobalBindings: [] };

  const version = findVersion(registry, pinned);
  if (!version) {
    return {
      ok: false,
      code: 'PINNED_TEMPLATE_SETTINGS_DRIFT',
      message: `Pinned version ${pinned} missing; do not mutate sprint state without migration.`,
      missingGlobalBindings: [],
    };
  }

  const required = collectPlaceholders(version.template)
    .filter((name) => hasOwn(nextGlobalBindings, name))
    .sort();
  const missing = required.filter((name) => !nextGlobalBindings[name]);
  if (missing.length === 0) return { ok: true, code: 'NONE', message: 'Settings are compatible with pinned template.', missingGlobalBindings: [] };
  return {
    ok: false,
    code: 'PINNED_TEMPLATE_SETTINGS_DRIFT',
    message: `Settings change would invalidate pinned template placeholders: ${missing.join(', ')}`,
    missingGlobalBindings: missing,
  };
}

export function exportRegistryCanonical(registry: TemplateRegistryV2): string {
  return canonicalJson(registry);
}

export function importRegistryCanonical(payload: string): { ok: boolean; registry?: TemplateRegistryV2; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload) as unknown;
  } catch {
    return { ok: false, errors: ['invalid_json'] };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, errors: ['invalid_registry_object'] };
  const registry = parsed as TemplateRegistryV2;
  const errors: string[] = [];

  for (const version of registry.versions ?? []) {
    const computed = templateHash(version.template);
    if (computed !== version.contentHash) {
      errors.push(`hash_mismatch:${version.versionId}`);
    }
  }

  if (!registry.activeVersionId) errors.push('missing_active_version_id');
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, registry, errors: [] };
}

export function applySafeFormModeEdits(
  template: Record<string, unknown>,
  patch: {
    whitelist?: string[];
    budgets?: Record<string, unknown>;
    branchRegex?: string;
    prTitleFormat?: string;
    evidenceRules?: string[];
  },
): Record<string, unknown> {
  const next = deepClone(template);
  if (patch.whitelist) next['Whitelist (allowed paths)'] = [...patch.whitelist];
  if (patch.budgets) next['MAINTAINABILITY / NO-GOD-FILES (budgets; fill in)'] = deepClone(patch.budgets);
  if (patch.branchRegex) {
    const branchCompliance = objectFrom(next['BRANCH PREFIX COMPLIANCE (preflight hard stop; mandatory)']);
    const validation = objectFrom(branchCompliance.Validation);
    validation['Sprint-specific regex'] = patch.branchRegex;
    branchCompliance.Validation = validation;
    next['BRANCH PREFIX COMPLIANCE (preflight hard stop; mandatory)'] = branchCompliance;
  }
  if (patch.prTitleFormat) {
    const standards = objectFrom(next['GitHub / PR Standards (mandatory)']);
    standards['PR title format (exact)'] = patch.prTitleFormat;
    next['GitHub / PR Standards (mandatory)'] = standards;
  }
  if (patch.evidenceRules) {
    const contract = objectFrom(next['Evidence-First Output Contract']);
    contract['SECTION 1 — MINIMAL EVIDENCE BUNDLE (single message)'] = [...patch.evidenceRules];
    next['Evidence-First Output Contract'] = contract;
  }
  return next;
}

export function parseAdvancedJsonMode(rawJson: string): { ok: boolean; parsed?: Record<string, unknown>; errors: string[] } {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, errors: ['root_must_be_object'] };
    }
    return { ok: true, parsed: parsed as Record<string, unknown>, errors: [] };
  } catch (error) {
    return { ok: false, errors: [String((error as Error).message || 'invalid_json')] };
  }
}

function blockedActivation(
  registry: TemplateRegistryV2,
  versionId: string,
  reasonCode: ActivationResult['reasonCode'],
  blockers: string[],
): ActivationResult {
  return {
    ok: false,
    registry,
    versionId,
    reasonCode,
    validation: {
      valid: false,
      missingTopLevelKeys: [],
      missingSubKeys: [],
      placeholderScan: {
        all: [],
        globalBound: [],
        sprintBound: [],
        forbidden: [],
        unknown: [],
        missingGlobalBindings: [],
      },
      determinismViolations: [],
      protectedDiff: { weakenedSections: [], details: [] },
      blockers,
    },
  };
}

function evaluateProtectedDiff(
  baselineTemplate: Record<string, unknown> | undefined,
  candidateTemplate: Record<string, unknown>,
): ProtectedDiffResult {
  if (!baselineTemplate) return { weakenedSections: [], details: [] };
  const weakened: string[] = [];
  const details: string[] = [];

  for (const key of PROTECTED_SECTION_KEYS) {
    const baselineValue = findProtectedValue(baselineTemplate, key);
    if (baselineValue === undefined) continue;
    const candidateValue = findProtectedValue(candidateTemplate, key);
    if (candidateValue === undefined) {
      weakened.push(key);
      details.push(`${key}: removed`);
      continue;
    }
    const baselineStrength = sectionStrengthScore(baselineValue);
    const candidateStrength = sectionStrengthScore(candidateValue);
    if (candidateStrength < baselineStrength) {
      weakened.push(key);
      details.push(`${key}: weakened (${candidateStrength} < ${baselineStrength})`);
    }
  }

  const baselineCanonical = canonicalJson(baselineTemplate);
  const candidateCanonical = canonicalJson(candidateTemplate);
  for (const key of ['REPO ROOT RESOLUTION POLICY', 'PRIMARY WORKTREE POLICY']) {
    if (baselineCanonical.includes(key) && !candidateCanonical.includes(key)) {
      weakened.push(key);
      details.push(`${key}: mention removed`);
    }
  }

  return {
    weakenedSections: uniqueSorted(weakened),
    details: uniqueSorted(details),
  };
}

function findProtectedValue(template: Record<string, unknown>, key: string): unknown {
  if (hasOwn(template, key)) return template[key];
  const nonNegotiables = objectFrom(template['Non-negotiables']);
  const testing = nonNegotiables['TESTING_AND_VALIDATION'];
  if (key === 'REPO ROOT RESOLUTION POLICY' || key === 'PRIMARY WORKTREE POLICY') {
    return testing;
  }
  return undefined;
}

function sectionStrengthScore(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') {
    let count = 0;
    for (const nested of Object.values(value as Record<string, unknown>)) {
      count += Math.max(1, sectionStrengthScore(nested));
    }
    return count;
  }
  if (typeof value === 'string') return value.trim().length > 0 ? 1 : 0;
  return value === undefined || value === null ? 0 : 1;
}

function collectMissingSubKeys(template: Record<string, unknown>): string[] {
  const missing: string[] = [];
  for (const [parentKey, required] of Object.entries(REQUIRED_SUB_KEYS)) {
    const parent = objectFrom(template[parentKey]);
    for (const key of required) {
      if (!hasOwn(parent, key)) missing.push(`${parentKey}.${key}`);
    }
  }
  return missing;
}

function scanPlaceholders(template: Record<string, unknown>, settings: ValidationSettings): PlaceholderScan {
  const all = collectPlaceholders(template);
  const globalBound: string[] = [];
  const sprintBound: string[] = [];
  const forbidden: string[] = [];
  const unknown: string[] = [];
  const missingGlobalBindings: string[] = [];

  const forbiddenSet = new Set(settings.forbiddenPlaceholders.map((item) => item.trim()));
  const sprintSet = new Set(settings.sprintPlaceholders.map((item) => item.trim()));
  const globalKeys = new Set(Object.keys(settings.globalBindings));

  for (const name of all) {
    if (forbiddenSet.has(name) || /(token|secret|password|api[_-]?key)/i.test(name)) {
      forbidden.push(name);
      continue;
    }
    if (globalKeys.has(name)) {
      globalBound.push(name);
      if (!settings.globalBindings[name]) missingGlobalBindings.push(name);
      continue;
    }
    if (sprintSet.has(name)) {
      sprintBound.push(name);
      continue;
    }
    unknown.push(name);
  }

  return {
    all,
    globalBound: uniqueSorted(globalBound),
    sprintBound: uniqueSorted(sprintBound),
    forbidden: uniqueSorted(forbidden),
    unknown: uniqueSorted(unknown),
    missingGlobalBindings: uniqueSorted(missingGlobalBindings),
  };
}

function detectDeterminismViolations(template: Record<string, unknown>): string[] {
  const violations: string[] = [];
  const serialized = canonicalJson(template);
  for (const pattern of DETERMINISM_RISK_PATTERNS) {
    if (pattern.test(serialized)) violations.push(`pattern:${pattern.source}`);
  }

  const once = canonicalJson(template);
  const twice = canonicalJson(template);
  if (once !== twice) violations.push('canonicalization_not_stable');

  return uniqueSorted(violations);
}

function collectPlaceholders(template: Record<string, unknown>): string[] {
  const values: string[] = [];
  walkStringValues(template, (text) => {
    const pattern = new RegExp(PLACEHOLDER_PATTERN.source, 'g');
    let match = pattern.exec(text);
    while (match) {
      values.push(match[1].trim());
      match = pattern.exec(text);
    }
  });
  return uniqueSorted(values);
}

function walkStringValues(value: unknown, onText: (text: string) => void): void {
  if (typeof value === 'string') {
    onText(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStringValues(item, onText);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      walkStringValues(item, onText);
    }
  }
}

function renderTemplate(template: Record<string, unknown>, bindings: Record<string, string>): Record<string, unknown> {
  const replaceValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return value.replace(PLACEHOLDER_PATTERN, (_, raw: string) => {
        const key = String(raw).trim();
        return bindings[key] ?? `[[${key}]]`;
      });
    }
    if (Array.isArray(value)) return value.map((item) => replaceValue(item));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        out[key] = replaceValue(nested);
      }
      return out;
    }
    return value;
  };
  return replaceValue(template) as Record<string, unknown>;
}

function evaluateUnresolvedRequirements(rendered: Record<string, unknown>): string[] {
  const unresolved: string[] = [];
  const sprintMeta = objectFrom(rendered['Sprint Metadata']);
  if (!hasOwn(sprintMeta, 'Acceptance Tests')) unresolved.push('missing_acceptance_tests');

  const whitelist = rendered['Whitelist (allowed paths)'];
  if (!Array.isArray(whitelist) || whitelist.length === 0) unresolved.push('missing_whitelist_paths');

  const canonical = canonicalJson(rendered);
  if (PLACEHOLDER_PATTERN.test(canonical)) unresolved.push('unresolved_placeholders');

  return unresolved;
}

function topLevelDiff(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of keys) {
    if (canonicalJson(before[key]) !== canonicalJson(after[key])) changed.push(key);
  }
  return changed.sort();
}

function buildIdempotencyKey(sprintId: string, runId: string, templateContentHash: string): string {
  return sha256Hex(canonicalJson({ sprintId, runId, templateContentHash }));
}

function buildContinuityPacket(
  sprintId: string,
  runId: string,
  version: TemplateVersion,
  doneLedgerIds: string[],
  outstandingDeltaIds: string[],
  oldIdempotencyKey: string,
  newIdempotencyKey: string,
  renderedTicketJson: Record<string, unknown>,
): Record<string, unknown> {
  return {
    version: 'continuity_packet_v1',
    sprint_id: sprintId,
    run_id: runId,
    template_version_id: version.versionId,
    template_content_hash: version.contentHash,
    idempotency: {
      old: oldIdempotencyKey,
      next: newIdempotencyKey,
      linked: true,
    },
    done_ledger_ids: [...doneLedgerIds],
    outstanding_delta_ids: [...outstandingDeltaIds],
    rendered_ticket_json: renderedTicketJson,
  };
}

function findVersion(registry: TemplateRegistryV2, versionId: string): TemplateVersion | undefined {
  return registry.versions.find((item) => item.versionId === versionId);
}

function findVersionOrThrow(registry: TemplateRegistryV2, versionId: string): TemplateVersion {
  const found = findVersion(registry, versionId);
  if (!found) throw new Error(`missing version: ${versionId}`);
  return found;
}

function makeEvent(type: TemplateEvent['type'], at: number, actor: string, details: Record<string, unknown>): TemplateEvent {
  return {
    eventId: `${type}:${at}:${sha256Hex(canonicalJson(details)).slice(0, 10)}`,
    type,
    at,
    actor,
    details,
  };
}

function monotonicAt(current: number, requested: number): number {
  return requested > current ? requested : current + 1;
}

function objectFrom(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return { ...(value as Record<string, unknown>) };
  return {};
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}
