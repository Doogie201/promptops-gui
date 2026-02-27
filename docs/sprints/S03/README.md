# Sprint S03: Policy + Template Compiler (Ticket Factory v1)

## Objective
Implement a deterministic policy+template compiler that turns Sprint Requirements into a filled JSON ticket (Template), with placeholder binding, template version pinning, schema validation, canonical byte-stable output, protected-section safety checks, and upgrade/update GitHub pre-commit guardrails to operator-grade for this repo.

## Work Plan
- **S03.A Template registry v1**: implement a versioned template registry with immutable-by-default versions, each with content hash + metadata (name, status active/archived).
- **S03.A2**: Pin template version per sprint/run; ensure older sprint references remain stable even if newer template becomes active.
- **S03.B Placeholder binding engine v1**: parse template placeholders, detect missing values; return a deterministic “needs input” state when any placeholders are missing (no partial ticket emitted).
- **S03.B2 Deterministic rendering rules**: stable key ordering, no timestamps/UUIDs, canonical byte-stable JSON output.
- **S03.C Ticket output validator**: validate JSON syntax + required keys + required placeholders resolved; emit deterministic failure reasons.
- **S03.D Template safety protections**: protected sections diff detection (Hard Stops, Non-negotiables, Evidence Contract); refuse activation if protected sections removed unless explicit override flag is present (engine-level).
- **S03.E Pre-commit upgrade/update to operator-grade**: strengthen GitHub pre-commit configuration to enforce repo guardrails (format/lint/typecheck/tests/stoplight as applicable) without adding new third-party dependencies. Ensure local pre-commit run and pre-commit.ci succeed with receipts.

## Acceptance Tests
- **AT-S03-01**: Given requirements + settings, compiler emits schema-valid ticket deterministically (same input -> identical byte output + identical hash).
- **AT-S03-02**: Missing placeholder triggers “needs input” state and emits no partial ticket file; deterministic missing-key list ordering.
- **AT-S03-03**: Template version pinning: old sprint continues using v1 even if v2 becomes active; receipts show v1 hash used for old sprint and v2 for new.
- **AT-S03-04**: Pre-commit operator-grade: running pre-commit locally (or repo gates that include pre-commit) succeeds, and pre-commit.ci shows SUCCESS for the PR.

## Definition of Done (DoD)
- All ATs pass with durable receipts.
- S03 Docs and Backlog maintained.
- Pre-commit validated.
- Primary worktree strictly synced and within budget lines.
