# S13 — Design System v1

## Sprint Header

| Field | Value |
|---|---|
| Sprint ID | S13-design-system-v1 |
| Branch | sprint/S13-design-system-v1 |
| Base | main |
| Objective | Implement a performance-safe, a11y-safe design system foundation: semantic theme tokens, animated theme transitions (reduced-motion compliant), motion primitives, dynamic lighting/shadows, and a 3D-ready scene layer (off by default) with progressive enhancement and safe fallback. |

## Work Plan

### Phase 0 — Discovery
- Locate existing theming/styling/motion/a11y usage (none found; backend-only project)
- Inventory test/visual-regression tooling (Node.js native test runner + c8 only)
- TEST_INFRA_GAP resolved: deterministic text-based snapshots via `node --test`

### Phase 1 — Token System + Theme Engine (S13.A)
- Semantic tokens: accent, glow, elevation, blur, surface, text as CSS custom properties
- 3 themes: operator (default), stealth (dark), daylight (light)
- Animated theme transitions respecting `prefers-reduced-motion`
- Session-only toggle (no new persistence keys)

### Phase 2 — Motion Primitives (S13.B)
- Motion curves + durations as tokens (--motion-ease, --motion-fast, --motion-med, --motion-slow)
- Button hover/press micro-interaction definitions
- Panel transition definitions
- Phase-linked ambient animation driver (event-driven, bounded, off under reduced motion)

### Phase 3 — Lighting/Shadows (S13.C)
- Dynamic shadow layers using GPU-friendly techniques (opacity/transform/blur bounded)
- Operator console glow system as tokenized layer

### Phase 4 — 3D-Ready Scene Layer (S13.D)
- Abstraction layer for future 3D scene hosting (OFF by default)
- Progressive enhancement with capability detection
- Safe fallback without errors

### Phase 5 — Tests + Evidence
- AT-S13-01: Reduced motion + a11y verification
- AT-S13-02: Deterministic theme CSS snapshots (3 themes)
- AT-S13-03: Perf budget benchmark

## Acceptance Tests

- [ ] AT-S13-01: Theme/motion respects reduced motion and passes a11y checks
- [ ] AT-S13-02: Visual regression snapshots across 2–3 themes are stable
- [ ] AT-S13-03: Perf budget: UI remains responsive during long runs

## Evidence Bundles

See `docs/sprints/S13/evidence/` for all receipts.

## Definition of Done

- All ATs pass with durable evidence
- All code within whitelist
- No new dependencies
- No new persistence keys
- 3D scene layer off by default
- Reduced motion deterministically disables/shortens all transitions
- PR merged to main
