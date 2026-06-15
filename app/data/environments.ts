import type { Environment, EnvironmentId } from '../types/environment';

export const ENVIRONMENTS: Environment[] = [
  {
    id: 'none',
    label: 'Cosmic Void',
    emoji: '🌌',
    opacity: 0,
    blendMode: 'normal',
  },
  {
    id: 'temple-dawn',
    label: 'Temple Dawn',
    emoji: '🛕',
    imageSrc: 'backgrounds/temple-dawn.svg',
    opacity: 0.52,
    blendMode: 'multiply',
    kenBurns: true,
    tintByTheme: true,
  },
  {
    id: 'forest-shafts',
    label: 'Forest Light',
    emoji: '🌲',
    imageSrc: 'backgrounds/forest-shafts.svg',
    opacity: 0.48,
    blendMode: 'multiply',
    kenBurns: true,
    tintByChakra: true,
  },
  {
    id: 'candle-altar',
    label: 'Candle Altar',
    emoji: '🕯️',
    imageSrc: 'backgrounds/candle-altar.svg',
    opacity: 0.55,
    blendMode: 'soft-light',
    kenBurns: true,
    tintByTheme: true,
  },
  {
    id: 'mist-mandala',
    label: 'Mist Mandala',
    emoji: '☁️',
    imageSrc: 'backgrounds/mist-mandala.svg',
    opacity: 0.45,
    blendMode: 'soft-light',
    kenBurns: true,
    tintByChakra: true,
  },
  {
    id: 'cosmic-bokeh',
    label: 'Cosmic Bokeh',
    emoji: '✨',
    imageSrc: 'backgrounds/cosmic-bokeh.svg',
    opacity: 0.42,
    blendMode: 'overlay',
    kenBurns: true,
    tintByTheme: true,
    tintByChakra: true,
  },
];

export const DEFAULT_ENVIRONMENT_ID: EnvironmentId = 'none';

export const ENVIRONMENT_BY_ID = Object.fromEntries(
  ENVIRONMENTS.map((env) => [env.id, env]),
) as Record<EnvironmentId, Environment>;
