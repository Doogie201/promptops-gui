# Stoplight Greps

Markers:
- dangerouslySetInnerHTML
- HYDRATION_ERROR
- HTTP 500
- UnhandledPromiseRejection
- TypeError

Scope paths: apps src scripts docs/sprints/S09

CMD: rg -n "dangerouslySetInnerHTML" apps src scripts docs/sprints/S09
scripts/verify.sh:28:  if rg -n "dangerouslySetInnerHTML" ui engine adapters policy 2>/dev/null; then
docs/sprints/S09/evidence/stoplight/08_stoplight_greps.md:4:- dangerouslySetInnerHTML
docs/sprints/S09/evidence/stoplight/08_stoplight_greps.md:12:CMD: rg -n "dangerouslySetInnerHTML" apps src components packages scripts docs/sprints/S09
docs/sprints/S09/evidence/stoplight/08_stoplight_greps.md:15:scripts/verify.sh:28:  if rg -n "dangerouslySetInnerHTML" ui engine adapters policy 2>/dev/null; then
docs/sprints/S09/evidence/EVD-S09-02/08_stoplight_greps.md:4:- dangerouslySetInnerHTML
docs/sprints/S09/evidence/EVD-S09-02/08_stoplight_greps.md:12:CMD: rg -n "dangerouslySetInnerHTML" apps src components packages scripts docs/sprints/S09
docs/sprints/S09/evidence/EVD-S09-02/08_stoplight_greps.md:15:scripts/verify.sh:28:  if rg -n "dangerouslySetInnerHTML" ui engine adapters policy 2>/dev/null; then
EXIT_CODE: 0

CMD: rg -n "HYDRATION_ERROR|HTTP 500|UnhandledPromiseRejection|TypeError" <AT/gate logs>
EXIT_CODE: 1

Runtime note: S09 validation is fixture/model-driven; no browser dev server process was started in this run.
