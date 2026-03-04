# Stoplight Greps (S05)

Signatures:
- TODO
- FIXME
- dangerouslySetInnerHTML
- eval(

## Commands + Receipts
\n### rg -n TODO engine policy ui scripts .github docs/sprints/S05
`rg -n TODO engine policy ui scripts .github docs/sprints/S05`
engine/evaluator.test.ts:32:    { id: 'C-TODO', description: 'Synthesize websocket retry policy artifact', evidencePath: 'docs/sprints/S04/evidence/c-todo.txt' }
engine/evaluator.test.ts:41:    ['A-DONE:done', 'B-PARTIAL:partial', 'C-TODO:todo']
engine/evaluator.test.ts:94:    { id: 'TODO-01', description: 'remaining requirement' }
engine/evaluator.test.ts:104:    ['TODO-01']
EXIT_CODE=0
\n### rg -n FIXME engine policy ui scripts .github docs/sprints/S05
`rg -n FIXME engine policy ui scripts .github docs/sprints/S05`
EXIT_CODE=1
\n### rg -n dangerouslySetInnerHTML engine policy ui scripts .github docs/sprints/S05
`rg -n dangerouslySetInnerHTML engine policy ui scripts .github docs/sprints/S05`
scripts/verify.sh:28:  if rg -n "dangerouslySetInnerHTML" ui engine adapters policy 2>/dev/null; then
EXIT_CODE=0
\n### rg -n eval\( engine policy ui scripts .github docs/sprints/S05
`rg -n eval\( engine policy ui scripts .github docs/sprints/S05`
EXIT_CODE=1
