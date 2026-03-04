# Quarantine Map — promptops-gui.quarantine_20260304_164123

## Date: 2026-03-04
## Decision: KEEP_QUARANTINED
## Agent: Operator Hygiene Agent (S09 follow-on)

---

## Quarantine Location
- Path: `/Volumes/X9_DEV/Dev/Projects/promptops-gui.quarantine_20260304_164123`
- Branch: `sprint/S08-agent-adapters-v1-continuity`
- Remote tracking: GONE (deleted after PR#12 squash merge)
- HEAD commit: `c059e25` (8 ahead, 2 behind origin/main)

## Change Set Summary (32 files)
- 8 modified tracked files (root remediation: PROMPTOPS_REPO env var adoption)
- 24 untracked files (1 migration playbook + 23 merge evidence receipts)

## Why Quarantined (Not Integrated)
1. **preflight.sh major rewrite** (54→133 lines) with conflict risk against current main
2. **Breaking behavioral change**: all operator scripts require `PROMPTOPS_REPO` env var
3. **Too large** for a hygiene PR — should be properly scoped sprint task
4. **Left uncommitted** during S08 close, suggesting intentional exclusion from PR#12

## Evidence Artifacts (Captured)
| Artifact | Path |
|----------|------|
| Full patch | `/tmp/promptops/S09/quarantine_review/quarantine_20260304_164123.patch` |
| Diff stat | `/tmp/promptops/S09/quarantine_review/quarantine_20260304_164123.diffstat.txt` |
| Untracked file list | `/tmp/promptops/S09/quarantine_review/quarantine_20260304_164123.untracked.txt` |
| Impact assessment | `/tmp/promptops/S09/quarantine_review/impact_assessment.md` |
| Phase 0 preflight receipt | `/tmp/promptops/S09/quarantine_review/phase0_preflight_receipt.txt` |
| This quarantine map | `/tmp/promptops/S09/quarantine_review/quarantine_map.md` |

## Non-Destructive Guarantee
- No files deleted from quarantine directory
- No commits made to canonical repo from quarantine content
- Quarantine directory remains intact at original path for future reference

## Recommended Follow-Up
- Scope dedicated sprint task for root remediation (PROMPTOPS_REPO migration)
- Use this quarantine as design reference (patch + migration playbook)
- Include AT coverage for new preflight behavior
- Update CI/CD to export PROMPTOPS_REPO before integrating

## Canonical Repo State
- Repo: `/Volumes/X9_DEV/Dev/Projects/promptops-gui`
- Branch: main
- Sync: 0-0 with origin/main
- Working tree: clean
- HEAD: e3f72e4
