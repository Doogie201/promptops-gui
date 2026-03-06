import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')) as T;
}

function readText(rel: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

test('S18 policy controls: contract defines maintainability, scope, and evidence locks', () => {
  const contracts = readJson<{
    governance?: {
      scope_control?: { allowed_paths?: string[]; scope_change_request_required_for_out_of_scope?: boolean };
      quality_controls?: Record<string, unknown>;
    };
    ci_enforcement?: { required_gate_outcomes?: string[]; required_tests?: string[] };
  }>('docs/sprints/S18/contracts_v1.json');

  const quality = contracts.governance?.quality_controls ?? {};
  assert.strictEqual(quality.max_net_new_lines_per_existing_file, 120);
  assert.strictEqual(quality.max_total_loc_per_touched_file, 1200);
  assert.strictEqual(quality.max_function_length, 80);
  assert.strictEqual(quality.human_readable_required, true);
  assert.strictEqual(quality.gap_proof_required_before_net_new, true);
  assert.strictEqual(quality.receipt_index_required_for_status_claims, true);

  const scope = contracts.governance?.scope_control;
  assert.strictEqual(scope?.scope_change_request_required_for_out_of_scope, true);
  assert.ok(Array.isArray(scope?.allowed_paths));
  assert.ok((scope?.allowed_paths?.length ?? 0) >= 1);

  const outcomes = contracts.ci_enforcement?.required_gate_outcomes ?? [];
  assert.ok(outcomes.includes('scope_allowlist_enforced'));
  assert.ok(outcomes.includes('no_god_files_enforced'));
  assert.ok(outcomes.includes('maintainability_budget_enforced'));
  assert.ok(outcomes.includes('gap_proof_verified_before_net_new'));
  assert.ok(outcomes.includes('receipt_index_verified'));

  const requiredTests = contracts.ci_enforcement?.required_tests ?? [];
  assert.ok(requiredTests.includes('tests/s18/policy_controls.test.ts'));
});

test('S18 policy controls: verify script enforces gap-proof, scope allowlist, and receipt index', () => {
  const script = readText('scripts/verify_s18.sh');

  assert.match(script, /gap-proof artifact exists and is complete/);
  assert.match(script, /evidence index present for status claims/);
  assert.match(script, /maintainability budgets \(no-god-file checks\)/);
  assert.match(script, /scope allowlist gate and gap-proof-before-net-new/);
  assert.match(script, /git diff --name-only HEAD\^\.\.HEAD/);
  assert.match(script, /docs\/sprints\/S18\/evidence\/gap_proof\/latest\.json/);
  assert.match(script, /docs\/sprints\/S18\/evidence\/INDEX\.md/);
});
