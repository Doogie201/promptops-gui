# S18 Evidence Index

## Command Receipts

- `spec_generation_20260305_224637/01_pwd.txt` — cwd proof.
- `spec_generation_20260305_224637/02_promptops_repo.txt` — repo-root env proof.
- `spec_generation_20260305_224637/03_show_toplevel.txt` — git toplevel proof.
- `spec_generation_20260305_224637/04_branch.txt` — branch proof.
- `spec_generation_20260305_224637/05_status.txt` — working-tree snapshot.
- `spec_generation_20260305_224637/07_diff_backlog.txt` — backlog entry update diff.
- `spec_generation_20260305_224637/08_diff_sprints_index.txt` — sprint index update diff.
- `spec_generation_20260305_224637/09_ls_s18.txt` — S18 files created.
- `spec_generation_20260305_224637/10_readme_head.txt` — S18 spec content capture.
- `spec_generation_20260305_224637/11_contracts_json.txt` — machine-readable contracts content capture.
- `spec_generation_20260305_224637/12_contracts_json_valid.txt` — JSON parse validation.
- `spec_generation_20260305_224637/13_*` to `22_*` — current-state evidence basis from existing modules/workflows used by the spec.
- `spec_generation_20260305_224637/00_tmp_bundle_path.txt` — source `/tmp` bundle pointer.
- `work_items/S18-UXQ-01_20260306_153142/00_*` to `18_*` — current-run gate, regression, scope, maintainability, and closeout receipts for the first-run wizard work item.
- `work_items/S18-UXQ-02_20260306_162409/00_*` to `28_*` — current-run gate, regression, scope, maintainability, and acceptance receipts for the visual loop stepper work item.
- `work_items/S18-UXQ-03_20260306_172212/00_*` to `29_*` — current-run gate, regression, scope, maintainability,
  and acceptance receipts for the in-flow human gate controls work item.
- `work_items/S18-UXQ-04_20260306_191031/00_*` to `23_*` — current-run gate, regression, scope, maintainability, and acceptance receipts for the diff-first delta review work item.
- `work_items/S18-UXQ-04_20260306_194829/00_*` to `10_*` — remediation receipts closing PR #32 review findings for dispatch enforcement and collision-safe prompt diff paths.
- `work_items/S18-UXQ-05_20260306_202359/00_*` to `36_*` — current-run gate, replay/resume acceptance, scope,
  maintainability, closeout, and review-remediation receipts for the one-click replay/resume work item.
- `work_items/S18-UXQ-06_20260306_210115/00_*` to `28_*` — current-run gate, scope-guard acceptance, scope, maintainability, and closeout receipts for the scope guard UX work item.

## Status Claims

- `gap_proof/latest.json` — proof that existing implemented sprint surface was inventoried before net-new S18 work.
- `spec_generation_20260305_224637/32_contracts_governance_valid.txt` — governance contract JSON validation receipt.
- `spec_generation_20260305_224637/35_status_after_governance.txt` — repo status snapshot after governance updates.
- `work_items/S18-UXQ-01_20260306_153142/09_gate_gap_proof.json` — current-run proof that `S18-UXQ-01` was still queued and lacked targeted tests before implementation.
- `work_items/S18-UXQ-01_20260306_153142/13_gate_summary.json` — current-run PASS decision for gap-proof, scope, maintainability, and evidence locks before code.
- `work_items/S18-UXQ-01_20260306_153142/28_final_status.json` — final work-item verdict with acceptance evidence paths and gate results.
- `work_items/S18-UXQ-02_20260306_162409/09_gate_gap_proof.json` — current-run proof that `S18-UXQ-02` was still queued and lacked implementation/test coverage before code.
- `work_items/S18-UXQ-02_20260306_162409/13_gate_summary.json` — current-run PASS decision for gap-proof, scope, maintainability, and evidence locks before code.
- `work_items/S18-UXQ-02_20260306_162409/28_final_status.json` — final work-item verdict with acceptance evidence paths and gate results.
- `work_items/S18-UXQ-03_20260306_172212/09_gate_gap_proof.json` — current-run proof that `S18-UXQ-03` was still queued and lacked implementation/test coverage before code.
- `work_items/S18-UXQ-03_20260306_172212/13_gate_summary.json` — current-run PASS decision for gap-proof, scope, maintainability, and evidence locks before code.
- `work_items/S18-UXQ-03_20260306_172212/15_targeted_tests_post.txt` — refreshed targeted proof that each
  delta loop-back now requires the current approval sequence after PR review.
- `work_items/S18-UXQ-03_20260306_172212/26_verify_final.txt` — refreshed full `verify:s18` proof after the stale delta-approval fix.
- `work_items/S18-UXQ-03_20260306_172212/28_final_status.json` — final work-item verdict with acceptance evidence paths and gate results.
- `work_items/S18-UXQ-04_20260306_191031/05_gate_gap_proof.json` — current-run proof that `S18-UXQ-04` was still queued and lacked implementation/test coverage before code.
- `work_items/S18-UXQ-04_20260306_191031/09_gate_summary.json` — current-run PASS decision for gap-proof, scope, maintainability, and evidence locks before code.
- `work_items/S18-UXQ-04_20260306_191031/16_acceptance_summary.json` — acceptance proof that delta review output is deterministic, diff-first, and blocks no-op redispatch.
- `work_items/S18-UXQ-04_20260306_191031/23_final_status.json` — final work-item verdict with acceptance evidence paths and gate results.
- `work_items/S18-UXQ-04_20260306_194829/01_pr32_threads_before.json` — proof of the two unresolved PR #32 findings before remediation.
- `work_items/S18-UXQ-04_20260306_194829/05_acceptance_summary.json` — remediation proof that dispatch now blocks no-op delta review and escaped prompt paths avoid collisions.
- `work_items/S18-UXQ-04_20260306_194829/10_final_status.json` — corrected work-item verdict and updated acceptance evidence path after remediation.
- `work_items/S18-UXQ-05_20260306_202359/05_gate_gap_proof.json` — current-run proof that `S18-UXQ-05` was still queued and lacked implementation coverage before code.
- `work_items/S18-UXQ-05_20260306_202359/09_gate_summary.json` — current-run PASS decision for gap-proof, scope, maintainability, and evidence locks before code.
- `work_items/S18-UXQ-05_20260306_202359/14_acceptance_summary.json` — acceptance proof that replay/resume
  auto-selects the latest checkpoint, prefers the highest checkpoint sequence, exposes a hash parity badge,
  and blocks drifted or unhashed resumes.
- `work_items/S18-UXQ-05_20260306_202359/29_final_status.json` — final work-item verdict with acceptance evidence paths and gate results.
- `work_items/S18-UXQ-05_20260306_202359/35_review_fix_targeted_tests.txt` — targeted regression proof for the post-review checkpoint ordering remediation.
- `work_items/S18-UXQ-05_20260306_202359/36_review_fix_verify.txt` — full `verify:s18` proof for the post-review checkpoint ordering remediation.
- `work_items/S18-UXQ-06_20260306_210115/05_gate_gap_proof.json` — current-run proof that `S18-UXQ-06` was still queued and lacked implementation/test coverage before code.
- `work_items/S18-UXQ-06_20260306_210115/09_gate_summary.json` — current-run PASS decision for gap-proof, scope, maintainability, and evidence locks before code.
- `work_items/S18-UXQ-06_20260306_210115/16_acceptance_summary.json` — acceptance proof that pre-dispatch
  scope signals expose in-scope and out-of-scope paths and require approved SCR coverage before dispatch.
- `work_items/S18-UXQ-06_20260306_210115/28_final_status.json` — final work-item verdict with acceptance evidence paths and gate results.
- `work_items/S18-UXQ-06_20260306_210115/31_review_fix_acceptance.json` — remediation proof that `src/s18/**`
  no longer matches sibling prefixes and that dot-segment paths normalize out of scope before dispatch.
- `work_items/S18-UXQ-06_20260306_210115/32_review_fix_precommit.txt` — pre-commit proof for the PR review remediation.
- `work_items/S18-UXQ-06_20260306_210115/33_review_fix_targeted_tests.txt` — targeted regression proof for the
  directory-boundary and path-normalization remediation.
- `work_items/S18-UXQ-06_20260306_210115/34_review_fix_verify.txt` — full `verify:s18` proof for the PR review remediation.
