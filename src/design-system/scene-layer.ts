/**
 * S13 — 3D-Ready Scene Layer (OFF by default)
 *
 * Abstraction layer for future 3D scene hosting.
 * Progressive enhancement with capability detection.
 * Safe fallback without errors.
 */

// ── Capability detection ──────────────────────────────────────

export interface SceneCapabilities {
  reducedMotion: boolean;
  lowPower: boolean;
  webglAvailable: boolean;
  webgpuAvailable: boolean;
  preferredRenderer: 'none' | 'css' | 'canvas2d' | 'webgl' | 'webgpu';
}

export function detectCapabilities(env?: {
  matchMedia?: (query: string) => { matches: boolean };
  gpu?: unknown;
  canvas?: { getContext: (id: string) => unknown | null };
}): SceneCapabilities {
  const reducedMotion = env?.matchMedia
    ? env.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const lowPower = env?.matchMedia
    ? env.matchMedia('(prefers-reduced-data: reduce)').matches
    : false;

  const webglAvailable = env?.canvas
    ? env.canvas.getContext('webgl2') !== null || env.canvas.getContext('webgl') !== null
    : false;

  const webgpuAvailable = env?.gpu !== undefined && env?.gpu !== null;

  let preferredRenderer: SceneCapabilities['preferredRenderer'] = 'none';
  if (!reducedMotion && !lowPower) {
    if (webgpuAvailable) preferredRenderer = 'webgpu';
    else if (webglAvailable) preferredRenderer = 'webgl';
    else preferredRenderer = 'css';
  }

  return { reducedMotion, lowPower, webglAvailable, webgpuAvailable, preferredRenderer };
}

// ── Scene layer state ─────────────────────────────────────────

export type SceneStatus = 'disabled' | 'ready' | 'active' | 'error' | 'degraded';

export interface SceneState {
  enabled: boolean;
  status: SceneStatus;
  capabilities: SceneCapabilities;
  errorMessage: string | null;
  fallbackActive: boolean;
}

const SCENE_FEATURE_FLAG = false;

export function createSceneState(capabilities?: SceneCapabilities): SceneState {
  const caps = capabilities ?? detectCapabilities();
  return {
    enabled: SCENE_FEATURE_FLAG,
    status: 'disabled',
    capabilities: caps,
    errorMessage: null,
    fallbackActive: !SCENE_FEATURE_FLAG,
  };
}

export function activateScene(state: SceneState): SceneState {
  if (!state.enabled) {
    return { ...state, status: 'disabled', fallbackActive: true };
  }
  if (state.capabilities.reducedMotion || state.capabilities.lowPower) {
    return {
      ...state,
      status: 'degraded',
      fallbackActive: true,
      errorMessage: 'Scene degraded: reduced motion or low power detected',
    };
  }
  if (state.capabilities.preferredRenderer === 'none') {
    return {
      ...state,
      status: 'degraded',
      fallbackActive: true,
      errorMessage: 'Scene degraded: no suitable renderer available',
    };
  }
  return { ...state, status: 'active', fallbackActive: false, errorMessage: null };
}

export function deactivateScene(state: SceneState): SceneState {
  return { ...state, status: 'disabled', fallbackActive: true, errorMessage: null };
}

export function handleSceneError(state: SceneState, message: string): SceneState {
  return {
    ...state,
    status: 'error',
    fallbackActive: true,
    errorMessage: message,
  };
}

// ── Fallback CSS ──────────────────────────────────────────────

export function generateSceneFallbackCSS(): string {
  let css = '.ds-scene-container {\n';
  css += '  position: relative;\n';
  css += '  overflow: hidden;\n';
  css += '  background: var(--ds-surface-primary);\n';
  css += '}\n\n';
  css += '.ds-scene-fallback {\n';
  css += '  position: absolute;\n';
  css += '  inset: 0;\n';
  css += '  background: radial-gradient(\n';
  css += '    ellipse at 50% 50%,\n';
  css += '    var(--ds-accent-muted) 0%,\n';
  css += '    transparent 70%\n';
  css += '  );\n';
  css += '  opacity: var(--ds-glow-intensity, 0.2);\n';
  css += '  pointer-events: none;\n';
  css += '}\n\n';
  css += '@media (prefers-reduced-motion: reduce) {\n';
  css += '  .ds-scene-fallback {\n';
  css += '    opacity: 0.1;\n';
  css += '  }\n}';
  return css;
}

export function isSceneEnabled(): boolean {
  return SCENE_FEATURE_FLAG;
}
