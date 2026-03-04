# Stoplight signatures
## Signature 1
CMD: rg -n "dangerouslySetInnerHTML" ui engine adapters policy
EXIT_CODE:1

## Signature 2
CMD: rg -n "/Users/marcussmith/Projects\._backup_|Projects\._backup_" engine policy adapters ui gates.sh scripts package.json .github
EXIT_CODE:1

## Signature 3
CMD: rg -n "/Volumes/[^/]+/Dev" . --glob !docs/sprints/**/evidence/** --glob !node_modules/** --glob !coverage/** --glob !artifacts/proof/** --glob !.git/** --glob !scripts/verify.sh
EXIT_CODE:1
