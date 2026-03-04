# Product Backlog

- **S06-git-worktree-preflight-automation**: Implement operator-grade git/worktree preflight automation in the engine using the receipts executor, including primary-worktree hard-stop evidence, sprint branch-prefix compliance with remediation guidance, prune/worktree sanity policy checks, and deterministic OUT_OF_SYNC event emission.
- **S05-command-executor-receipts-engine**: Implement a sandboxed command execution layer with deny-by-default allowlisted commands/paths and a deterministic receipts engine (stdout/stderr/exit code, deterministic redaction, normalized stable hashing) for GUI-first use and future terminal-panel reuse without divergence.
- **S02-engine-run-store-idempotency-resume**: Implement a deterministic, append-only run store plus idempotency and crash-safe resume so identical inputs converge to identical outputs without duplicating actions.
- **S03-policy-template-compiler-ticket-factory-v1**: Implement a deterministic policy+template compiler that turns Sprint Requirements into a filled JSON ticket (Template), with placeholder binding, template version pinning, schema validation, canonical byte-stable output, protected-section safety checks, and upgrade/update GitHub pre-commit guardrails to operator-grade for this repo.
- **S04-evaluator-evidence-ledger-codecov**: Implement a deterministic evaluator that compares Agent Output vs Sprint Requirements, maintains an evidence ledger, and emits only delta tickets when incomplete, while also adding operator-grade Codecov coverage upload in CI.
## Technical Debt / Backlog Items
- **S01 gates.sh absolute-path + grep-redirection issue**: Documented from S01 closeout; fix needed separately (do not fix in S02).
