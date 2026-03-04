---
name: evaluator-closeout
description: Use this skill to implement or validate evaluator-led sprint closeout behavior (ledger citations, repeat-request blocking, and no-ticket-on-complete contract).
---

# Evaluator Closeout Skill

## Use When
- Sprint closeout requires objective done/partial/todo/blocked classification.
- Delta tickets must include only outstanding requirements.
- Repeat-request loops must be blocked with `needs_input`.

## Procedure
1. Validate evaluator contract in `engine/evaluator.ts`.
2. Add or update tests in `engine/evaluator.test.ts` for deterministic outputs.
3. Ensure complete verdict removes delta ticket artifacts.
4. Ensure repeat requests against already-done requirements return blocked/needs_input.
5. Run evaluator tests and integration tests.

## Constraints
- Preserve canonical ordering and byte-stable outputs.
- Never introduce timestamp-based output fields.
- Do not include already-done requirements in generated delta tickets.
