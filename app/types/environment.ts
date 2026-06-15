export type EnvironmentId =
  | 'none'
  | 'temple-dawn'
  | 'forest-shafts'
  | 'candle-altar'
  | 'mist-mandala'
  | 'cosmic-bokeh';

export type EnvironmentOverride = EnvironmentId | 'auto';

export interface Environment {
  id: EnvironmentId;
  label: string;
  emoji: string;
  /** Static asset under public/backgrounds/ */
  imageSrc?: string;
  /** CSS gradient fallback when no image */
  gradientCss?: string;
  /** Photo layer opacity (0.3–0.7) */
  opacity: number;
  /** Blend mode applied to the photo layer */
  blendMode: 'normal' | 'multiply' | 'soft-light' | 'overlay';
  /** Gentle Ken Burns drift */
  kenBurns?: boolean;
  /** Tint overlay follows theme (0=Cosmic, 1=Golden, 2=Ocean, 3=…) */
  tintByTheme?: boolean;
  /** Tint overlay follows breath chakra phase */
  tintByChakra?: boolean;
}
