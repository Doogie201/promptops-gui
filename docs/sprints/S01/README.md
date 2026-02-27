# S01: Repo Bootstrap, Guardrails, and Event Schema

## Work Plan
- Setup primary worktree preflight and open PR checks.
- Create new PromptOps GUI repository and sync to GitHub.
- Define explicit canonical folder layouts and boundary rules.
- Implement strict typed deterministic event schema.
- Implement explicit run state machine.
- Set up policy budgets and whitelists.
- Create verification scripts (build/lint/test gates, stoplight greps).

## Acceptance Tests
- [x] AT-S01-01 Event schema validates and is deterministic (same inputs → identical events.jsonl bytes)
- [x] AT-S01-02 State machine rejects illegal transitions with explicit errors
- [x] AT-S01-03 Stoplight grep catalog is produced and stored with receipts

## Definition of Done (DoD)
All ATs pass. Scope adheres to whitelist and budgets. Secure boundaries are enforced. Receipts attached.
