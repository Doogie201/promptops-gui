# AT-S05-01 Receipts

Command evidence source: `EVD-S05-02_whitelist_violation_proofs.jsonl`

## Blocked Case 1
- command: `cat /etc/passwd`
- policy_decision: `blocked`
- exit_code: `126`
- stderr: `policy denied: command 'cat' is not allowlisted`
- receipt_path: `/private/tmp/promptops/S05/security/at-s05-01/1772585723689-86839-a3db16670956.receipt.json`

## Blocked Case 2
- command: `git status -- /etc/passwd`
- policy_decision: `blocked`
- exit_code: `126`
- stderr: `policy denied: path '/etc/passwd' escapes allowlisted roots`
- receipt_path: `/private/tmp/promptops/S05/security/at-s05-01/1772585723690-86839-36c08bba5ec2.receipt.json`

## Blocked Case 3
- command: `git --git-dir=/etc status`
- policy_decision: `blocked`
- exit_code: `126`
- stderr: `policy denied: path '--git-dir=/etc' escapes allowlisted roots`
- receipt_path: `/private/tmp/promptops/S05/security/at-s05-01/1772585723691-86839-3c7da93e6e35.receipt.json`

## Blocked Case 4
- command: `git status -- ./escape-link`
- policy_decision: `blocked`
- exit_code: `126`
- stderr: `policy denied: path './escape-link' escapes allowlisted roots`
- receipt_path: `/private/tmp/promptops/S05/security/at-s05-01/1772585723692-86839-ba9e514d554d.receipt.json`

## Blocked Case 5
- command: `git --version`
- policy_decision: `blocked`
- exit_code: `126`
- stderr: `policy denied: policy denied: path '/etc' is outside allowlisted roots`
- receipt_path: `/private/tmp/promptops/S05/security/at-s05-01/1772585723693-86839-54872edba4aa.receipt.json`

