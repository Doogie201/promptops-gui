# Security Policy

## Supported Versions

Security fixes are applied on the actively maintained branch:

| Branch | Supported |
|---|---|
| `main` | Yes |
| Sprint/topic branches | Best effort, not guaranteed |

## Reporting a Vulnerability

Please do **not** open public issues for security-sensitive findings.

Use one of these channels:

1. GitHub Security Advisories (preferred):  
   https://github.com/Doogie201/promptops-gui/security/advisories/new
2. If advisories are unavailable, open a private contact request through repository maintainers and include:
   - vulnerability summary,
   - impact assessment,
   - reproduction steps,
   - affected commit/branch,
   - mitigation suggestions.

## What To Expect

- Initial acknowledgment target: within 72 hours.
- Triage and severity classification after reproduction.
- Fix release timing depends on severity and exploitability.
- Coordinated disclosure is preferred after a fix is available.

## Security Baselines in This Repository

- deny-by-default command execution with allowlisted specs,
- deterministic receipts for command/audit traceability,
- hard-stop guards for repo state and integrity checks,
- lint/stoplight checks for high-risk patterns (unsafe HTML sinks, hardcoded paths, etc.).

## Out of Scope

- Findings in forks or modified deployments not based on this repository’s current `main`.
- Issues requiring unsupported runtime environments or unmaintained branches.
