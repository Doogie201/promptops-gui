MARKERS: dangerouslySetInnerHTML | HARD STOP | PROMPTOPS_REPO | OUT_OF_SYNC
CMD: rg -n "dangerouslySetInnerHTML" apps src scripts
scripts/verify.sh:28:  if rg -n "dangerouslySetInnerHTML" ui engine adapters policy 2>/dev/null; then
CMD: rg -n "HARD STOP" src/s10 apps/s10_gui_operator_tools_v1.ts docs/sprints/S10
CMD: rg -n "PROMPTOPS_REPO" src/s10 apps/s10_gui_operator_tools_v1.ts docs/sprints/S10
apps/s10_gui_operator_tools_v1.ts:58:        : 'Update Setup Wizard repo root to PROMPTOPS_REPO before running tools.',
docs/sprints/S10/README.md:10:2. Enforce migration-safe root resolution from `PROMPTOPS_REPO` and deterministic hard-stop codes.
src/s10/operator_exec.ts:7:const SAFE_ENV_KEYS = ['CI', 'HOME', 'LANG', 'LC_ALL', 'NO_COLOR', 'PATH', 'TERM', 'GIT_TERMINAL_PROMPT', 'PROMPTOPS_REPO'];
src/s10/operator_exec.ts:119:    const value = key === 'PROMPTOPS_REPO' ? repoRoot : process.env[key];
src/s10/operator_tools.ts:329:    { id: 'echo_promptops_repo', command: 'bash', args: ['-lc', 'echo "$PROMPTOPS_REPO"'] },
src/s10/operator_tools.ts:438:  if (!envRepo) return fail('MISSING_REPO_ROOT', 'PROMPTOPS_REPO is empty.', branch, dirty, aheadBehind);
CMD: rg -n "OUT_OF_SYNC" src/s10 apps/s10_gui_operator_tools_v1.ts docs/sprints/S10
src/s10/operator_types.ts:12:  | 'OUT_OF_SYNC'
src/s10/operator_tools.ts:264:  const result = buildResult('out_of_sync', pass ? 'NONE' : 'OUT_OF_SYNC', pass ? 'PASS' : 'FAIL', pass ? 'No out-of-sync signals detected.' : 'Out-of-sync signals detected.', {
EXIT_CODE: 0
