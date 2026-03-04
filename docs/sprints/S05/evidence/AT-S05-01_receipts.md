# AT-S05-01 Receipts

Command evidence source: `EVD-S05-02_whitelist_violation_proofs.jsonl`

## Blocked Case 1
- command: `cat /etc/passwd`
- policy_decision: `blocked`
- exit_code: `126`
- stderr: `policy denied: command 'cat' is not allowlisted`
- receipt_path: `/private/tmp/promptops/S05/security/at-s05-01/1772585060228-77770-a3db16670956.receipt.json`

## Blocked Case 2
- command: `git status -- /etc/passwd`
- policy_decision: `blocked`
- exit_code: `126`
- stderr: `policy denied: path '/etc/passwd' escapes allowlisted roots`
- receipt_path: `/private/tmp/promptops/S05/security/at-s05-01/1772585060229-77770-36c08bba5ec2.receipt.json`
