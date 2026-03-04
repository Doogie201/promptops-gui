# CHANGELOG_AGENT

## 2026-03-01
- Added canonical verification entrypoint: `scripts/verify.sh`.
- Added missing tests:
  - `engine/events/schema.test.ts`
  - `policy/index.test.ts`
  - `engine/integration.test.ts`
- Added CI verify workflow: `.github/workflows/verify.yml`.
- Added autonomous operator docs:
  - `SYSTEM_MAP.md`
  - `ARCHITECTURE_INFERENCE.md`
  - `AGENTS.md`
  - `OPERATIONS.md`
  - `WORKSTREAM_MAP.md`
- Added reusable skills and registry:
  - `skills/repo-operability/SKILL.md`
  - `skills/evaluator-closeout/SKILL.md`
  - `SKILL_REGISTRY.md`
- Updated runtime operability wiring:
  - `package.json`
  - `gates.sh`
  - `policy/index.ts`
