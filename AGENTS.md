# AGENTS.md

## Mission
Operate this repository as an autonomous software production system with deterministic outcomes, bounded risk, and operator-grade verification.

## Canonical Commands
- Install: `npm ci`
- Preflight: `npm run -s preflight`
- Build: `npm run -s build`
- Unit + integration tests: `npm run -s test:all`
- Lint/stoplight checks: `npm run -s lint`
- Full gate: `npm run -s verify` or `bash gates.sh`
- Migration simulation (non-repo cwd): `npm run -s simulate:migration`

## Autonomous Execution Contract
1. Observe repository state and active branch/worktree.
2. Plan smallest safe change set.
3. Execute changes with explicit boundaries.
4. Run canonical verification commands.
5. Record concise evidence and decisions.
6. Refactor only with measurable improvement.

## Architectural Invariants
- `policy/` is a leaf module (no local imports into policy).
- Avoid absolute machine-specific paths in source and scripts.
- Deterministic outputs only (sorted keys/entries, stable hashes, no timestamp contracts).
- No new external dependencies without explicit justification.
- Resolve repository root from git/script location; never assume a fixed mount path.

## Safety Rules
- Never use destructive git resets/checkouts to discard user work.
- Keep operational artifacts in `artifacts/proof/` or `.agent_state/` only.
- Treat failed verification as blocking.
- Do not bypass tests by weakening acceptance checks.
- If repository is under `/Volumes/*`, preflight must verify mount presence/writability and fail safe with one operator action.

## Documentation Outputs Per Change
- Update `CHANGELOG_AGENT.md` with concrete delta.
- Update `DECISIONS.md` for non-obvious tradeoffs.
- Update `NEXT_AUTONOMOUS_ACTIONS.md` with prioritized next loop items.
