/**
 * S13 — Design System Token Definitions + Theme Engine
 *
 * Semantic design tokens as CSS custom properties.
 * Three themes: operator (default), stealth, daylight.
 * Theme transitions respect prefers-reduced-motion.
 * Session-only state (no persistence keys).
 */

// ── Token schema ──────────────────────────────────────────────

export interface SemanticTokens {
  accent: string;
  accentMuted: string;
  glow: string;
  glowIntensity: string;
  elevationLow: string;
  elevationMid: string;
  elevationHigh: string;
  blur: string;
  surfacePrimary: string;
  surfaceSecondary: string;
  surfaceTertiary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderFocus: string;
  danger: string;
  success: string;
  warning: string;
}

export type ThemeId = 'operator' | 'stealth' | 'daylight';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  tokens: SemanticTokens;
}

// ── Theme presets ──────────────────────────────────────────────

const operatorTokens: SemanticTokens = {
  accent: '#00e5ff',
  accentMuted: 'rgba(0, 229, 255, 0.25)',
  glow: 'rgba(0, 229, 255, 0.35)',
  glowIntensity: '0.35',
  elevationLow: '0 1px 3px rgba(0, 0, 0, 0.5)',
  elevationMid: '0 4px 12px rgba(0, 0, 0, 0.6)',
  elevationHigh: '0 8px 24px rgba(0, 0, 0, 0.7)',
  blur: '12px',
  surfacePrimary: '#0a0e14',
  surfaceSecondary: '#111820',
  surfaceTertiary: '#1a2230',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textMuted: '#484f58',
  border: 'rgba(255, 255, 255, 0.08)',
  borderFocus: '#00e5ff',
  danger: '#ff4d6a',
  success: '#3fb950',
  warning: '#d29922',
};

const stealthTokens: SemanticTokens = {
  accent: '#7c3aed',
  accentMuted: 'rgba(124, 58, 237, 0.25)',
  glow: 'rgba(124, 58, 237, 0.3)',
  glowIntensity: '0.3',
  elevationLow: '0 1px 3px rgba(0, 0, 0, 0.7)',
  elevationMid: '0 4px 12px rgba(0, 0, 0, 0.8)',
  elevationHigh: '0 8px 24px rgba(0, 0, 0, 0.9)',
  blur: '16px',
  surfacePrimary: '#05050a',
  surfaceSecondary: '#0c0c14',
  surfaceTertiary: '#14141e',
  textPrimary: '#c8cdd3',
  textSecondary: '#6e7681',
  textMuted: '#3a3f47',
  border: 'rgba(255, 255, 255, 0.05)',
  borderFocus: '#7c3aed',
  danger: '#e5534b',
  success: '#2ea043',
  warning: '#bb8009',
};

const daylightTokens: SemanticTokens = {
  accent: '#0969da',
  accentMuted: 'rgba(9, 105, 218, 0.15)',
  glow: 'rgba(9, 105, 218, 0.2)',
  glowIntensity: '0.2',
  elevationLow: '0 1px 3px rgba(0, 0, 0, 0.08)',
  elevationMid: '0 4px 12px rgba(0, 0, 0, 0.12)',
  elevationHigh: '0 8px 24px rgba(0, 0, 0, 0.16)',
  blur: '8px',
  surfacePrimary: '#ffffff',
  surfaceSecondary: '#f6f8fa',
  surfaceTertiary: '#eaeef2',
  textPrimary: '#1f2328',
  textSecondary: '#656d76',
  textMuted: '#8c959f',
  border: 'rgba(0, 0, 0, 0.1)',
  borderFocus: '#0969da',
  danger: '#cf222e',
  success: '#1a7f37',
  warning: '#9a6700',
};

export const themes: Record<ThemeId, ThemeDefinition> = {
  operator: { id: 'operator', label: 'Operator', tokens: operatorTokens },
  stealth: { id: 'stealth', label: 'Stealth', tokens: stealthTokens },
  daylight: { id: 'daylight', label: 'Daylight', tokens: daylightTokens },
};

export const THEME_IDS: readonly ThemeId[] = ['operator', 'stealth', 'daylight'] as const;
export const DEFAULT_THEME: ThemeId = 'operator';

// ── CSS generation ────────────────────────────────────────────

const TOKEN_TO_CSS: Record<keyof SemanticTokens, string> = {
  accent: '--ds-accent',
  accentMuted: '--ds-accent-muted',
  glow: '--ds-glow',
  glowIntensity: '--ds-glow-intensity',
  elevationLow: '--ds-elevation-low',
  elevationMid: '--ds-elevation-mid',
  elevationHigh: '--ds-elevation-high',
  blur: '--ds-blur',
  surfacePrimary: '--ds-surface-primary',
  surfaceSecondary: '--ds-surface-secondary',
  surfaceTertiary: '--ds-surface-tertiary',
  textPrimary: '--ds-text-primary',
  textSecondary: '--ds-text-secondary',
  textMuted: '--ds-text-muted',
  border: '--ds-border',
  borderFocus: '--ds-border-focus',
  danger: '--ds-danger',
  success: '--ds-success',
  warning: '--ds-warning',
};

export function tokensToCSSProperties(t: SemanticTokens): string {
  const lines: string[] = [];
  for (const [key, cssVar] of Object.entries(TOKEN_TO_CSS)) {
    lines.push(`  ${cssVar}: ${t[key as keyof SemanticTokens]};`);
  }
  return lines.join('\n');
}

export function generateThemeCSS(themeId: ThemeId): string {
  const def = themes[themeId];
  if (!def) throw new Error(`Unknown theme: ${themeId}`);
  return `:root[data-theme="${themeId}"] {\n${tokensToCSSProperties(def.tokens)}\n}`;
}

export function generateAllThemesCSS(): string {
  const blocks = THEME_IDS.map((id) => generateThemeCSS(id));
  return blocks.join('\n\n');
}

export function generateTransitionCSS(reducedMotion: boolean): string {
  const duration = reducedMotion ? '0s' : '0.25s';
  const timing = reducedMotion ? 'linear' : 'cubic-bezier(0.4, 0, 0.2, 1)';
  const properties = Object.values(TOKEN_TO_CSS).map((v) => v).join(', ');

  let css = `:root {\n  transition-property: ${properties};\n`;
  css += `  transition-duration: ${duration};\n`;
  css += `  transition-timing-function: ${timing};\n}\n`;

  css += `\n@media (prefers-reduced-motion: reduce) {\n`;
  css += `  :root {\n    transition-duration: 0s;\n    transition-timing-function: linear;\n  }\n}`;
  return css;
}

// ── Theme engine (session-only state) ────────────────────────

let activeTheme: ThemeId = DEFAULT_THEME;

export function getActiveTheme(): ThemeId {
  return activeTheme;
}

export function setActiveTheme(id: ThemeId): ThemeDefinition {
  if (!themes[id]) throw new Error(`Unknown theme: ${id}`);
  activeTheme = id;
  return themes[id];
}

export function resetThemeEngine(): void {
  activeTheme = DEFAULT_THEME;
}

export function getTokenValue(key: keyof SemanticTokens): string {
  return themes[activeTheme].tokens[key];
}

export function getCSSVariableName(key: keyof SemanticTokens): string {
  return TOKEN_TO_CSS[key];
}

export function getAllCSSVariableNames(): Record<keyof SemanticTokens, string> {
  return { ...TOKEN_TO_CSS };
}
