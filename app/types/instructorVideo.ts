export type InstructorLayout = 'pip' | 'underlay';

export type InstructorPipSize = 'sm' | 'md' | 'lg';

export type InstructorPipCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface InstructorVideoSettings {
  enabled: boolean;
  layout: InstructorLayout;
  pipSize: InstructorPipSize;
  pipCorner: InstructorPipCorner;
  /** Pixel offset from the anchored corner after drag */
  pipDragOffset: { x: number; y: number };
  /** Instructor voice / breath audio (separate from chimes & speech guidance) */
  audioEnabled: boolean;
}

export const DEFAULT_INSTRUCTOR_SETTINGS: InstructorVideoSettings = {
  enabled: false,
  layout: 'pip',
  pipSize: 'md',
  pipCorner: 'top-left',
  pipDragOffset: { x: 0, y: 0 },
  audioEnabled: false,
};
