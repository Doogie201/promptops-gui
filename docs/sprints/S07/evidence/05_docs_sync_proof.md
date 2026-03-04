CMD: git diff -- docs/backlog/README.md docs/sprints/README.md docs/sprints/S07/README.md
diff --git a/docs/backlog/README.md b/docs/backlog/README.md
index 3e5e272..491b9d5 100644
--- a/docs/backlog/README.md
+++ b/docs/backlog/README.md
@@ -1,5 +1,6 @@
 # Product Backlog

+- **S07-github-pr-protocol-automation**: Implement Open PR Handling Protocol in-engine with GUI-visible status, deterministic stop conditions, codex-thread resolution gating, and operator-grade receipts, while enforcing canonical-worktree preflight and migration-resilient canonical root discovery.
 - **S06-git-worktree-preflight-automation**: Implement operator-grade git/worktree preflight automation in the engine using the receipts executor, including primary-worktree hard-stop evidence, sprint branch-prefix compliance with remediation guidance, prune/worktree sanity policy checks, and deterministic OUT_OF_SYNC event emission.
 - **S05-command-executor-receipts-engine**: Implement a sandboxed command execution layer with deny-by-default allowlisted commands/paths and a deterministic receipts engine (stdout/stderr/exit code, deterministic redaction, normalized stable hashing) for GUI-first use and future terminal-panel reuse without divergence.
 - **S02-engine-run-store-idempotency-resume**: Implement a deterministic, append-only run store plus idempotency and crash-safe resume so identical inputs converge to identical outputs without duplicating actions.
diff --git a/docs/sprints/README.md b/docs/sprints/README.md
index 6f58ffe..23b9f64 100644
--- a/docs/sprints/README.md
+++ b/docs/sprints/README.md
@@ -6,3 +6,4 @@
 - [S04 - Evaluator, Evidence Ledger, and Codecov](./S04/README.md)
 - [S05 - Command Executor + Receipts Engine](./S05/README.md)
 - [S06 - Git + Worktree Preflight Automation](./S06/README.md)
+- [S07 - GitHub PR Protocol Automation](./S07/README.md)
EXIT_CODE:0
