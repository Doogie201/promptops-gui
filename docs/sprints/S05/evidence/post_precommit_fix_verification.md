\n## npm -s run verify
`npm -s run verify`
[verify] preflight
preflight ok: repo_root=/Volumes/X9_DEV/Dev/Projects/promptops-gui node=v22.15.0 npm=10.9.2
[verify] build
[verify] tests
TAP version 13
# (node:81533) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:81533) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/engine/command_executor.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: AT-S05-01 disallowed command/path is blocked with clear error and recorded event
ok 1 - AT-S05-01 disallowed command/path is blocked with clear error and recorded event
  ---
  duration_ms: 4.723416
  type: 'test'
  ...
# Subtest: AT-S05-02 allowed command captures stdout/stderr/exit code receipts
ok 2 - AT-S05-02 allowed command captures stdout/stderr/exit code receipts
  ---
  duration_ms: 17.383667
  type: 'test'
  ...
# Subtest: AT-S05-03 repeated allowed command yields stable normalized hash
ok 3 - AT-S05-03 repeated allowed command yields stable normalized hash
  ---
  duration_ms: 30.988875
  type: 'test'
  ...
# (node:81534) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:81534) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/engine/evaluator.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: AT-S04-01: ledger marks done/partial/todo with stable citations
ok 4 - AT-S04-01: ledger marks done/partial/todo with stable citations
  ---
  duration_ms: 10.296333
  type: 'test'
  ...
# Subtest: AT-S04-02: delta ticket includes only outstanding items and is deterministic
ok 5 - AT-S04-02: delta ticket includes only outstanding items and is deterministic
  ---
  duration_ms: 1.547167
  type: 'test'
  ...
# Subtest: AT-S04-03: done items are never re-asked in delta ticket
ok 6 - AT-S04-03: done items are never re-asked in delta ticket
  ---
  duration_ms: 0.706958
  type: 'test'
  ...
# Subtest: AT-S04-05: repeat request is blocked/needs_input and emits no looping delta ticket
ok 7 - AT-S04-05: repeat request is blocked/needs_input and emits no looping delta ticket
  ---
  duration_ms: 0.828667
  type: 'test'
  ...
# Subtest: AT-S04-06: when complete, evaluator emits no delta ticket file
ok 8 - AT-S04-06: when complete, evaluator emits no delta ticket file
  ---
  duration_ms: 0.431542
  type: 'test'
  ...
# (node:81535) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:81535) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/engine/events/schema.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: canonicalSerialize sorts keys deterministically
ok 9 - canonicalSerialize sorts keys deterministically
  ---
  duration_ms: 1.132958
  type: 'test'
  ...
# Subtest: idForEvent is stable across payload key ordering
ok 10 - idForEvent is stable across payload key ordering
  ---
  duration_ms: 0.755167
  type: 'test'
  ...
# (node:81536) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:81536) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/policy/index.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: policy defaults satisfy invariants
ok 11 - policy defaults satisfy invariants
  ---
  duration_ms: 0.7265
  type: 'test'
  ...
# Subtest: policy rejects duplicate whitelist entries
ok 12 - policy rejects duplicate whitelist entries
  ---
  duration_ms: 0.194125
  type: 'test'
  ...
# Subtest: policy enforces positive line and function budgets
ok 13 - policy enforces positive line and function budgets
  ---
  duration_ms: 0.0655
  type: 'test'
  ...
# Subtest: policy whitelist root is absolute
ok 14 - policy whitelist root is absolute
  ---
  duration_ms: 0.318292
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
# duration_ms 176.140417
TAP version 13
# (node:81645) ExperimentalWarning: Type Stripping is an experimental feature and might change at any time
# (Use `node --trace-warnings ...` to show where the warning was created)
# (node:81645) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Volumes/X9_DEV/Dev/Projects/promptops-gui/engine/integration.test.ts is not specified and it doesn't parse as CommonJS.
# Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
# To eliminate this warning, add "type": "module" to /Volumes/X9_DEV/Dev/Projects/promptops-gui/package.json.
# Subtest: integration: store plus evaluator remains deterministic
ok 1 - integration: store plus evaluator remains deterministic
  ---
  duration_ms: 9.976292
  type: 'test'
  ...
# Subtest: integration: complete flow removes stale delta ticket
ok 2 - integration: complete flow removes stale delta ticket
  ---
  duration_ms: 1.0785
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
# duration_ms 136.762792
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
