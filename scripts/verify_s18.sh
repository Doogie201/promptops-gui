#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CONTRACT_PATH='docs/sprints/S18/contracts_v1.json'
EVIDENCE_INDEX='docs/sprints/S18/evidence/INDEX.md'
GAP_PROOF_PATH='docs/sprints/S18/evidence/gap_proof/latest.json'

echo "[verify:s18] validate contracts JSON"
node -e "JSON.parse(require('fs').readFileSync('${CONTRACT_PATH}','utf8')); console.log('contracts_v1.json:VALID')"

echo "[verify:s18] contract policy controls present"
node <<'NODE'
const fs = require('fs');
const contracts = JSON.parse(fs.readFileSync('docs/sprints/S18/contracts_v1.json', 'utf8'));
const governance = contracts?.governance ?? {};
const quality = governance?.quality_controls ?? {};
const scope = governance?.scope_control ?? {};
const requiredQuality = [
  'max_net_new_lines_per_existing_file',
  'max_total_loc_per_touched_file',
  'max_function_length',
  'human_readable_required',
  'gap_proof_required_before_net_new',
  'receipt_index_required_for_status_claims'
];
const missingQuality = requiredQuality.filter((key) => !(key in quality));
if (missingQuality.length > 0) {
  console.error(`missing governance.quality_controls keys: ${missingQuality.join(', ')}`);
  process.exit(2);
}
if (!Array.isArray(scope.allowed_paths) || scope.allowed_paths.length === 0) {
  console.error('missing governance.scope_control.allowed_paths');
  process.exit(3);
}
const gateOutcomes = contracts?.ci_enforcement?.required_gate_outcomes ?? [];
for (const required of [
  'scope_allowlist_enforced',
  'no_god_files_enforced',
  'maintainability_budget_enforced',
  'gap_proof_verified_before_net_new',
  'receipt_index_verified',
]) {
  if (!gateOutcomes.includes(required)) {
    console.error(`missing required gate outcome: ${required}`);
    process.exit(4);
  }
}
console.log('policy_controls:VALID');
NODE

echo "[verify:s18] required tests declared in contracts exist"
node <<'NODE'
const fs = require('fs');
const path = require('path');
const contracts = JSON.parse(fs.readFileSync('docs/sprints/S18/contracts_v1.json', 'utf8'));
const required = contracts?.ci_enforcement?.required_tests;
if (!Array.isArray(required) || required.length === 0) {
  console.error('missing ci_enforcement.required_tests');
  process.exit(5);
}
const missing = required.filter((file) => !fs.existsSync(path.resolve(file)));
if (missing.length > 0) {
  console.error(`missing required tests: ${missing.join(', ')}`);
  process.exit(6);
}
console.log(`required_tests_count=${required.length}`);
NODE

echo "[verify:s18] gap-proof artifact exists and is complete"
node <<'NODE'
const fs = require('fs');
const path = 'docs/sprints/S18/evidence/gap_proof/latest.json';
if (!fs.existsSync(path)) {
  console.error(`missing gap-proof artifact: ${path}`);
  process.exit(7);
}
const payload = JSON.parse(fs.readFileSync(path, 'utf8'));
const required = [
  'artifact_version',
  'evaluated_sprint_dirs',
  'completed_sprint_count',
  'decision',
  'open_blockers',
  'source_receipts'
];
const missing = required.filter((key) => !(key in payload));
if (missing.length > 0) {
  console.error(`gap-proof missing keys: ${missing.join(', ')}`);
  process.exit(8);
}
if (!Array.isArray(payload.evaluated_sprint_dirs) || payload.evaluated_sprint_dirs.length === 0) {
  console.error('gap-proof evaluated_sprint_dirs must be non-empty array');
  process.exit(9);
}
if (typeof payload.completed_sprint_count !== 'number' || payload.completed_sprint_count < 1) {
  console.error('gap-proof completed_sprint_count must be >= 1');
  process.exit(10);
}
console.log('gap_proof:VALID');
NODE

echo "[verify:s18] evidence index present for status claims"
if ! test -f "${EVIDENCE_INDEX}"; then
  echo "verify:s18 failure: missing evidence index ${EVIDENCE_INDEX}" >&2
  exit 11
fi
if ! rg -n '^## Command Receipts' "${EVIDENCE_INDEX}" >/dev/null; then
  echo "verify:s18 failure: evidence index missing '## Command Receipts' section" >&2
  exit 12
fi
if ! rg -n '^## Status Claims' "${EVIDENCE_INDEX}" >/dev/null; then
  echo "verify:s18 failure: evidence index missing '## Status Claims' section" >&2
  exit 13
fi
if ! rg -n '`[^`]+\.(txt|json|md)`' "${EVIDENCE_INDEX}" >/dev/null; then
  echo "verify:s18 failure: evidence index has no receipt path entries" >&2
  exit 14
fi

echo "[verify:s18] maintainability budgets (no-god-file checks)"
node <<'NODE'
const fs = require('fs');
const path = require('path');

const contracts = JSON.parse(fs.readFileSync('docs/sprints/S18/contracts_v1.json', 'utf8'));
const quality = contracts?.governance?.quality_controls ?? {};
const maxFileLoc = Number(quality.max_total_loc_per_touched_file ?? 1200);
const maxFnLen = Number(quality.max_function_length ?? 80);
const humanReadable = Boolean(quality.human_readable_required);
const root = path.resolve('src/s18');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function lineOf(source, index) {
  let count = 1;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') count += 1;
  }
  return count;
}

function functionRanges(source) {
  const ranges = [];
  const patterns = [
    /function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{/g,
    /(?:const|let|var)\s+[A-Za-z0-9_]+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const openIndex = source.indexOf('{', match.index);
      if (openIndex < 0) continue;
      let depth = 0;
      let endIndex = -1;
      for (let i = openIndex; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{') depth += 1;
        if (ch === '}') {
          depth -= 1;
          if (depth === 0) {
            endIndex = i;
            break;
          }
        }
      }
      if (endIndex < 0) continue;
      const startLine = lineOf(source, match.index);
      const endLine = lineOf(source, endIndex);
      ranges.push({ startLine, endLine, length: endLine - startLine + 1 });
    }
  }

  return ranges;
}

const files = walk(root);
const violations = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const lines = source.split('\n');
  if (lines.length > maxFileLoc) {
    violations.push(`${path.relative(process.cwd(), file)} LOC ${lines.length} > ${maxFileLoc}`);
  }

  for (const range of functionRanges(source)) {
    if (range.length > maxFnLen) {
      violations.push(
        `${path.relative(process.cwd(), file)} function lines ${range.length} > ${maxFnLen} @L${range.startLine}`,
      );
    }
  }

  if (humanReadable) {
    const longLine = lines.findIndex((line) => line.length > 180);
    if (longLine >= 0) {
      violations.push(`${path.relative(process.cwd(), file)} line ${longLine + 1} exceeds 180 chars`);
    }
    const nestedTernary = lines.findIndex((line) => /\s\?\s.*:\s.*\?\s/.test(line));
    if (nestedTernary >= 0) {
      violations.push(`${path.relative(process.cwd(), file)} line ${nestedTernary + 1} nested ternary detected`);
    }
  }
}

if (violations.length > 0) {
  console.error('maintainability violations:\n' + violations.join('\n'));
  process.exit(15);
}
console.log(`maintainability:PASS files=${files.length}`);
NODE

echo "[verify:s18] scope allowlist gate and gap-proof-before-net-new (commit delta)"
node <<'NODE'
const fs = require('fs');
const cp = require('child_process');

const contracts = JSON.parse(fs.readFileSync('docs/sprints/S18/contracts_v1.json', 'utf8'));
const allowed = contracts?.governance?.scope_control?.allowed_paths ?? [];
const isCI = String(process.env.CI || '').toLowerCase() === 'true';

function isAllowed(filePath) {
  return allowed.some((pattern) => {
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return filePath.startsWith(prefix);
    }
    return filePath === pattern;
  });
}

if (!isCI) {
  console.log('scope_allowlist:SKIP(local run, enforced in CI)');
  process.exit(0);
}

let hasParent = true;
try {
  cp.execSync('git rev-parse --verify HEAD^', { stdio: 'ignore' });
} catch {
  hasParent = false;
}

if (!hasParent) {
  console.error('scope_allowlist:FAIL missing HEAD^ in CI; fetch full history to enforce scope gate');
  process.exit(31);
}

const raw = cp.execSync('git diff --name-only HEAD^..HEAD', { encoding: 'utf8' }).trim();
if (!raw) {
  console.error('scope_allowlist:FAIL empty commit delta in CI; cannot enforce allowlist');
  process.exit(32);
}

const changed = raw.split('\n').filter(Boolean);
const violations = changed.filter((file) => !isAllowed(file));
if (violations.length > 0) {
  console.error('out-of-scope files in commit delta:\n' + violations.join('\n'));
  process.exit(16);
}

const netNewTouched = changed.some((file) => file.startsWith('src/s18/') || file.startsWith('tests/s18/'));
if (netNewTouched && !changed.includes('docs/sprints/S18/evidence/gap_proof/latest.json')) {
  console.error('gap-proof file must be updated in any commit touching src/s18 or tests/s18');
  process.exit(17);
}
if (netNewTouched && !changed.includes('docs/sprints/S18/evidence/INDEX.md')) {
  console.error('evidence index must be updated in any commit touching src/s18 or tests/s18');
  process.exit(18);
}

console.log(`scope_allowlist:PASS changed_files=${changed.length} net_new_touched=${netNewTouched}`);
NODE

echo "[verify:s18] run S18 tests"
npm run -s test:s18

echo "[verify:s18] stoplight non-determinism grep (src/s18 only)"
if rg -n 'Date\.now\(|Math\.random\(' src/s18 2>/dev/null; then
  echo "verify:s18 failure: non-deterministic APIs detected in src/s18" >&2
  exit 19
fi

echo "[verify:s18] stoplight hardcoded path grep (src/s18 only)"
if rg -n '(/Users/|/Volumes/|[A-Za-z]:\\\\)' src/s18 2>/dev/null; then
  echo "verify:s18 failure: hardcoded absolute path detected in src/s18" >&2
  exit 20
fi

echo "[verify:s18] PASS"
