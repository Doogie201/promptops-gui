import test from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  generateThemeCSS,
  generateAllThemesCSS,
  generateTransitionCSS,
  getActiveTheme,
  setActiveTheme,
  resetThemeEngine,
  getTokenValue,
  getCSSVariableName,
  getAllCSSVariableNames,
  themes,
  THEME_IDS,
  DEFAULT_THEME,
  type ThemeId,
} from '../src/design-system/tokens.ts';
import {
  curves,
  durations,
  generateMotionTokensCSS,
  buttonHover,
  buttonPress,
  panelEnter,
  panelExit,
  allInteractions,
  generateInteractionCSS,
  createAmbientState,
  advanceAmbient,
  getAmbientCSSForPhase,
  generateAmbientKeyframesCSS,
} from '../src/design-system/motion.ts';
import {
  shadowPresets,
  shadowPresetToCSS,
  generateShadowTokensCSS,
  glowPresets,
  glowToCSS,
  generateGlowTokensCSS,
  computeDynamicShadow,
  generateAllLightingCSS,
} from '../src/design-system/lighting.ts';
import {
  detectCapabilities,
  createSceneState,
  activateScene,
  deactivateScene,
  handleSceneError,
  generateSceneFallbackCSS,
  isSceneEnabled,
} from '../src/design-system/scene-layer.ts';

const EVIDENCE_ROOT = '/tmp/promptops/S13';
const SNAPSHOT_DIR = path.join(EVIDENCE_ROOT, 'snapshots');
const PERF_DIR = path.join(EVIDENCE_ROOT, 'perf');
const A11Y_DIR = path.join(EVIDENCE_ROOT, 'a11y');

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// ── AT-S13-01: Theme/motion respects reduced motion and passes a11y ──

test('AT-S13-01: theme transition CSS disables transitions under reduced motion', () => {
  ensureDir(A11Y_DIR);

  const normalCSS = generateTransitionCSS(false);
  const reducedCSS = generateTransitionCSS(true);

  assert.ok(normalCSS.includes('0.25s'), 'Normal mode should have 0.25s duration');
  assert.ok(normalCSS.includes('cubic-bezier'), 'Normal mode should use easing curve');
  assert.ok(reducedCSS.includes('transition-duration: 0s'), 'Reduced motion should set 0s');
  assert.ok(reducedCSS.includes('linear'), 'Reduced motion should use linear');
  assert.ok(
    normalCSS.includes('@media (prefers-reduced-motion: reduce)'),
    'Must include prefers-reduced-motion media query',
  );

  fs.writeFileSync(
    path.join(A11Y_DIR, 'reduced_motion_transition.txt'),
    `=== AT-S13-01: Reduced Motion Transition Check ===\n\n` +
      `Normal CSS contains '0.25s': PASS\n` +
      `Reduced CSS contains '0s': PASS\n` +
      `prefers-reduced-motion media query present: PASS\n\n` +
      `--- Normal CSS ---\n${normalCSS}\n\n--- Reduced CSS ---\n${reducedCSS}\n`,
  );
});

test('AT-S13-01: motion tokens set all durations to 0ms under reduced motion', () => {
  const motionCSS = generateMotionTokensCSS();

  assert.ok(
    motionCSS.includes('@media (prefers-reduced-motion: reduce)'),
    'Motion tokens must include reduced motion media query',
  );

  const reducedBlock = motionCSS.split('@media (prefers-reduced-motion: reduce)')[1];
  for (const key of Object.keys(durations)) {
    assert.ok(
      reducedBlock.includes(`--ds-motion-${key}: 0ms`),
      `Duration '${key}' must be 0ms under reduced motion`,
    );
  }

  fs.writeFileSync(
    path.join(A11Y_DIR, 'reduced_motion_tokens.txt'),
    `=== AT-S13-01: Motion Tokens Reduced Motion Check ===\n\n` +
      `All duration tokens zeroed under reduced motion: PASS\n\n` +
      `--- Motion Tokens CSS ---\n${motionCSS}\n`,
  );
});

test('AT-S13-01: ambient animation is disabled under reduced motion', () => {
  const state = createAmbientState();
  assert.strictEqual(state.phase, 'idle');
  assert.strictEqual(state.enabled, true);

  const advanced = advanceAmbient(state, true);
  assert.strictEqual(advanced.phase, 'idle', 'Under reduced motion, phase stays idle');
  assert.strictEqual(advanced.tick, 0, 'Under reduced motion, tick stays 0');

  const keyframesCSS = generateAmbientKeyframesCSS();
  assert.ok(
    keyframesCSS.includes('@media (prefers-reduced-motion: reduce)'),
    'Ambient keyframes must include reduced motion override',
  );
  assert.ok(
    keyframesCSS.includes('animation: none'),
    'Ambient animation must be none under reduced motion',
  );

  fs.writeFileSync(
    path.join(A11Y_DIR, 'reduced_motion_ambient.txt'),
    `=== AT-S13-01: Ambient Animation Reduced Motion ===\n\n` +
      `Phase stays idle under reduced motion: PASS\n` +
      `Keyframes CSS includes animation:none under reduced motion: PASS\n`,
  );
});

test('AT-S13-01: interaction CSS skips/instants under reduced motion', () => {
  for (const interaction of allInteractions) {
    const reducedCSS = generateInteractionCSS(interaction, true);
    if (interaction.reducedMotionBehavior === 'skip') {
      assert.ok(
        reducedCSS.includes('skipped'),
        `${interaction.name} should be skipped under reduced motion`,
      );
    } else {
      assert.ok(
        reducedCSS.includes('0ms'),
        `${interaction.name} should use 0ms under reduced motion`,
      );
    }
  }

  fs.writeFileSync(
    path.join(A11Y_DIR, 'reduced_motion_interactions.txt'),
    `=== AT-S13-01: Interaction Reduced Motion Behavior ===\n\n` +
      allInteractions
        .map((i) => `${i.name}: ${i.reducedMotionBehavior} → PASS`)
        .join('\n') +
      '\n',
  );
});

test('AT-S13-01: scene layer degrades under reduced motion', () => {
  const caps = detectCapabilities({
    matchMedia: (q: string) => ({ matches: q.includes('reduced-motion') }),
  });
  assert.strictEqual(caps.reducedMotion, true);
  assert.strictEqual(caps.preferredRenderer, 'none');

  const state = createSceneState(caps);
  const activated = activateScene(state);
  assert.strictEqual(activated.fallbackActive, true, 'Fallback must be active');

  const fallbackCSS = generateSceneFallbackCSS();
  assert.ok(
    fallbackCSS.includes('@media (prefers-reduced-motion: reduce)'),
    'Scene fallback must respect reduced motion',
  );

  fs.writeFileSync(
    path.join(A11Y_DIR, 'reduced_motion_scene.txt'),
    `=== AT-S13-01: Scene Layer Reduced Motion ===\n\n` +
      `Reduced motion detected: PASS\n` +
      `Fallback active: PASS\n` +
      `CSS respects prefers-reduced-motion: PASS\n`,
  );
});

test('AT-S13-01: all theme tokens produce valid CSS custom properties', () => {
  const varNames = getAllCSSVariableNames();
  for (const [key, varName] of Object.entries(varNames)) {
    assert.ok(varName.startsWith('--ds-'), `CSS var ${varName} must start with --ds-`);
  }

  for (const themeId of THEME_IDS) {
    const css = generateThemeCSS(themeId);
    assert.ok(css.includes(`data-theme="${themeId}"`), `Theme CSS must scope to data-theme`);
    for (const varName of Object.values(varNames)) {
      assert.ok(css.includes(varName), `Theme ${themeId} must define ${varName}`);
    }
  }

  fs.writeFileSync(
    path.join(A11Y_DIR, 'a11y_tokens_valid.txt'),
    `=== AT-S13-01: Token Validity Check ===\n\n` +
      `All CSS variables prefixed --ds-: PASS\n` +
      `All themes define all tokens: PASS\n` +
      `Themes: ${THEME_IDS.join(', ')}\n` +
      `Token count: ${Object.keys(varNames).length}\n`,
  );
});

// ── AT-S13-02: Visual regression snapshots across themes ──────

test('AT-S13-02: deterministic theme CSS snapshots are stable', () => {
  ensureDir(SNAPSHOT_DIR);

  const snapshots: Record<string, string> = {};
  for (const themeId of THEME_IDS) {
    const css = generateThemeCSS(themeId);
    snapshots[themeId] = css;
    fs.writeFileSync(path.join(SNAPSHOT_DIR, `theme_${themeId}.css`), css);
  }

  // Verify determinism: generate again and compare
  for (const themeId of THEME_IDS) {
    const css2 = generateThemeCSS(themeId);
    assert.strictEqual(
      css2,
      snapshots[themeId],
      `Theme ${themeId} CSS must be deterministic across calls`,
    );
  }

  // Verify themes are distinct
  assert.notStrictEqual(snapshots.operator, snapshots.stealth, 'Operator != Stealth');
  assert.notStrictEqual(snapshots.operator, snapshots.daylight, 'Operator != Daylight');
  assert.notStrictEqual(snapshots.stealth, snapshots.daylight, 'Stealth != Daylight');

  // Write combined snapshot
  const allCSS = generateAllThemesCSS();
  fs.writeFileSync(path.join(SNAPSHOT_DIR, 'all_themes.css'), allCSS);

  // Write motion snapshot
  const motionCSS = generateMotionTokensCSS();
  fs.writeFileSync(path.join(SNAPSHOT_DIR, 'motion_tokens.css'), motionCSS);

  // Write lighting snapshot
  const lightingCSS = generateAllLightingCSS();
  fs.writeFileSync(path.join(SNAPSHOT_DIR, 'lighting_tokens.css'), lightingCSS);

  // Write ambient keyframes snapshot
  const ambientCSS = generateAmbientKeyframesCSS();
  fs.writeFileSync(path.join(SNAPSHOT_DIR, 'ambient_keyframes.css'), ambientCSS);

  // Write scene fallback snapshot
  const sceneCSS = generateSceneFallbackCSS();
  fs.writeFileSync(path.join(SNAPSHOT_DIR, 'scene_fallback.css'), sceneCSS);

  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, 'INDEX.txt'),
    `=== AT-S13-02: Visual Regression Snapshot Index ===\n\n` +
      `Generated: ${new Date().toISOString()}\n\n` +
      `Theme snapshots (deterministic CSS text comparison):\n` +
      `  theme_operator.css  (${snapshots.operator.length} bytes)\n` +
      `  theme_stealth.css   (${snapshots.stealth.length} bytes)\n` +
      `  theme_daylight.css  (${snapshots.daylight.length} bytes)\n` +
      `  all_themes.css      (${allCSS.length} bytes)\n\n` +
      `Motion/Lighting snapshots:\n` +
      `  motion_tokens.css     (${motionCSS.length} bytes)\n` +
      `  lighting_tokens.css   (${lightingCSS.length} bytes)\n` +
      `  ambient_keyframes.css (${ambientCSS.length} bytes)\n` +
      `  scene_fallback.css    (${sceneCSS.length} bytes)\n\n` +
      `Determinism verified: each theme generated twice, byte-identical: PASS\n` +
      `Theme distinctness verified: all 3 themes produce different CSS: PASS\n`,
  );
});

test('AT-S13-02: motion snapshots are stable', () => {
  const css1 = generateMotionTokensCSS();
  const css2 = generateMotionTokensCSS();
  assert.strictEqual(css1, css2, 'Motion tokens CSS must be deterministic');
});

test('AT-S13-02: lighting snapshots are stable', () => {
  const css1 = generateAllLightingCSS();
  const css2 = generateAllLightingCSS();
  assert.strictEqual(css1, css2, 'Lighting CSS must be deterministic');
});

// ── AT-S13-03: Perf budget — UI remains responsive ────────────

test('AT-S13-03: theme generation completes within perf budget', () => {
  ensureDir(PERF_DIR);
  const ITERATIONS = 10000;
  const BUDGET_MS = 500;

  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    generateAllThemesCSS();
  }
  const elapsed = performance.now() - start;

  assert.ok(
    elapsed < BUDGET_MS,
    `Theme generation (${ITERATIONS}x) took ${elapsed.toFixed(1)}ms, budget is ${BUDGET_MS}ms`,
  );

  fs.writeFileSync(
    path.join(PERF_DIR, 'theme_generation.txt'),
    `=== AT-S13-03: Theme Generation Perf ===\n\n` +
      `Iterations: ${ITERATIONS}\n` +
      `Elapsed: ${elapsed.toFixed(1)}ms\n` +
      `Budget: ${BUDGET_MS}ms\n` +
      `Per-iteration: ${(elapsed / ITERATIONS).toFixed(3)}ms\n` +
      `Result: ${elapsed < BUDGET_MS ? 'PASS' : 'FAIL'}\n`,
  );
});

test('AT-S13-03: theme switching completes within perf budget', () => {
  const ITERATIONS = 100000;
  const BUDGET_MS = 500;

  resetThemeEngine();
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    setActiveTheme(THEME_IDS[i % THEME_IDS.length]);
    getTokenValue('accent');
  }
  const elapsed = performance.now() - start;
  resetThemeEngine();

  assert.ok(
    elapsed < BUDGET_MS,
    `Theme switching (${ITERATIONS}x) took ${elapsed.toFixed(1)}ms, budget is ${BUDGET_MS}ms`,
  );

  fs.writeFileSync(
    path.join(PERF_DIR, 'theme_switching.txt'),
    `=== AT-S13-03: Theme Switching Perf ===\n\n` +
      `Iterations: ${ITERATIONS}\n` +
      `Elapsed: ${elapsed.toFixed(1)}ms\n` +
      `Budget: ${BUDGET_MS}ms\n` +
      `Per-iteration: ${(elapsed / ITERATIONS).toFixed(4)}ms\n` +
      `Result: ${elapsed < BUDGET_MS ? 'PASS' : 'FAIL'}\n`,
  );
});

test('AT-S13-03: ambient animation driver is bounded and non-looping', () => {
  const ITERATIONS = 1000;
  const BUDGET_MS = 100;

  let state = createAmbientState();
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    state = advanceAmbient(state, false);
  }
  const elapsed = performance.now() - start;

  assert.ok(state.tick < 100, 'Tick should be bounded within phase');
  assert.ok(
    elapsed < BUDGET_MS,
    `Ambient advance (${ITERATIONS}x) took ${elapsed.toFixed(1)}ms, budget is ${BUDGET_MS}ms`,
  );

  fs.writeFileSync(
    path.join(PERF_DIR, 'ambient_driver.txt'),
    `=== AT-S13-03: Ambient Driver Perf ===\n\n` +
      `Iterations: ${ITERATIONS}\n` +
      `Final phase: ${state.phase}\n` +
      `Final tick: ${state.tick}\n` +
      `Elapsed: ${elapsed.toFixed(1)}ms\n` +
      `Budget: ${BUDGET_MS}ms\n` +
      `Result: ${elapsed < BUDGET_MS ? 'PASS' : 'FAIL'}\n`,
  );
});

test('AT-S13-03: full design system CSS generation perf', () => {
  const ITERATIONS = 5000;
  const BUDGET_MS = 1000;

  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    generateAllThemesCSS();
    generateMotionTokensCSS();
    generateAllLightingCSS();
    generateAmbientKeyframesCSS();
    generateSceneFallbackCSS();
  }
  const elapsed = performance.now() - start;

  assert.ok(
    elapsed < BUDGET_MS,
    `Full CSS gen (${ITERATIONS}x) took ${elapsed.toFixed(1)}ms, budget is ${BUDGET_MS}ms`,
  );

  fs.writeFileSync(
    path.join(PERF_DIR, 'full_css_generation.txt'),
    `=== AT-S13-03: Full CSS Generation Perf ===\n\n` +
      `Iterations: ${ITERATIONS}\n` +
      `Elapsed: ${elapsed.toFixed(1)}ms\n` +
      `Budget: ${BUDGET_MS}ms\n` +
      `Per-iteration: ${(elapsed / ITERATIONS).toFixed(3)}ms\n` +
      `Result: ${elapsed < BUDGET_MS ? 'PASS' : 'FAIL'}\n`,
  );
});

// ── Unit tests (supplemental coverage) ────────────────────────

test('theme engine defaults to operator', () => {
  resetThemeEngine();
  assert.strictEqual(getActiveTheme(), 'operator');
  assert.strictEqual(DEFAULT_THEME, 'operator');
});

test('theme engine switches and returns definition', () => {
  resetThemeEngine();
  const def = setActiveTheme('stealth');
  assert.strictEqual(def.id, 'stealth');
  assert.strictEqual(getActiveTheme(), 'stealth');
  resetThemeEngine();
});

test('theme engine rejects unknown theme', () => {
  assert.throws(() => setActiveTheme('unknown' as ThemeId), /Unknown theme/);
});

test('shadow presets produce valid CSS', () => {
  assert.strictEqual(shadowPresetToCSS(shadowPresets.flat), 'none');
  assert.ok(shadowPresetToCSS(shadowPresets.elevated).includes('rgba'));
  assert.ok(shadowPresetToCSS(shadowPresets.floating).includes(','));
});

test('dynamic shadow clamps depth multiplier', () => {
  const noShadow = computeDynamicShadow(shadowPresets.elevated, -1);
  assert.strictEqual(noShadow.includes('0px 0px'), true, 'Negative depth should clamp to 0');

  const maxShadow = computeDynamicShadow(shadowPresets.elevated, 10);
  assert.ok(maxShadow.includes('rgba'), 'Clamped at 3x should still produce valid CSS');
});

test('glow presets reference CSS variables', () => {
  for (const [, glow] of Object.entries(glowPresets)) {
    const css = glowToCSS(glow);
    assert.ok(css.includes('var(--ds-'), 'Glow should reference design system CSS vars');
  }
});

test('scene layer is off by default', () => {
  assert.strictEqual(isSceneEnabled(), false);
  const state = createSceneState();
  assert.strictEqual(state.enabled, false);
  assert.strictEqual(state.status, 'disabled');
  assert.strictEqual(state.fallbackActive, true);
});

test('scene layer handles errors gracefully', () => {
  const state = createSceneState();
  const errored = handleSceneError(state, 'WebGL context lost');
  assert.strictEqual(errored.status, 'error');
  assert.strictEqual(errored.fallbackActive, true);
  assert.strictEqual(errored.errorMessage, 'WebGL context lost');
});

test('scene layer deactivates cleanly', () => {
  const state = createSceneState();
  const deactivated = deactivateScene(state);
  assert.strictEqual(deactivated.status, 'disabled');
  assert.strictEqual(deactivated.fallbackActive, true);
  assert.strictEqual(deactivated.errorMessage, null);
});

test('ambient animation cycles through phases deterministically', () => {
  let state = createAmbientState();
  const phases: string[] = [state.phase];

  // Advance through enough ticks to cycle all phases
  for (let i = 0; i < 200; i++) {
    state = advanceAmbient(state, false);
    if (state.tick === 0 && !phases.includes(state.phase)) {
      phases.push(state.phase);
    }
  }

  assert.ok(phases.includes('idle'), 'Should visit idle phase');
  assert.ok(phases.includes('pulse'), 'Should visit pulse phase');
  assert.ok(phases.includes('glow'), 'Should visit glow phase');
  assert.ok(phases.includes('rest'), 'Should visit rest phase');
});

test('ambient CSS for each phase returns valid properties', () => {
  const phases = ['idle', 'pulse', 'glow', 'rest'] as const;
  for (const phase of phases) {
    const css = getAmbientCSSForPhase(phase);
    assert.ok('opacity' in css, `Phase ${phase} must have opacity`);
    assert.ok('filter' in css, `Phase ${phase} must have filter`);
  }
});
