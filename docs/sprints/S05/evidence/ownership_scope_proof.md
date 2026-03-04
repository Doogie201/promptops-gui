# S05 Ownership + Scope Proof

## Command
`rg -n "child_process|spawnSync\(|spawn\(|execFile\(|execSync\(|fork\(" engine policy ui scripts adapters docs .github`

## Output

## Command
`sed -n "1,40p" engine/README.md`

## Output
# Engine

**Boundary**: Core business logic and pure state transformations.
**Prohibited Imports**: Cannot import from `ui/` or `adapters/`. Only imports from `policy/` or intra-module allowed.

## Determination
No existing command execution layer was found by source search. Engine boundary explicitly owns core business logic, so S05 extends engine with one command-executor module and tests.
