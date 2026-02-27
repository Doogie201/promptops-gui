# Product Backlog

- **S02-engine-run-store-idempotency-resume**: Implement a deterministic, append-only run store plus idempotency and crash-safe resume so identical inputs converge to identical outputs without duplicating actions.
- **S03-policy-template-compiler-ticket-factory-v1**: Implement a deterministic policy+template compiler that turns Sprint Requirements into a filled JSON ticket (Template), with placeholder binding, template version pinning, schema validation, canonical byte-stable output, protected-section safety checks, and upgrade/update GitHub pre-commit guardrails to operator-grade for this repo.
## Technical Debt / Backlog Items
- **S01 gates.sh absolute-path + grep-redirection issue**: Documented from S01 closeout; fix needed separately (do not fix in S02).
