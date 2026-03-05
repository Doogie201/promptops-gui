# S11 - Template Lifecycle Manager

## Sprint Header
- Sprint ID: `S11-template-lifecycle-manager`
- Branch: `sprint/S11-template-lifecycle-manager`
- Objective: Implement an operator-grade Template lifecycle manager with versioning, contract validation (including protected diffs), deterministic preview compile, activation/rollback, and explicit reversible sprint migration.

## Work Plan
1. Add `src/s11/template_lifecycle.ts` for Template Registry v2, contract validation, protected-diff handling, deterministic preview compile, activation/rollback, migration, and guardrails.
2. Add AT-focused unit tests in `src/s11/s11.test.ts` that emit deterministic evidence artifacts under `/tmp/promptops/S11/{templates,preview,migrate,tests}`.
3. Produce durable receipts under `docs/sprints/S11/evidence/` by copying from `/tmp` staging after gates/ATs pass.
4. Open one S11 PR with required labels/body and attach evidence paths.

## Acceptance Tests
- `AT-S11-01`: Activation blocks when required contract keys/placeholders are missing; exact fields are surfaced.
- `AT-S11-02`: Protected-section weakening blocks activation; two-step override is required and audit-evented.
- `AT-S11-03`: In-flight run migration preserves done-ledger items, re-keys idempotency with template hash, and records old→new link.
- `AT-S11-04`: Rollback restores deterministic behavior; preview hash and render output match prior pinned version.

## Definition of Done
- Registry lifecycle states supported: `active | draft | archived`.
- Every template version includes `contentHash`, `createdAt` (monotonic), `author`, and `note`.
- Preview compile output is canonical and idempotent for identical inputs.
- Protected sections cannot be weakened without explicit two-step override confirmation and durable event trail.
- Migration and rollback produce continuity packet artifacts and idempotency link proofs.
- Durable evidence exists under `docs/sprints/S11/evidence/`.

## Evidence Paths
- Staging:
  - `/tmp/promptops/S11/templates/*`
  - `/tmp/promptops/S11/preview/*`
  - `/tmp/promptops/S11/migrate/*`
  - `/tmp/promptops/S11/tests/*`
- Durable:
  - `docs/sprints/S11/evidence/preflight/*`
  - `docs/sprints/S11/evidence/gates/*`
  - `docs/sprints/S11/evidence/at/*`
  - `docs/sprints/S11/evidence/templates/*`
  - `docs/sprints/S11/evidence/preview/*`
  - `docs/sprints/S11/evidence/migrate/*`
  - `docs/sprints/S11/evidence/stoplight/*`
