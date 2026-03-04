# SharedDrive Complex — Quarantine Map

## Date: 2026-03-04
## Run: /tmp/promptops/S09/sharedrive_disposal_20260304_173448
## Decision: QUARANTINE_AND_DEACTIVATE

---

## DO NOT USE. Canonical is ROOT 1: `/Volumes/X9_DEV/Dev/Projects/promptops-gui`

---

## Quarantined Directories

### ROOT 3a (Parent repo — AppleDouble corrupted)
- **Original**: `/Volumes/SharedDrive/Dev/Worktrees/promptops-gui-S04`
- **Renamed to**: `/Volumes/SharedDrive/Dev/Worktrees/promptops-gui-S04.quarantine_20260304_173448`
- **Why**: AppleDouble metadata corruption (`._pack-*.idx` causing non-monotonic index errors). Contains stale worktree registration. 6 local branches all tracking deleted remote branches. Pack index corruption makes all git operations emit errors.

### ROOT 3b (Identity conflict — independent repo at worktree-registered path)
- **Original**: `/Volumes/SharedDrive/Dev/Projects/promptops-gui`
- **Renamed to**: `/Volumes/SharedDrive/Dev/Projects/promptops-gui.identity_conflict.quarantine_20260304_173448`
- **Why**: Full `.git` directory overwrote what ROOT 3a thinks is a linked worktree. On `main` branch with 6 modified files (root remediation subset). AppleDouble contamination in `.git/`. Identity conflict with ROOT 3a worktree registration. `git worktree remove` fails with error code 128.

### ROOT 3c (Stale worktree — moved from SharedDrive with broken pointer)
- **Original**: `/Volumes/X9_DEV/Dev/Projects/promptops-gui._quarantine_20260304_133952`
- **Renamed to**: `/Volumes/X9_DEV/Dev/Projects/promptops-gui.old_worktree.quarantine_20260304_173448`
- **Why**: Stale worktree of ROOT 3a. `.git` file points to SharedDrive parent. Was moved from `/Volumes/SharedDrive/Dev/Projects/promptops-gui` to X9_DEV but git path wasn't updated. On `sprint/S07` branch (remote gone). Had 5 stashes — all exported as patches.

---

## Pre-existing SharedDrive Quarantines (not touched)
- `/Volumes/SharedDrive/Dev/Projects/promptops-gui._quarantine_20260304_113232`
- `/Volumes/SharedDrive/Dev/Projects/promptops-gui._quarantine_20260304_133737`

---

## Stash Exports (ROOT 3c — preserved as patches)
| Stash | Label | Size | Export Path |
|-------|-------|------|-------------|
| stash@{0} | S07-preflight-dirty-quarantine | 35KB | 31_stash_patch_exports/stash_0.patch |
| stash@{1} | S06-return-to-sprint | 10KB | 31_stash_patch_exports/stash_1.patch |
| stash@{2} | S06-primary-hardstop-clearance | 35KB | 31_stash_patch_exports/stash_2.patch |
| stash@{3} | S06-preflight-clearance | 284KB | 31_stash_patch_exports/stash_3.patch |
| stash@{4} | WIP on S03 | 27KB | 31_stash_patch_exports/stash_4.patch |

---

## End State
- **Active**: ROOT 1 (`/Volumes/X9_DEV/Dev/Projects/promptops-gui`) — PRISTINE, on main, synced
- **Documented quarantine**: ROOT 2 (`promptops-gui.quarantine_20260304_164123`) — KEEP_QUARANTINED per PR #14
- **Deactivated**: ROOT 3a/3b/3c — renamed with `.quarantine_20260304_173448` suffix, no longer usable as active repos
