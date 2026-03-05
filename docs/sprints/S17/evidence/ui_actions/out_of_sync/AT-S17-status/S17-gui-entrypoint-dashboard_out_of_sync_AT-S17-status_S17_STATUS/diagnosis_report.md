# Out-of-sync Diagnosis

## Signals
- DIRTY_TREE_MID_RUN: ACTIVE (status has tracked/untracked changes)
- HEAD_CHANGED_UNEXPECTEDLY: clear (expected=n/a current=5aac09dad45c53bba6e37344056d004347a1f68b)
- BEHIND_ORIGIN_MAIN: clear (ahead=0 behind=0)
- MISSING_EVIDENCE_PATHS: clear (none)
- MISSING_SPRINT_DOCS: clear (docs/sprints/S10/README.md)

## Repair Actions
- DIRTY_TREE_MID_RUN: Re-run Preflight and pause run until clean.
