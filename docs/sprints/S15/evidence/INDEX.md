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
