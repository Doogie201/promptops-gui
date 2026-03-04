# S08 Stoplight Markers

## Marker list
1. `dangerouslySetInnerHTML`
2. Absolute mount paths: `/Volumes/[^/]+/Dev`
3. Secret-like patterns: `gh[pousr]_`, `github_pat_`, `CODECOV_TOKEN=`
4. New persistence usage: `localStorage|sessionStorage`

## Grep receipts

CMD: cd /Volumes/SharedDrive/Dev/Projects/promptops-gui && rg -n "dangerouslySetInnerHTML" src
EXIT_CODE:1

CMD: cd /Volumes/SharedDrive/Dev/Projects/promptops-gui && rg -n "/Volumes/[^/]+/Dev" src docs/sprints/S08 --glob "!docs/sprints/S08/evidence/**"
EXIT_CODE:1

CMD: cd /Volumes/SharedDrive/Dev/Projects/promptops-gui && rg -n "gh[pousr]_|github_pat_|CODECOV_TOKEN=" src docs/sprints/S08 --glob "!docs/sprints/S08/evidence/**"
EXIT_CODE:1

CMD: cd /Volumes/SharedDrive/Dev/Projects/promptops-gui && rg -n "localStorage|sessionStorage" src
EXIT_CODE:1
