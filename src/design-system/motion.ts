/**
 * S13 — Motion Primitives
 *
 * Motion curves, durations, and interaction definitions.
 * All motion respects prefers-reduced-motion.
 * Ambient animation driver is event-driven and bounded.
 */

// ── Motion tokens ─────────────────────────────────────────────

export interface MotionCurve {
  name: string;
  cssValue: string;
  controlPoints: readonly [number, number, number, number];
}

export interface MotionDuration {
  name: string;
  ms: number;
  cssValue: string;
}

export const curves: Record<string, MotionCurve> = {
  ease: {
    name: 'ease',
    cssValue: 'cubic-bezier(0.4, 0, 0.2, 1)',
    controlPoints: [0.4, 0, 0.2, 1],
  },
  easeIn: {
    name: 'ease-in',
    cssValue: 'cubic-bezier(0.4, 0, 1, 1)',
    controlPoints: [0.4, 0, 1, 1],
  },
  easeOut: {
    name: 'ease-out',
    cssValue: 'cubic-bezier(0, 0, 0.2, 1)',
    controlPoints: [0, 0, 0.2, 1],
  },
  easeInOut: {
    name: 'ease-in-out',
    cssValue: 'cubic-bezier(0.4, 0, 0.2, 1)',
    controlPoints: [0.4, 0, 0.2, 1],
  },
  spring: {
    name: 'spring',
    cssValue: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    controlPoints: [0.34, 1.56, 0.64, 1],
  },
};

export const durations: Record<string, MotionDuration> = {
  instant: { name: 'instant', ms: 0, cssValue: '0ms' },
  fast: { name: 'fast', ms: 100, cssValue: '100ms' },
  med: { name: 'med', ms: 250, cssValue: '250ms' },
  slow: { name: 'slow', ms: 400, cssValue: '400ms' },
  ambient: { name: 'ambient', ms: 2000, cssValue: '2000ms' },
};

// ── CSS variable generation ───────────────────────────────────

export function generateMotionTokensCSS(): string {
  let css = ':root {\n';
  for (const [key, c] of Object.entries(curves)) {
    css += `  --ds-motion-${key}: ${c.cssValue};\n`;
  }
  for (const [key, d] of Object.entries(durations)) {
    css += `  --ds-motion-${key}: ${d.cssValue};\n`;
  }
  css += '}\n';

  css += '\n@media (prefers-reduced-motion: reduce) {\n  :root {\n';
  for (const key of Object.keys(durations)) {
    css += `    --ds-motion-${key}: 0ms;\n`;
  }
  css += '  }\n}';
  return css;
}

// ── Interaction definitions ───────────────────────────────────

export interface MicroInteraction {
  name: string;
  trigger: string;
  properties: Record<string, string>;
  duration: MotionDuration;
  curve: MotionCurve;
  reducedMotionBehavior: 'skip' | 'instant';
}

export const buttonHover: MicroInteraction = {
  name: 'button-hover',
  trigger: ':hover',
  properties: {
    transform: 'translateY(-1px)',
    'box-shadow': 'var(--ds-elevation-mid)',
  },
  duration: durations.fast,
  curve: curves.easeOut,
  reducedMotionBehavior: 'instant',
};

export const buttonPress: MicroInteraction = {
  name: 'button-press',
  trigger: ':active',
  properties: {
    transform: 'translateY(0) scale(0.98)',
    'box-shadow': 'var(--ds-elevation-low)',
  },
  duration: durations.fast,
  curve: curves.ease,
  reducedMotionBehavior: 'instant',
};

export const panelEnter: MicroInteraction = {
  name: 'panel-enter',
  trigger: 'mount',
  properties: {
    opacity: '1',
    transform: 'translateY(0)',
  },
  duration: durations.med,
  curve: curves.easeOut,
  reducedMotionBehavior: 'skip',
};

export const panelExit: MicroInteraction = {
  name: 'panel-exit',
  trigger: 'unmount',
  properties: {
    opacity: '0',
    transform: 'translateY(8px)',
  },
  duration: durations.fast,
  curve: curves.easeIn,
  reducedMotionBehavior: 'skip',
};

export const allInteractions: MicroInteraction[] = [
  buttonHover,
  buttonPress,
  panelEnter,
  panelExit,
];

export function generateInteractionCSS(
  interaction: MicroInteraction,
  reducedMotion: boolean,
): string {
  if (reducedMotion && interaction.reducedMotionBehavior === 'skip') {
    return `/* ${interaction.name}: skipped under reduced motion */`;
  }
  const dur = reducedMotion ? '0ms' : interaction.duration.cssValue;
  const curveVal = interaction.curve.cssValue;
  const props = Object.entries(interaction.properties)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `/* ${interaction.name} */\n${props}\n  transition: all ${dur} ${curveVal};`;
}

// ── Ambient animation driver ──────────────────────────────────

export type AmbientPhase = 'idle' | 'pulse' | 'glow' | 'rest';

export interface AmbientState {
  phase: AmbientPhase;
  tick: number;
  enabled: boolean;
}

const PHASE_SEQUENCE: readonly AmbientPhase[] = ['idle', 'pulse', 'glow', 'rest'];
const PHASE_TICKS: Record<AmbientPhase, number> = {
  idle: 60,
  pulse: 20,
  glow: 30,
  rest: 40,
};

export function createAmbientState(): AmbientState {
  return { phase: 'idle', tick: 0, enabled: true };
}

export function advanceAmbient(state: AmbientState, reducedMotion: boolean): AmbientState {
  if (!state.enabled || reducedMotion) {
    return { phase: 'idle', tick: 0, enabled: state.enabled };
  }
  const maxTick = PHASE_TICKS[state.phase];
  if (state.tick + 1 >= maxTick) {
    const idx = PHASE_SEQUENCE.indexOf(state.phase);
    const nextPhase = PHASE_SEQUENCE[(idx + 1) % PHASE_SEQUENCE.length];
    return { phase: nextPhase, tick: 0, enabled: true };
  }
  return { phase: state.phase, tick: state.tick + 1, enabled: true };
}

export function getAmbientCSSForPhase(phase: AmbientPhase): Record<string, string> {
  switch (phase) {
    case 'idle':
      return { opacity: '1', filter: 'none' };
    case 'pulse':
      return { opacity: '0.95', filter: 'brightness(1.05)' };
    case 'glow':
      return { opacity: '1', filter: 'brightness(1.1) saturate(1.1)' };
    case 'rest':
      return { opacity: '0.98', filter: 'brightness(1.02)' };
  }
}

export function generateAmbientKeyframesCSS(): string {
  let css = '@keyframes ds-ambient-pulse {\n';
  css += '  0%, 100% { opacity: 1; filter: none; }\n';
  css += '  25% { opacity: 0.95; filter: brightness(1.05); }\n';
  css += '  50% { opacity: 1; filter: brightness(1.1) saturate(1.1); }\n';
  css += '  75% { opacity: 0.98; filter: brightness(1.02); }\n';
  css += '}\n\n';
  css += '.ds-ambient {\n';
  css += '  animation: ds-ambient-pulse var(--ds-motion-ambient) var(--ds-motion-ease) infinite;\n';
  css += '}\n\n';
  css += '@media (prefers-reduced-motion: reduce) {\n';
  css += '  .ds-ambient {\n';
  css += '    animation: none;\n';
  css += '  }\n}';
  return css;
}
