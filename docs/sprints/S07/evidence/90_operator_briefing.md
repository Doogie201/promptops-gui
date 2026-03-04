# S07 Operator Briefing
## What changed
- Added S07 protocol engine module at src/s07/open_pr_protocol.ts.
- Added fixture-driven AT coverage at src/s07/open_pr_protocol.test.ts.
- Added CLI harness at scripts/s07-open-pr-protocol.ts.
- Synced docs: docs/backlog/README.md, docs/sprints/README.md, docs/sprints/S07/README.md.

## Protocol capabilities delivered
- Canonical root resolution precedence: PROMPTOPS_GUI_CANONICAL_ROOT, then git toplevel.
- CWD guardrail: hard stop if cwd is outside canonical root.
- Preflight receipts: pwd, toplevel, git-common-dir, worktree list, status, fetch, ahead/behind, branch, log, prune, fsck.
- Deterministic stage timeline and reason codes.
- Open PR inventory, readiness evaluation with explicit failing condition IDs, codex scan + unresolved thread resolution via GraphQL, merge step gated by operatorApprovedMerge=false default.

## Runtime evidence summary
- live env run result: /tmp/promptops/S07/20260304-062146-37340/live_env_refresh/s07_protocol_result.json
- live git fallback run result: /tmp/promptops/S07/20260304-062146-37340/live_git_refresh/s07_protocol_result.json
- open PR inventory at runtime: none open.

## Merge
- Merge not executed in S07 protocol runs (operatorApprovedMerge default false).
