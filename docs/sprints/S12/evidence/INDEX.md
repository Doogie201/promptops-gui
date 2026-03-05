# S12 Evidence Index

## Pre-start
- `prestart/01_open_pr_inventory.json.txt`

## Preflight
- `preflight/01_pwd.txt`
- `preflight/02_echo_promptops_repo.txt`
- `preflight/03_show_toplevel.txt`
- `preflight/04_worktree_list.txt`
- `preflight/05_status.txt`
- `preflight/06_fetch.txt`
- `preflight/07_revlist.txt`
- `preflight/08_branch.txt`
- `preflight/09_log.txt`
- `preflight/10_prune.txt`
- `preflight/11_fsck.txt`

## Branch
- `branch/01_branch_setup.txt`

## Gates
- `gates/build.txt`
- `gates/test_all.txt`
- `gates/lint.txt`

## Scope / Maintainability
- `scope/01_status.txt`
- `scope/02_diff_names.txt`
- `scope/03_diffstat.txt`
- `scope/whitelist_eval.txt`
- `scope/maintainability_eval.txt`

## Stoplight
- `stoplight/01_marker_list.txt`
- `stoplight/02_html_marker_grep.txt`
- `stoplight/03_stderr_marker_grep.txt`

## Acceptance Tests
- `at/AT-S12_suite.txt`
- `at/AT-S12-01_run.json`
- `at/AT-S12-01_repo_drift.json`
- `at/AT-S12-02_run.json`
- `at/AT-S12-02_adapter_switch.json`
- `at/AT-S12-03_run.json`
- `at/AT-S12-03_template_restore.json`
- `at/AT-S12-04_run.json`
- `at/AT-S12-04_safe_mode_report.json`

## PR Readiness
- `pr/01_open_prs_before_create.json.txt`
- `pr/03_pr_create_receipt.txt`
- `pr/04_pr_labels.txt`
- `pr/05_pr_view_initial.json.txt`
- `pr/06_pr_checks.txt`
- `pr/07_pr_checks_watch.txt`
- `pr/08_pr_view_ready.json.txt`
- `pr/09_pr_threads_comments.json.txt`
- `pr/10_pr_threads_eval.json`
- `scope/04_branch_sync_after_push.txt`
- `pr/11_push_ff_remediation.txt`
- `pr/12_divergence_merge_resolution.txt`

## Closeout Fix (20260304_225400)
- `pr/closeout_fix_20260304_225400/01_pr_view_after_push.json`
- `pr/closeout_fix_20260304_225400/02_pr_review_threads_after_push.json`
- `pr/closeout_fix_20260304_225400/03_pr_checks_after_push.txt`
- `pr/closeout_fix_20260304_225400/04_pr_comment_remediation.txt`
- `pr/closeout_fix_20260304_225400/06_resolve_thread_1_PRRT_kwDORZ8p_M5yOLLa.json`
- `pr/closeout_fix_20260304_225400/06_resolve_thread_2_PRRT_kwDORZ8p_M5yOLLb.json`
- `pr/closeout_fix_20260304_225400/06_resolve_thread_3_PRRT_kwDORZ8p_M5yOLLd.json`
- `pr/closeout_fix_20260304_225400/07_pr_review_threads_after_resolve.json`
- `pr/closeout_fix_20260304_225400/08_snapshot_A_pr_view.json`
- `pr/closeout_fix_20260304_225400/09_snapshot_A_threads.json`
- `pr/closeout_fix_20260304_225400/10_snapshot_A_checks.txt`
- `pr/closeout_fix_20260304_225400/11_timing_gate_190s.txt`
- `pr/closeout_fix_20260304_225400/12_snapshot_B_pr_view.json`
- `pr/closeout_fix_20260304_225400/13_snapshot_B_threads.json`
- `pr/closeout_fix_20260304_225400/14_snapshot_B_checks.txt`
- `pr/closeout_fix_20260304_225400/15_stability_eval.md`
- `pr/closeout_fix_20260304_225400/16_thread_resolution_eval.md`
- `pr/closeout_fix_20260304_225400/17_durable_copy_receipt.txt`
- `scope/closeout_fix_changed_files.txt`
- `scope/closeout_fix_diffstat.txt`

## Scope Fix Closeout
- `scope_fix/00_pwd.txt`
- `scope_fix/01_echo_PROMPTOPS_REPO.txt`
- `scope_fix/02_show_toplevel.txt`
- `scope_fix/03_branch.txt`
- `scope_fix/04_status.txt`
- `scope_fix/10_pr_files_before.txt`
- `scope_fix/11_scope_violation_excerpt_before.txt`
- `scope_fix/20_reset_s11_paths.txt`
- `scope_fix/21_status_after_reset.txt`
- `scope_fix/30_pr_files_after.txt`
- `scope_fix/31_scope_blocker_grep_after.txt`
- `scope_fix/32_whitelist_check_after.txt`
- `scope_fix/40_git_commit.txt`
- `scope_fix/41_git_push.txt`
- `scope_fix/42_log_after_push.txt`
