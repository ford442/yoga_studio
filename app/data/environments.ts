import type { Environment, EnvironmentId } from '../types/environment';

// Photographic-style atmospheric plates. All are original, self-generated
// artwork (CC0) produced by assets/backgrounds/generate.py — see
// public/backgrounds/manifest.json for credits, luminance and responsive
// sources. `imageSrc` points at the landscape jpg fallback; the renderer
// derives the avif/webp siblings by swapping the extension.
export const ENVIRONMENTS: Environment[] = [
  {
    id: 'none',
    label: 'Cosmic Void',
    emoji: '🌌',
    opacity: 0,
    blendMode: 'normal',
  },
  {
    id: 'zendo-dawn',
    label: 'Zendo Dawn',
    emoji: '🪧',
    imageSrc: 'backgrounds/zendo-dawn-16x9.jpg',
    opacity: 0.5,
    blendMode: 'soft-light',
    kenBurns: true,
    tintByTheme: true,
    averageLuminance: 0.1041,
  },
  {
    id: 'temple-dawn',
    label: 'Temple Dawn',
    emoji: '🛕',
    imageSrc: 'backgrounds/temple-dawn-16x9.jpg',
    opacity: 0.52,
    blendMode: 'multiply',
    kenBurns: true,
    tintByTheme: true,
    averageLuminance: 0.1326,
  },
  {
    id: 'forest-shafts',
    label: 'Forest Light',
    emoji: '🌲',
    imageSrc: 'backgrounds/forest-shafts-16x9.jpg',
    opacity: 0.48,
    blendMode: 'multiply',
    kenBurns: true,
    tintByChakra: true,
    averageLuminance: 0.1249,
  },
  {
    id: 'candle-altar',
    label: 'Candle Altar',
    emoji: '🕯️',
    imageSrc: 'backgrounds/candle-altar-16x9.jpg',
    opacity: 0.55,
    blendMode: 'soft-light',
    kenBurns: true,
    tintByTheme: true,
    averageLuminance: 0.065,
  },
  {
    id: 'mist-mandala',
    label: 'Mist Mandala',
    emoji: '☁️',
    imageSrc: 'backgrounds/mist-mandala-16x9.jpg',
    opacity: 0.45,
    blendMode: 'soft-light',
    kenBurns: true,
    tintByChakra: true,
    averageLuminance: 0.0973,
  },
  {
    id: 'cosmic-bokeh',
    label: 'Cosmic Bokeh',
    emoji: '✨',
    imageSrc: 'backgrounds/cosmic-bokeh-16x9.jpg',
    opacity: 0.42,
    blendMode: 'overlay',
    kenBurns: true,
    tintByTheme: true,
    tintByChakra: true,
    averageLuminance: 0.0664,
  },
  {
    id: 'lotus-water',
    label: 'Lotus Water',
    emoji: '🪷',
    imageSrc: 'backgrounds/lotus-water-16x9.jpg',
    opacity: 0.5,
    blendMode: 'soft-light',
    kenBurns: true,
    tintByChakra: true,
    averageLuminance: 0.1552,
  },
  {
    id: 'stone-wabi',
    label: 'Stone & Wood',
    emoji: '🪵',
    imageSrc: 'backgrounds/stone-wabi-16x9.jpg',
    opacity: 0.5,
    blendMode: 'multiply',
    kenBurns: true,
    tintByTheme: true,
    averageLuminance: 0.214,
  },
  {
    id: 'twilight-sky',
    label: 'Twilight Sky',
    emoji: '🌇',
    imageSrc: 'backgrounds/twilight-sky-16x9.jpg',
    opacity: 0.5,
    blendMode: 'soft-light',
    kenBurns: true,
    tintByTheme: true,
    averageLuminance: 0.2619,
  },
  {
    id: 'void-nearblack',
    label: 'Near-Black Void',
    emoji: '🌑',
    imageSrc: 'backgrounds/void-nearblack-16x9.jpg',
    opacity: 0.6,
    blendMode: 'normal',
    kenBurns: true,
    tintByChakra: true,
    averageLuminance: 0.0438,
  },
  {
    id: 'linen-veil',
    label: 'Linen Veil',
    emoji: '🤍',
    imageSrc: 'backgrounds/linen-veil-16x9.jpg',
    opacity: 0.5,
    blendMode: 'multiply',
    kenBurns: true,
    tintByTheme: true,
    averageLuminance: 0.8119,
  },
];

export const DEFAULT_ENVIRONMENT_ID: EnvironmentId = 'none';

export const ENVIRONMENT_BY_ID = Object.fromEntries(
  ENVIRONMENTS.map((env) => [env.id, env]),
) as Record<EnvironmentId, Environment>;

export const ENVIRONMENT_IDS = ENVIRONMENTS.map((env) => env.id);

export const isEnvironmentId = (value: unknown): value is EnvironmentId =>
  typeof value === 'string' && (ENVIRONMENT_IDS as string[]).includes(value);
