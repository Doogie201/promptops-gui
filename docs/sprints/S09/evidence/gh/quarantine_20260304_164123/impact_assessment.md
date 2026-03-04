# Impact Assessment — quarantine_20260304_164123

## Date: 2026-03-04
## Source: /Volumes/X9_DEV/Dev/Projects/promptops-gui.quarantine_20260304_164123
## Branch: sprint/S08-agent-adapters-v1-continuity (remote tracking: GONE)
## Base relationship: 8 ahead, 2 behind origin/main (squash-merged as PR#12)

---

## 1. File Classification Table

### Modified Files (8)

| File | Type | Risk | Description |
|------|------|------|-------------|
| docs/sprints/S06/README.md | DOCS | Low | Retroactive doc fix: S06.A references `PROMPTOPS_REPO` instead of `~/Projects/promptops-gui` |
| docs/sprints/S07/README.md | DOCS | Low | Retroactive doc fix: S07.E references `PROMPTOPS_REPO` instead of `PROMPTOPS_GUI_CANONICAL_ROOT` |
| docs/sprints/S08/README.md | DOCS | Low | Adds root remediation delta note + migration playbook reference |
| scripts/migration-sim.sh | SCRIPT | Medium | Replaces SCRIPT_DIR relative resolution with PROMPTOPS_REPO + git toplevel validation |
| scripts/preflight.sh | SCRIPT | **HIGH** | Major rewrite: 54→133 lines. Adds run_probe(), comprehensive preflight (fetch, worktree, prune, fsck, branch sync), proper hard-stop exit codes. **WILL CONFLICT with main.** |
| scripts/s07-open-pr-protocol.ts | SCRIPT | Low | Adds `process.env.PROMPTOPS_REPO` fallback |
| scripts/verify.sh | SCRIPT | Medium | Replaces relative path resolution with PROMPTOPS_REPO + git toplevel validation |
| src/s07/open_pr_protocol.ts | CODE | Low | Adds `process.env.PROMPTOPS_REPO` fallback in resolveConfig() |

### Untracked Files (24)

| File | Type | Risk | Description |
|------|------|------|-------------|
| docs/sprints/S08/MIGRATION_PLAYBOOK.md | DOCS | None | New migration guide for PROMPTOPS_REPO adoption |
| docs/sprints/S08/evidence/gh/merge_run_R4_20260304_135258/* (23 files) | EVIDENCE | None | Audit trail from PR#12 merge process |

---

## 2. High-Risk Findings

### H1: preflight.sh major rewrite (CONFLICT risk)
- The quarantine rewrites preflight.sh from 54 to 133 lines.
- Main's current preflight.sh (post-S09 merge) still uses `SCRIPT_DIR` relative paths.
- S09 PR#13 also modified preflight.sh (`7 +-` lines). Porting the quarantine version will produce merge conflicts.
- The rewrite introduces comprehensive preflight checks (fetch, worktree, prune, fsck, branch/sync validation) — these are valuable but represent a **breaking behavioral change** (all scripts now require `PROMPTOPS_REPO` env var to be set).

### H2: Breaking change — PROMPTOPS_REPO now mandatory
- All operator scripts (preflight.sh, verify.sh, migration-sim.sh) will exit 41 if `PROMPTOPS_REPO` is unset.
- This is a deliberate design choice but affects all existing workflows.
- CI/CD pipelines would need `PROMPTOPS_REPO` exported.

### H3: Retroactive doc modifications
- S06 and S07 README changes rewrite historical sprint descriptions.
- Low risk but philosophically questionable (modifying historical sprint docs post-close).

---

## 3. Security Assessment

- **No dangerouslySetInnerHTML** in new code
- **No new dependencies** (no package.json changes)
- **No new endpoints/routes/IPC handlers**
- **No new persistence keys** (no localStorage/sessionStorage/indexedDB)
- **No fetch()/axios calls** in new code
- **PASS**: No scope/security breach detected

---

## 4. Recommended Disposition: **KEEP_QUARANTINED**

### Rationale:
1. **Too large for a hygiene PR**: The preflight.sh rewrite alone is 80+ lines of new logic with breaking behavioral changes.
2. **Conflict risk**: preflight.sh was modified by both S09 (already merged) and this change set. Conflict resolution requires careful review.
3. **Breaking change**: Mandatory PROMPTOPS_REPO env var would break any workflow that doesn't set it.
4. **Left uncommitted intentionally**: These changes were not included in the S08 squash merge (PR#12), suggesting they were considered out-of-scope or incomplete.
5. **Proper scope needed**: This work should be a dedicated sprint task (e.g., "root remediation") with proper AT coverage, not a quarantine cleanup.

### What to do next (future sprint):
- Scope a proper task for PROMPTOPS_REPO root remediation.
- Include AT coverage for the new preflight behavior.
- Update CI to export PROMPTOPS_REPO.
- Port changes with proper conflict resolution against current main.
- The quarantine directory + this evidence bundle serve as the design reference.
