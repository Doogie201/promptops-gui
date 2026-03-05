# S11 Postcheck Git/GitHub Remediation Index

## Paths
- Staging bundle: /tmp/promptops/S11/postcheck_git_github_remediate_20260304_220615
- Durable bundle: docs/sprints/S11/evidence/postcheck_git_github_remediate/20260304_220615

## Key receipts
- `preflight/01_preflight.json`: mandatory preflight before remediation (fetch/prune/fsck/worktree/status/rev-list).
- `remediation/02_main_ff_sync.txt`: ff-only sync of `main` to `origin/main` (0 0 proof).
- `pr/03_pr18_state.json`: PR #18 merged-state evidence and head/base refs.
- `remediation/03_sprint_branch_upstream_probe.txt`: upstream-gone proof for merged S11 sprint branch.
- `remediation/03_sprint_branch_remediation.txt`: local merged sprint branch removal.
- `remediation/03_cleanup_gone_branches_and_worktree.txt`: cleanup of additional merged/no-upstream branches and stale worktree.
- `remediation/04_dirty_cause_before.txt`: dirty-state cause analysis.
- `remediation/04_cleanliness_commit1.txt`: policy-consistent cleanliness remediation commit + push.
- `remediation/05_fsck_classification.md`: dangling-only fsck classification as WARN.
- `verify/02_preflight_after.json`: full post-remediation preflight.
- `verify/03_branch_inventory_after.json`: post-remediation branch classification.
- `verify/04_worktree_inventory_after.json`: post-remediation worktree inventory.
- `verify/05_health_verdict.md`: consolidated PASS/WARN/FAIL health verdict.
- `verify/06_forbidden_ops_audit.txt`: forbidden-ops audit (no rebase/merge/reset --hard/force push/gh pr merge).
- `verify/06_durable_copy_manifest.txt`: durable copy manifest.
