\n## npm -s run verify
`npm -s run verify`
[verify] preflight
preflight ok: repo_root=/Volumes/X9_DEV/Dev/Projects/promptops-gui node=v22.15.0 npm=10.9.2
[verify] build
[verify] tests
TAP version 13
# (node:86533) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:86533) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/engine/command_executor.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: AT-S05-01 disallowed command/path is blocked with clear error and recorded event
ok 1 - AT-S05-01 disallowed command/path is blocked with clear error and recorded event
  ---
  duration_ms: 7.377792
  type: 'test'
  ...
# Subtest: AT-S05-02 allowed command captures stdout/stderr/exit code receipts
ok 2 - AT-S05-02 allowed command captures stdout/stderr/exit code receipts
  ---
  duration_ms: 16.402166
  type: 'test'
  ...
# Subtest: AT-S05-03 repeated allowed command yields stable normalized hash
ok 3 - AT-S05-03 repeated allowed command yields stable normalized hash
  ---
  duration_ms: 29.12875
  type: 'test'
  ...
# (node:86534) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:86534) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/engine/evaluator.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: AT-S04-01: ledger marks done/partial/todo with stable citations
ok 4 - AT-S04-01: ledger marks done/partial/todo with stable citations
  ---
  duration_ms: 9.807167
  type: 'test'
  ...
# Subtest: AT-S04-02: delta ticket includes only outstanding items and is deterministic
ok 5 - AT-S04-02: delta ticket includes only outstanding items and is deterministic
  ---
  duration_ms: 1.017625
  type: 'test'
  ...
# Subtest: AT-S04-03: done items are never re-asked in delta ticket
ok 6 - AT-S04-03: done items are never re-asked in delta ticket
  ---
  duration_ms: 0.625125
  type: 'test'
  ...
# Subtest: AT-S04-05: repeat request is blocked/needs_input and emits no looping delta ticket
ok 7 - AT-S04-05: repeat request is blocked/needs_input and emits no looping delta ticket
  ---
  duration_ms: 0.633167
  type: 'test'
  ...
# Subtest: AT-S04-06: when complete, evaluator emits no delta ticket file
ok 8 - AT-S04-06: when complete, evaluator emits no delta ticket file
  ---
  duration_ms: 0.341167
  type: 'test'
  ...
# (node:86535) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:86535) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/engine/events/schema.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: canonicalSerialize sorts keys deterministically
ok 9 - canonicalSerialize sorts keys deterministically
  ---
  duration_ms: 0.609167
  type: 'test'
  ...
# Subtest: idForEvent is stable across payload key ordering
ok 10 - idForEvent is stable across payload key ordering
  ---
  duration_ms: 1.601708
  type: 'test'
  ...
# (node:86536) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:86536) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/policy/index.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: policy defaults satisfy invariants
ok 11 - policy defaults satisfy invariants
  ---
  duration_ms: 0.753875
  type: 'test'
  ...
# Subtest: policy rejects duplicate whitelist entries
ok 12 - policy rejects duplicate whitelist entries
  ---
  duration_ms: 0.194584
  type: 'test'
  ...
# Subtest: policy enforces positive line and function budgets
ok 13 - policy enforces positive line and function budgets
  ---
  duration_ms: 0.063667
  type: 'test'
  ...
# Subtest: policy whitelist root is absolute
ok 14 - policy whitelist root is absolute
  ---
  duration_ms: 0.288834
  type: 'test'
  ...
1..14
# tests 14
# suites 0
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 187.35675
TAP version 13
# (node:86640) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:86640) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/engine/integration.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: integration: store plus evaluator remains deterministic
ok 1 - integration: store plus evaluator remains deterministic
  ---
  duration_ms: 10.280625
  type: 'test'
  ...
# Subtest: integration: complete flow removes stale delta ticket
ok 2 - integration: complete flow removes stale delta ticket
  ---
  duration_ms: 0.713333
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 129.933416
[verify] lint
EXIT_CODE=0
\n## pre-commit run --all-files
`pre-commit run --all-files`
trim trailing whitespace.................................................Passed
fix end of files.........................................................Passed
check yaml...............................................................Passed
check json...............................................................Passed
check for case conflicts.................................................Passed
mixed line ending........................................................Passed
Operator Gates (Build/Test/Lint/Stoplight)...............................Passed
EXIT_CODE=0
