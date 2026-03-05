# Contributing to promptops-gui

Thanks for contributing. This repository enforces operator-grade guardrails, deterministic behavior, and evidence-first workflows.

## Ground Rules

- Keep changes minimal and scoped to the objective.
- Do not bypass guardrails or suppress failing checks.
- Preserve deterministic behavior in critical paths.
- Prefer additive evidence over assumptions.

## Prerequisites

- Node.js 22+
- npm 10+
- git
- `rg` (ripgrep)
- `pre-commit`

## Setup

```bash
git clone https://github.com/Doogie201/promptops-gui.git
cd promptops-gui
npm ci
pre-commit install
```

## Branch + PR Workflow

1. Create a topic branch from an up-to-date `main`.
2. Implement the smallest safe diff.
3. Run full local gates:

```bash
npm run -s verify
pre-commit run --all-files
```

4. Push and open a PR.
5. Attach evidence receipts for claims (especially for sprint work in `docs/sprints/<Sxx>/evidence/`).
6. Resolve all review threads before merge.

## Commit Guidance

- Use clear, imperative commit messages.
- Keep unrelated changes out of the same commit.
- Avoid formatting-only churn unless the PR is explicitly a formatting pass.

## Testing Expectations

At minimum, run:

```bash
npm run lint
npm test
npm run build
```

For sprint modules, run the sprint-specific test target (example):

```bash
node --test --experimental-transform-types tests/s16/s16.test.ts
```

## Security and Safety Requirements

- No untrusted HTML sinks (`dangerouslySetInnerHTML`).
- No hardcoded machine-specific absolute paths.
- No hidden command paths outside shared executors.
- No new third-party dependencies without explicit justification.

Security reports should follow [SECURITY.md](./SECURITY.md).

## Documentation Requirements

If behavior changes, update relevant docs:

- `README.md` for public-facing usage changes
- `docs/sprints/` for sprint-specific evidence and decisions
- `docs/backlog/README.md` for backlog/sprint objective alignment

## Pull Request Checklist

- [ ] Scope is minimal and intentional
- [ ] Local gates pass (`verify`, `pre-commit`)
- [ ] Tests added/updated for behavior changes
- [ ] Evidence attached for all non-trivial claims
- [ ] Docs updated where needed
- [ ] Review threads fully resolved
