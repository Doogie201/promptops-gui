import type {
  ParsedSprintRequirements,
  VersionedPin,
  WizardConfig,
  WizardEvaluation,
  WizardPolicyConfig,
  WizardRepoConfig,
  WizardState,
} from './types.ts';

const SPRINT_PLACEHOLDER_PATTERN = /\[\[\s*([^\]]+?)\s*\]\]/g;

export function createWizardState(nowIso: string): WizardState {
  return {
    config: {
      repo: {
        owner: '',
        name: '',
        baseBranch: 'main',
        rootStrategy: 'env:PROMPTOPS_REPO',
      },
      policy: {
        whitelist: [],
        budgets: {},
        autoSwitch: true,
        manualSwitch: true,
        agentOrder: ['codex', 'claude'],
      },
      templatePin: null,
      taskPin: null,
    },
    sprintRequirementsRaw: '',
    parsedRequirements: { sprintId: null, placeholders: [] },
    sprintPlaceholderValues: {},
    sprintPromptShown: false,
  };
}

export function withRepoConfig(state: WizardState, repo: Partial<WizardRepoConfig>): WizardState {
  return { ...state, config: { ...state.config, repo: { ...state.config.repo, ...repo } } };
}

export function withPolicyConfig(state: WizardState, policy: Partial<WizardPolicyConfig>): WizardState {
  return { ...state, config: { ...state.config, policy: { ...state.config.policy, ...policy } } };
}

export function withPinnedTemplateAndTask(
  state: WizardState,
  templatePin: VersionedPin,
  taskPin: VersionedPin,
): WizardState {
  return { ...state, config: { ...state.config, templatePin, taskPin } };
}

export function withSprintRequirements(state: WizardState, raw: string): WizardState {
  return {
    ...state,
    sprintRequirementsRaw: raw,
    parsedRequirements: parseSprintRequirements(raw),
  };
}

export function withSprintPlaceholderValues(state: WizardState, values: Record<string, string>): WizardState {
  return {
    ...state,
    sprintPlaceholderValues: { ...state.sprintPlaceholderValues, ...values },
    sprintPromptShown: true,
  };
}

export function evaluateWizard(state: WizardState): WizardEvaluation {
  const missingPersistentFields: string[] = [];
  if (!state.config.repo.owner) missingPersistentFields.push('repo.owner');
  if (!state.config.repo.name) missingPersistentFields.push('repo.name');
  if (!state.config.repo.baseBranch) missingPersistentFields.push('repo.baseBranch');
  if (!state.config.repo.rootStrategy) missingPersistentFields.push('repo.rootStrategy');
  if (!state.config.templatePin) missingPersistentFields.push('templatePin');
  if (!state.config.taskPin) missingPersistentFields.push('taskPin');
  if (!state.config.policy.whitelist.length) missingPersistentFields.push('policy.whitelist');
  if (!Object.keys(state.config.policy.budgets).length) missingPersistentFields.push('policy.budgets');
  if (!state.sprintRequirementsRaw) missingPersistentFields.push('sprintRequirementsRaw');
  if (!state.parsedRequirements.sprintId) missingPersistentFields.push('parsedRequirements.sprintId');

  const sprintScopedPlaceholders = state.parsedRequirements.placeholders.filter(isSprintScopedPlaceholder);
  const unresolvedSprintPlaceholders = sprintScopedPlaceholders.filter((key) => !state.sprintPlaceholderValues[key]);
  const promptRequired = unresolvedSprintPlaceholders.length > 0 && !state.sprintPromptShown;
  const readyForRun = missingPersistentFields.length === 0 && !promptRequired;

  return {
    missingPersistentFields,
    sprintScopedPlaceholders: unresolvedSprintPlaceholders,
    promptRequired,
    readyForRun,
  };
}

export function parseSprintRequirements(raw: string): ParsedSprintRequirements {
  if (!raw.trim()) return { sprintId: null, placeholders: [] };
  return {
    sprintId: inferSprintId(raw),
    placeholders: extractPlaceholders(raw),
  };
}

export function inferSprintId(raw: string): string | null {
  const fromJson = inferSprintIdFromJson(raw);
  if (fromJson) return fromJson;
  const regex = /"?Sprint ID"?\s*[:=]\s*"([^"]+)"/i;
  const match = raw.match(regex);
  return match ? match[1].trim() : null;
}

export function extractPlaceholders(raw: string): string[] {
  const seen = new Set<string>();
  let match = SPRINT_PLACEHOLDER_PATTERN.exec(raw);
  while (match) {
    seen.add(match[1].trim());
    match = SPRINT_PLACEHOLDER_PATTERN.exec(raw);
  }
  return [...seen].sort();
}

export function isSprintScopedPlaceholder(name: string): boolean {
  const lowered = name.toLowerCase();
  return (
    lowered.includes('sprint') || lowered.includes('pr') || lowered.includes('branch') || lowered.includes('run')
  );
}

function inferSprintIdFromJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const direct = parsed['Sprint ID'];
    if (typeof direct === 'string') return direct;
    const meta = parsed['Sprint Metadata'];
    if (meta && typeof meta === 'object') {
      const nested = (meta as Record<string, unknown>)['Sprint ID'];
      if (typeof nested === 'string') return nested;
    }
  } catch {
    return null;
  }
  return null;
}
