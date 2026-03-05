# S15 Evidence Index

## Preflight + Start
- `preflight/14_open_pr_inventory.txt` — open PR disposition at sprint start.
- `preflight/03_pwd.txt`, `preflight/04_echo_promptops_repo.txt`, `preflight/05_show_toplevel.txt` — repo-root gate proof.
- `preflight/07_status_main.txt` — clean `main` proof.
- `preflight/09_revlist_head_origin_main.txt` — main sync proof (`0 0`).
- `preflight/12_prune_dry_run.txt` + `preflight/13_fsck_no_reflogs.txt` — git hygiene/integrity probes.
- `preflight/10_branch.txt` + `preflight/15_checkout_sprint.txt` — branch compliance and sprint branch restoration.

## Gates
- `gates/20_precommit_all.txt`
- `gates/21_npm_lint.txt`
- `gates/22_npm_test.txt`
- `gates/23_npm_build.txt`

## Acceptance Tests
- `at/AT-S15-01_receipt_schema.json`
- `at/AT-S15-02_blocked_security_event.json`
- `at/AT-S15-03_sync_gate.json`
- `at/10_at_s15.txt` (test run command receipt)

## Scope + Maintainability
- `scope/01_diff_names.txt`
- `scope/02_whitelist_eval.txt`
- `scope/03_numstat_budget_eval.txt`
- `maintainability/04_touched_file_loc.txt`
- `maintainability/05_function_length_eval.txt`
- `maintainability/06_budget_eval.md`

## Stoplight
- `stoplight/01_marker_list.txt`
- `stoplight/02_html_marker_grep.txt`
- `stoplight/03_time_random_marker_grep.txt`
- `stoplight/04_storage_marker_grep.txt`
- `stoplight/05_hardpath_marker_grep.txt`

## PR Readiness
- `pr/29_ff_sync_after_precommit.txt` — ff-only sync after pre-commit.ci remote advance.
- `pr/30_pr_view_final_a.txt`, `pr/34_pr_view_final_b.txt`
- `pr/32_checks_final_a.txt`, `pr/36_checks_final_b.txt`
- `pr/11_threads_before_resolve.txt`, `pr/15_threads_after_resolve.txt`
- `pr/13_resolve_thread_1.txt`, `pr/14_resolve_thread_2.txt`
- `pr/33_wait_190_final_head.txt`, `pr/37_stability_eval_final_head.txt`
- `pr/38_ff_sync_after_precommit_second.txt` — second ff-only sync after bot advance.
- `pr/40_pr_view_ultra_a.txt`, `pr/44_pr_view_ultra_b.txt`
- `pr/41_threads_ultra_a.txt`, `pr/45_threads_ultra_b.txt`
- `pr/42_checks_ultra_a.txt`, `pr/46_checks_ultra_b.txt`
- `pr/43_wait_190_ultra.txt`, `pr/47_stability_eval_ultra.txt`
