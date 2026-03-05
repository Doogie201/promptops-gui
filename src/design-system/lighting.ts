/**
 * S13 — Dynamic Lighting & Shadow System
 *
 * GPU-friendly shadow layers using opacity/transform/blur.
 * Operator console glow system as tokenized layer.
 */

// ── Shadow layer definitions ──────────────────────────────────

export interface ShadowLayer {
  name: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
}

export interface ShadowPreset {
  name: string;
  layers: ShadowLayer[];
}

export const shadowPresets: Record<string, ShadowPreset> = {
  flat: {
    name: 'flat',
    layers: [],
  },
  subtle: {
    name: 'subtle',
    layers: [
      { name: 'base', offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: '0,0,0', opacity: 0.05 },
    ],
  },
  elevated: {
    name: 'elevated',
    layers: [
      { name: 'near', offsetX: 0, offsetY: 2, blur: 4, spread: 0, color: '0,0,0', opacity: 0.1 },
      { name: 'far', offsetX: 0, offsetY: 8, blur: 16, spread: 0, color: '0,0,0', opacity: 0.15 },
    ],
  },
  floating: {
    name: 'floating',
    layers: [
      { name: 'near', offsetX: 0, offsetY: 4, blur: 8, spread: 0, color: '0,0,0', opacity: 0.12 },
      { name: 'mid', offsetX: 0, offsetY: 12, blur: 24, spread: 0, color: '0,0,0', opacity: 0.18 },
      { name: 'ambient', offsetX: 0, offsetY: 0, blur: 48, spread: 0, color: '0,0,0', opacity: 0.08 },
    ],
  },
};

export function shadowLayerToCSS(layer: ShadowLayer): string {
  return `${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.spread}px rgba(${layer.color}, ${layer.opacity})`;
}

export function shadowPresetToCSS(preset: ShadowPreset): string {
  if (preset.layers.length === 0) return 'none';
  return preset.layers.map(shadowLayerToCSS).join(', ');
}

export function generateShadowTokensCSS(): string {
  let css = ':root {\n';
  for (const [key, preset] of Object.entries(shadowPresets)) {
    css += `  --ds-shadow-${key}: ${shadowPresetToCSS(preset)};\n`;
  }
  css += '}';
  return css;
}

// ── Operator console glow system ──────────────────────────────

export interface GlowConfig {
  color: string;
  intensity: number;
  radius: number;
  spread: number;
}

export const glowPresets: Record<string, GlowConfig> = {
  accent: { color: 'var(--ds-accent)', intensity: 0.3, radius: 20, spread: 0 },
  success: { color: 'var(--ds-success)', intensity: 0.25, radius: 16, spread: 0 },
  danger: { color: 'var(--ds-danger)', intensity: 0.35, radius: 24, spread: 0 },
  warning: { color: 'var(--ds-warning)', intensity: 0.2, radius: 12, spread: 0 },
  muted: { color: 'var(--ds-accent-muted)', intensity: 0.15, radius: 8, spread: 0 },
};

export function glowToCSS(glow: GlowConfig): string {
  return `0 0 ${glow.radius}px ${glow.spread}px ${glow.color}`;
}

export function glowToFilterCSS(glow: GlowConfig): string {
  return `drop-shadow(0 0 ${glow.radius}px ${glow.color})`;
}

export function generateGlowTokensCSS(): string {
  let css = ':root {\n';
  for (const [key, glow] of Object.entries(glowPresets)) {
    css += `  --ds-glow-${key}: ${glowToCSS(glow)};\n`;
    css += `  --ds-glow-${key}-filter: ${glowToFilterCSS(glow)};\n`;
  }
  css += '}';
  return css;
}

// ── Dynamic shadow computation ────────────────────────────────

export function computeDynamicShadow(
  basePreset: ShadowPreset,
  depthMultiplier: number,
): string {
  const clamped = Math.max(0, Math.min(depthMultiplier, 3));
  if (basePreset.layers.length === 0) return 'none';
  const scaled = basePreset.layers.map((layer) => ({
    ...layer,
    blur: Math.round(layer.blur * clamped),
    offsetY: Math.round(layer.offsetY * clamped),
    opacity: Math.min(layer.opacity * clamped, 0.6),
  }));
  return scaled.map(shadowLayerToCSS).join(', ');
}

export function generateAllLightingCSS(): string {
  return [generateShadowTokensCSS(), '', generateGlowTokensCSS()].join('\n');
}
