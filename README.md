# PromptOps GUI

[![codecov](https://codecov.io/gh/Doogie201/promptops-gui/graph/badge.svg)](https://codecov.io/gh/Doogie201/promptops-gui)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Deterministic PromptOps engine + GUI operator tooling for sprint execution, policy validation, evidence capture, and closeout automation.

## What This Repository Is

`promptops-gui` is an operator-first automation system that enforces:

- deterministic command execution and receipts,
- strict guardrails for repo hygiene and sprint scope,
- evidence-first closeout behavior for Git/GitHub workflows,
- replayable health/drift diagnostics and remediation tooling.

The implementation is TypeScript-first and test-driven. UI-oriented capabilities are represented as deterministic modules and verified via Node test harnesses and CI gates.

## How It Works

The runtime model is intentionally simple and auditable:

1. **Preflight** validates repo root, branch/sync state, and object integrity.
2. **Policy + tools** enforce whitelist, budget, branch, and PR protocol invariants.
3. **Execution** runs allowlisted commands through a shared executor with receipts.
4. **Health/drift** detects state drift, adapter failures, and integrity anomalies.
5. **Evidence** writes durable artifacts under `docs/sprints/<Sxx>/evidence/`.

Key guarantees:

- no hidden command paths outside the shared executor,
- no random/time-based nondeterminism in critical replay paths,
- explicit hard-stop reasons when prerequisites are not met.

## Repository Structure

- `engine/` core execution, eventing, evaluation, and integration logic
- `policy/` policy checks and constraints
- `src/s0x/` sprint modules (operator tools, health/drift, terminal panel, etc.)
- `tests/` sprint and integration acceptance harnesses
- `docs/sprints/` sprint plans and durable evidence bundles
- `scripts/` preflight, verify, and migration simulation scripts
- `.github/workflows/` CI gates and reporting

## Requirements

- Node.js 22+
- npm 10+
- git
- ripgrep (`rg`)
- GitHub CLI (`gh`) for PR-oriented workflows
- `pre-commit` for local hook parity with CI

## Quick Start

```bash
git clone https://github.com/Doogie201/promptops-gui.git
cd promptops-gui
npm ci
npm run -s preflight
npm run -s verify
```

## How To Launch / Run Locally

This repository currently ships deterministic modules and tooling, not a long-running desktop GUI binary.

Use these operator-grade entrypoints:

```bash
# full local certification gate (preflight + build + tests + lint)
npm run -s verify

# run all project tests
npm test

# run sprint-specific acceptance tests (example: S16)
node --test --experimental-transform-types tests/s16/s16.test.ts

# build static output + bundle analysis
npm run build
```

Bundle analysis artifacts are produced under `coverage/bundle-analysis/`.

## NPM Scripts Reference

- `npm run preflight` — mandatory environment/repo safety checks
- `npm run verify` — full operator gate (`preflight`, `build`, `test`, `lint`)
- `npm run lint` — policy/security/path lint checks
- `npm run test` — full test suite
- `npm run build` — TypeScript + Vite bundle analysis build
- `npm run simulate:migration` — run migration simulation outside repo cwd

## Operator-Grade Workflow

Recommended loop:

1. `git status --porcelain=v1 --branch`
2. `npm ci`
3. `npm run -s preflight`
4. `npm run -s verify`
5. fix smallest safe diff
6. attach evidence receipts in sprint docs + PR

Reference: [OPERATIONS.md](./OPERATIONS.md), [ARCHITECTURE_INFERENCE.md](./ARCHITECTURE_INFERENCE.md), [docs/sprints](./docs/sprints/README.md).

## Security, Reporting, and Support

- Security policy: [SECURITY.md](./SECURITY.md)
- Contribution process: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Issue tracker: [GitHub Issues](https://github.com/Doogie201/promptops-gui/issues)

## License

MIT — see [LICENSE](./LICENSE).

## Coverage / Codecov

- Codecov project: [Doogie201/promptops-gui](https://codecov.io/gh/Doogie201/promptops-gui)
- Graphs:
  - [Sunburst](https://codecov.io/gh/Doogie201/promptops-gui/graphs/sunburst.svg)
  - [Grid](https://codecov.io/gh/Doogie201/promptops-gui/graphs/tree.svg)
  - [Icicle](https://codecov.io/gh/Doogie201/promptops-gui/graphs/icicle.svg)
