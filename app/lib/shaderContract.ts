/** Single source of truth for the WebGPU/WebGL2 uniform layout. */
export type UniformFieldType = 'f32' | 'vec2<f32>';

export interface UniformField {
  name: string;
  type: UniformFieldType;
  size: number; // bytes
  align: number; // bytes
  offset: number; // byte offset in buffer
  default: number | [number, number];
  description?: string;
}

/**
 * 72-byte Uniforms struct shared by all active WGSL shaders.
 * Alignment follows WGSL defaults (4 bytes for scalar, 8 bytes for vec2).
 * When adding a field, update this array, then run `npm run validate:shaders`
 * to ensure every WGSL file matches the new layout.
 */
export const UNIFORM_FIELDS = [
  { name: 'time', type: 'f32', size: 4, align: 4, offset: 0, default: 0, description: 'elapsed time in seconds' },
  { name: 'breathPhase', type: 'f32', size: 4, align: 4, offset: 4, default: 0, description: '0..1 full cycle progress' },
  { name: 'intensity', type: 'f32', size: 4, align: 4, offset: 8, default: 1, description: 'visual intensity' },
  { name: 'chakraPhase', type: 'f32', size: 4, align: 4, offset: 12, default: 0, description: '0..3 mapped to phase' },
  { name: 'theme', type: 'f32', size: 4, align: 4, offset: 16, default: 0, description: '0=Cosmic, 1=Golden, 2=Ocean' },
  { name: 'mandalaStyle', type: 'f32', size: 4, align: 4, offset: 20, default: 0, description: '0=Lotus, 1=Yantra, 2=Flower' },
  { name: 'phaseProgress', type: 'f32', size: 4, align: 4, offset: 24, default: 0, description: '0..1 progress within current phase' },
  { name: 'strengthLevel', type: 'f32', size: 4, align: 4, offset: 28, default: 1, description: '0.0=light, 1.0=regular, 2.0=strong' },
  { name: 'mouse', type: 'vec2<f32>', size: 8, align: 8, offset: 32, default: [-2, -2], description: 'pointer position in -1..1 or (-2,-2) when inactive' },
  { name: 'mouseStrength', type: 'f32', size: 4, align: 4, offset: 40, default: 0, description: '0..1 touch strength' },
  { name: 'chakraFocus', type: 'f32', size: 4, align: 4, offset: 44, default: -1, description: '-1=none, 0..6=root..crown' },
  { name: 'resolution', type: 'vec2<f32>', size: 8, align: 8, offset: 48, default: [0, 0], description: 'canvas size in pixels' },
  { name: 'geometryDensity', type: 'f32', size: 4, align: 4, offset: 56, default: 1, description: 'geometry detail multiplier' },
  { name: 'interference', type: 'f32', size: 4, align: 4, offset: 60, default: 0.5, description: 'moire/recursive motion strength' },
  { name: 'figurePose', type: 'f32', size: 4, align: 4, offset: 64, default: 0, description: '0=lotus, 1=tadasana, 2=tai-chi, 3=heart-open, 4=chinmudra, 5=warrior, 6=tree' },
  { name: 'qualityPreset', type: 'f32', size: 4, align: 4, offset: 68, default: 1, description: '0.0=mobile, 1.0=high' },
] as const satisfies UniformField[];

export const UNIFORM_BUFFER_SIZE = 72;

export type UniformValues = {
  [K in (typeof UNIFORM_FIELDS)[number]['name']]: K extends 'mouse' | 'resolution'
    ? { x: number; y: number }
    : number;
};

export const DEFAULT_UNIFORM_VALUES: UniformValues = {
  time: 0,
  breathPhase: 0,
  intensity: 1,
  chakraPhase: 0,
  theme: 0,
  mandalaStyle: 0,
  phaseProgress: 0,
  strengthLevel: 1,
  mouse: { x: -2, y: -2 },
  mouseStrength: 0,
  chakraFocus: -1,
  resolution: { x: 0, y: 0 },
  geometryDensity: 1,
  interference: 0.5,
  figurePose: 0,
  qualityPreset: 1,
};

/** Build a 72-byte Float32Array from partial uniform values, filling defaults. */
export const buildUniformBuffer = (values: Partial<UniformValues>): Float32Array => {
  const arr: Float32Array = new Float32Array(UNIFORM_BUFFER_SIZE / 4);
  for (const field of UNIFORM_FIELDS) {
    const v = values[field.name] ?? field.default;
    if (field.type === 'vec2<f32>') {
      let vec: { x: number; y: number };
      if (typeof v === 'number') {
        vec = { x: v, y: v };
      } else if (Array.isArray(v)) {
        vec = { x: v[0], y: v[1] };
      } else {
        vec = v as { x: number; y: number };
      }
      arr[field.offset / 4] = vec.x;
      arr[field.offset / 4 + 1] = vec.y;
    } else {
      arr[field.offset / 4] = v as number;
    }
  }
  return arr;
};

/** GLSL uniform name mapping for the WebGL2 main fallback shader. */
export const WEBGL_MAIN_UNIFORM_MAP: Record<string, string> = {
  time: 'uTime',
  breathPhase: 'uBreathPhase',
  intensity: 'uIntensity',
  chakraPhase: 'uChakraPhase',
  theme: 'uTheme',
  mandalaStyle: 'uMandalaStyle',
  phaseProgress: 'uPhaseProgress',
  strengthLevel: 'uStrengthLevel',
  mouse: 'uMouse',
  mouseStrength: 'uMouseStrength',
  chakraFocus: 'uChakraFocus',
  geometryDensity: 'uGeometryDensity',
  interference: 'uInterference',
  resolution: 'uResolution',
};

/** GLSL uniform name mapping for the WebGL2 overlay shader. */
export const WEBGL_OVERLAY_UNIFORM_MAP: Record<string, string> = {
  time: 'uTime',
  breathPhase: 'uBreathPhase',
  phaseProgress: 'uPhaseProgress',
  chakraPhase: 'uChakraPhase',
  intensity: 'uIntensity',
  interference: 'uInterference',
  geometryDensity: 'uGeometryDensity',
  qualityPreset: 'uQualityPreset',
  theme: 'uTheme',
  resolution: 'uResolution',
};
