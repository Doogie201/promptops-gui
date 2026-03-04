# Sprint S05: Command Executor + Receipts Engine (GUI-first)

## Objective
Create a single sandboxed command execution layer that runs `git`/`gh`/test commands and captures receipts (stdout/stderr/exit codes) for evidence, usable by the GUI now and by an optional terminal panel later without divergence.

## Work Plan
- **S05.A Command whitelist model**: Implement deny-by-default command execution with explicit allowlisted binaries and argument-token validation.
- **S05.A2 Path whitelist model**: Enforce safe `cwd` and path arguments so command activity is restricted to repo roots plus approved `/tmp` staging roots.
- **S05.B Receipts capture/storage**: Emit standard JSON receipts containing command, args, cwd, env-name allowlist, stdout/stderr, exit code, timeout, and artifact paths.
- **S05.C Determinism/redaction**: Normalize output for stable hashing while preserving non-normalized artifacts; deterministically redact secrets/tokens.
- **S05.D Proof-first validation**: Produce durable evidence under `docs/sprints/S05/evidence/` for acceptance tests and gate runs.

## Acceptance Tests
- **AT-S05-01**: Disallowed command/path is blocked with a clear error and a recorded event.
- **AT-S05-02**: Allowed commands produce receipts with exit codes captured.
- **AT-S05-03**: Running the same allowed command twice yields stable normalized receipt hashes while preserving non-normalized artifacts.

## Definition of Done
- AT-S05-01/02/03 pass with durable receipts in `docs/sprints/S05/evidence/`.
- Repo verification gates pass with captured command receipts.
- Scope stays minimal and maintainability budgets are respected.
- No new dependencies, endpoints, or command-surface expansion outside sprint requirements.

## Non-Negotiables (Sprint-local)
- Security: deny-by-default execution, strict allowlists, deterministic secret redaction.
- Determinism: single source of truth for receipt normalization + hashing.
- No scope creep: smallest safe change set, no unrelated refactors.
- No merge in-agent: stop at merge-ready and wait for Marcus approval.

## Evidence Bundle Paths
- Durable: `docs/sprints/S05/evidence/`
- Staging: `/tmp/promptops/S05/receipts/` and `/tmp/promptops/S05/security/`
