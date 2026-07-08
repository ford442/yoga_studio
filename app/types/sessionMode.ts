import type { EnvironmentId } from './environment';
import type { TechniqueMeta } from './technique';

export interface BreathTiming {
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
}

export interface SessionMode {
  id: string;
  label: string;
  emoji: string;
  description: string;
  chakraFocus: string;
  chakraFocusIndex: number; // -1=none, 0..6=root..crown
  accentColor?: string; // Optional UI accent for mode card glow/border
  /** Default photographic environment when override is "auto" */
  backgroundId?: EnvironmentId;
  shaderPath: string;
  vertexEntry: string;
  fragmentEntry: string;
  breath: BreathTiming;
  theme: number;
  mandalaStyle: number;
  /** Figure posture enum. Mirrors the pose values decoded in the active WGSL shaders.
   *  0 = seated lotus (padmasana)
   *  1 = standing tadasana / mountain arms overhead
   *  2 = tai-chi flowing single whip
   *  3 = heart-opening arms-wide
   *  4 = chinmudra seated (wisdom seal)
   *  5 = warrior II (virabhadrasana)
   *  6 = tree pose (vrksasana)
   */
  figurePose: number;
  strengthLevel?: number; // 0.0=light, 1.0=regular (default), 2.0=strong
  geometryDensity?: number; // 0.0=sparse, 1.0=default, 3.0=rich geometry detail
  interference?: number;    // 0.0=still layers, 1.0=strong moire / recursive motion
  qualityPreset?: number;   // 0.0=reduced detail, 1.0=high detail, undefined=renderer auto
  maxDevicePixelRatio?: number; // caps render resolution while preserving CSS size
  /** Educational + guidance metadata for the Techniques Library */
  technique: TechniqueMeta;
}
