# Git/GitHub Deep Dive Verdict (refreshed)

- verdict: FAIL
- repo_root: /Volumes/X9_DEV/Dev/Projects/promptops-gui
- current_branch: sprint/S11-template-lifecycle-manager
- main_branch_classification: {'branch': 'main', 'sha': 'b7ffdca14235958eeca236919ca9e0372b6e1130', 'upstream': 'origin/main', 'trackshort': '<', 'ahead_behind_probe': {'cmd': 'git rev-list --left-right --count main...origin/main', 'cwd': '/Volumes/X9_DEV/Dev/Projects/promptops-gui', 'stdout': '0\t1\n', 'stderr': '', 'exit_code': 0}, 'ahead': 0, 'behind': 1, 'classification': 'BEHIND_ONLY'}
- sprint_branch_classification: {'branch': 'sprint/S11-template-lifecycle-manager', 'sha': '27915661e8eda3f5dac35d4ab2d3158c4b53eaed', 'upstream': 'origin/sprint/S11-template-lifecycle-manager', 'trackshort': '', 'ahead_behind_probe': {'cmd': 'git rev-list --left-right --count sprint/S11-template-lifecycle-manager...origin/sprint/S11-template-lifecycle-manager', 'cwd': '/Volumes/X9_DEV/Dev/Projects/promptops-gui', 'stdout': '', 'stderr': "fatal: ambiguous argument 'sprint/S11-template-lifecycle-manager...origin/sprint/S11-template-lifecycle-manager': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'\n", 'exit_code': 128}, 'classification': 'NO_UPSTREAM', 'probe_error': 'upstream_ref_missing_or_invalid'}
- worktree_issues_observed: ['dirty:/Volumes/X9_DEV/Dev/Projects/promptops-gui']
- fsck_dangling_detected: True
- pr18_state: MERGED
- pr18_head_sha: 27915661e8eda3f5dac35d4ab2d3158c4b53eaed
- unresolved_threads: 0
- pending_checks: []
- failing_checks: []
- issues: ['fsck_dangling_commits', 'main_not_synced', 'sprint_branch_not_synced']
