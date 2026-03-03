import * as path from 'path';

export interface RepositoryPolicy {
  whitelist: string[];
  budgets: {
    maxNetNewLines: number;
    maxTotalLines: number;
    maxFunctionLength: number;
    maxNewHooks: number;
    maxNewUseEffect: number;
  };
}

const repoRoot = path.resolve(__dirname, '..');

export const GlobalPolicy: RepositoryPolicy = {
  whitelist: [
    `${repoRoot}${path.sep}`,
    'docs/backlog/',
    'docs/sprints/README.md',
    'docs/sprints/S04/',
    '/tmp/'
  ],
  budgets: {
    maxNetNewLines: 120,
    maxTotalLines: 1200,
    maxFunctionLength: 80,
    maxNewHooks: 1,
    maxNewUseEffect: 1
  }
};

export function assertPolicyInvariants(policy: RepositoryPolicy = GlobalPolicy): void {
  if (policy.whitelist.length === 0) {
    throw new Error('Policy whitelist must not be empty.');
  }

  const deduped = new Set(policy.whitelist);
  if (deduped.size !== policy.whitelist.length) {
    throw new Error('Policy whitelist contains duplicate entries.');
  }

  if (policy.budgets.maxNetNewLines <= 0 || policy.budgets.maxFunctionLength <= 0) {
    throw new Error('Policy line/function budgets must be positive.');
  }

  if (policy.budgets.maxNewHooks < 0 || policy.budgets.maxNewUseEffect < 0) {
    throw new Error('Policy hook budgets must be zero or positive.');
  }
}
