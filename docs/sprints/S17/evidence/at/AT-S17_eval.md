# S17 Acceptance Test Evaluation

- AT-S17-01 PASS: `npm run dev` booted and served dashboard HTML.
  - Receipts: `../ui/00_dev_boot_receipt.txt`, `../ui/01_npm_run_dev.log`, `../ui/02_dashboard_http.txt`.
- AT-S17-02 PASS: façade `runPreflight()` executed S10 preflight command set through shared operator pipeline.
  - Receipts: `AT-S17-02_response.json`, `../gates/05_s17_tests.txt`.
- AT-S17-03 PASS: façade `runGates()` executed through shared operator pipeline with deterministic PASS/FAIL envelope.
  - Receipts: `AT-S17-03_response.json`, `../gates/05_s17_tests.txt`.
- AT-S17-04 PASS: runtime repo-root strategy resolves from env/explicit input and no hardcoded mount paths in S17 modules.
  - Receipts: `AT-S17-status_response.json`, `../audit/01_absolute_paths.txt`, `../gates/05_s17_tests.txt`.
- AT-S17-05 PASS: import-direction guard catches deliberate forbidden import and cleanly passes real S17 UI files.
  - Receipts: `../stoplight/05_forbidden_imports.txt`, `../gates/05_s17_tests.txt`.
- AT-S17-05b PASS: dashboard uses delegated click handling so action buttons remain active after re-renders.
  - Receipts: `../gates/10_s17_tests_after_thread_fix.txt`, `../pr/14_threads_after_drift.json`.
