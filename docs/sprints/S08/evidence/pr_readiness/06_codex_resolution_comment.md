Addressed the three codex review findings in commit `72ac6f0` with receipts.

1. Auto-switch now skips secondary when primary returns success/needs_input (`AUTO_SWITCH_NOT_REQUIRED`) in `src/s08/switching.ts` and test `AT-S08-02b`.
2. Flow terminal status now preserves `error` instead of collapsing to `blocked` in `src/s08/switching.ts` and test `AT-S08-02c`.
3. Adapter payload parsing now supports JSONL deterministically by parsing the last valid JSON object in `src/s08/agent_adapters.ts` and test `AT-S08-03b`.

Evidence:
- `docs/sprints/S08/evidence/at/AT-S08-all-final.tap`
- `docs/sprints/S08/evidence/gates/14_verify_post_review_fixes.txt`
- `docs/sprints/S08/evidence/gates/15_gates_post_review_fixes.txt`
- `docs/sprints/S08/evidence/gates/16_precommit_post_review_fixes.txt`
