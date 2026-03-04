# Stoplight Greps

Markers:
- dangerouslySetInnerHTML
- HYDRATION_ERROR
- HTTP 500
- UnhandledPromiseRejection
- TypeError

Commands and receipts:

CMD: rg -n "dangerouslySetInnerHTML" apps src components packages scripts docs/sprints/S09
components: No such file or directory (os error 2)
packages: No such file or directory (os error 2)
scripts/verify.sh:28:  if rg -n "dangerouslySetInnerHTML" ui engine adapters policy 2>/dev/null; then
EXIT_CODE: 2

CMD: rg -n "HYDRATION_ERROR|HTTP 500|UnhandledPromiseRejection|TypeError" /tmp/promptops/S09/20260304_140939_31327/05_at_s09_tests.txt /tmp/promptops/S09/20260304_140939_31327/06d_gate_verify_after_npm_ci.txt /tmp/promptops/S09/20260304_140939_31327/07d_gate_gates_sh_after_npm_ci.txt
EXIT_CODE: 1

Runtime note: S09 validation is fixture/model-driven; no browser dev server process was started in this run.
