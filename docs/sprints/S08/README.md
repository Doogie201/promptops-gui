# Sprint S08: Agent Adapters v1 + Continuity Packet

## Objective
Add deterministic programmatic invocation for Codex (primary) and Claude (secondary), with auto/manual switching and Continuity Packet v1 so the next agent resumes without rework.

## Scope
- `src/s08/**` for contract, continuity packet, adapter invocation, and switching logic.
- `docs/sprints/S08/**` for durable sprint evidence.
- No new endpoints/routes.
- No new dependencies.

## Canonical Contract (S08.A)
- Input envelope fields: rendered ticket JSON, continuity packet/hash, repo context snapshot, policy bundle, evidence ledger snapshot, run timeline tail, checkpoint id, outstanding deltas, no-rework directive.
- Output envelope fields: raw output, parsed evidence, machine summary, normalized status (`success|needs_input|blocked|exhausted|error`), deterministic error type, transcript paths.
- HARD STOP if no-rework directive or evidence ledger excerpt is missing.

## Adapter Rules (S08.B + S08.C)
- Codex adapter is primary; Claude adapter is secondary.
- Invocation is deterministic: explicit cwd, env allowlist, timeout, transcript capture, normalized output artifact.
- Run store layout:
  - `/tmp/promptops/S08/adapters/codex/<run_id>/...`
  - `/tmp/promptops/S08/adapters/claude/<run_id>/...`

## Continuity Packet v1 (S08.D)
Required packet fields:
1. rendered ticket JSON + template version hash
2. evidence ledger snapshot
3. repo context snapshot
4. run timeline tail + last checkpoint id
5. outstanding delta list
6. budgets/whitelist/policy bundle

Hashing rules:
- Canonical JSON with stable key ordering.
- Deterministic redaction of sensitive key names (`token|secret|password|authorization|api_key|access_key`).
- Artifacts:
  - `continuity_packet.json`
  - `continuity_packet.sha256`

## Switching Rules (S08.E)
- Manual switch: pause -> packet checkpoint -> swap adapter -> resume.
- Auto switch triggers:
  - `status=exhausted`
  - repeated transient failures beyond bounded retries
  - non-interactive approval block
- First line for resumed agent prompt must include continuity hash and no-rework clause.

## Persistence / Keys
- No new app persistence/storage keys were added.
- Continuity and transcripts are file artifacts under `/tmp/promptops/S08/**` and copied durably to `docs/sprints/S08/evidence/**`.

## Acceptance Tests
- `AT-S08-01` Manual switch with no rework of done ledger items.
- `AT-S08-02` Auto switch on exhausted status.
- `AT-S08-03` Deterministic packet hash + deterministic next-agent first message.

## Evidence Paths
- Staging: `/tmp/promptops/S08/**`
- Durable: `docs/sprints/S08/evidence/**`
- PR readiness + codex thread resolution: `docs/sprints/S08/evidence/pr_readiness/**`
