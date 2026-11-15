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

/**
 * `struct Uniforms` + its group-0 binding, generated from `UNIFORM_FIELDS`, for
 * WGSL that lives in TypeScript (the geometry overlay). Public `.wgsl` scenes
 * keep their hand-written struct, which `npm run validate:shaders` checks.
 */
export const buildUniformsWgsl = (): string =>
  `struct Uniforms {\n${UNIFORM_FIELDS.map((field) => `    ${field.name}: ${field.type},`).join('\n')}\n}\n\n` +
  '@group(0) @binding(0) var<uniform> u: Uniforms;\n';

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

// ---------------------------------------------------------------------------
// Group 1: breath-field storage / post structs.
//
// Group 0 stays the 72-byte `Uniforms` above. Group 1 belongs to whichever
// pass is bound (particle sim, particle draw, bloom/tonemap); the structs that
// cross the CPU/GPU boundary or are shared between modules are declared here
// by name and type only. Offsets, alignment and size are *derived* with the
// WGSL layout rules, never written by hand, and `npm run validate:shaders`
// checks that every field module declares them identically.
// ---------------------------------------------------------------------------

export type StorageFieldType = 'f32' | 'u32' | 'atomic<u32>' | 'vec2<f32>' | 'vec4<f32>';

export interface StorageStructField {
  name: string;
  type: StorageFieldType;
  description?: string;
}

export interface StructLayout {
  fields: Array<StorageStructField & { offset: number; size: number; align: number }>;
  /** WGSL `AlignOf(S)`: max member alignment. */
  align: number;
  /** WGSL `SizeOf(S)`: last member end rounded up to `align` — the array stride. */
  size: number;
}

const STORAGE_TYPE_LAYOUT: Record<StorageFieldType, { size: number; align: number }> = {
  f32: { size: 4, align: 4 },
  u32: { size: 4, align: 4 },
  'atomic<u32>': { size: 4, align: 4 },
  'vec2<f32>': { size: 8, align: 8 },
  'vec4<f32>': { size: 16, align: 16 },
};

const roundUp = (value: number, align: number): number => Math.ceil(value / align) * align;

/** Lay out a struct with WGSL's default (non-`@size`/`@align`) rules. */
export function layoutStruct(fields: readonly StorageStructField[]): StructLayout {
  let offset = 0;
  let align = 1;
  const laidOut = fields.map((field) => {
    const { size, align: fieldAlign } = STORAGE_TYPE_LAYOUT[field.type];
    offset = roundUp(offset, fieldAlign);
    const entry = { ...field, offset, size, align: fieldAlign };
    offset += size;
    align = Math.max(align, fieldAlign);
    return entry;
  });
  return { fields: laidOut, align, size: roundUp(offset, align) };
}

/** One particle of the breath field (storage, ping-ponged A→B every frame). */
export const PARTICLE_FIELDS = [
  { name: 'pos', type: 'vec2<f32>', description: 'position in pointer space: x ∈ ±aspect/2, y ∈ ±0.5, y down' },
  { name: 'vel', type: 'vec2<f32>', description: 'velocity, pointer-space units per second' },
  { name: 'life', type: 'f32', description: '1 at spawn → 0 at respawn' },
  { name: 'seed', type: 'u32', description: 'per-particle hash seed, rewritten on respawn' },
] as const satisfies readonly StorageStructField[];

/** Per-frame sim parameters (uniform, group 1 binding 0 of the sim pass). */
export const FIELD_PARAMS_FIELDS = [
  { name: 'dt', type: 'f32', description: 'clamped frame delta, seconds' },
  { name: 'count', type: 'u32', description: 'live particle count for this governor tier' },
  { name: 'frame', type: 'u32', description: 'frame counter for respawn hashing' },
  { name: 'pointerRadius', type: 'f32', description: 'radius of pointer/touch influence, pointer-space units' },
] as const satisfies readonly StorageStructField[];

/** `drawIndirect` arguments, written by the cull dispatch. */
export const DRAW_ARGS_FIELDS = [
  { name: 'vertexCount', type: 'u32' },
  { name: 'instanceCount', type: 'atomic<u32>' },
  { name: 'firstVertex', type: 'u32' },
  { name: 'firstInstance', type: 'u32' },
] as const satisfies readonly StorageStructField[];

/** WGSL for a contract struct (field modules keep a hand-written copy the validator compares). */
export const buildStructWgsl = (name: string, fields: readonly StorageStructField[]): string =>
  `struct ${name} {\n${fields.map((field) => `    ${field.name}: ${field.type},`).join('\n')}\n}\n`;

/** Every group-1 struct the validator holds field modules to, by WGSL name. */
export const GROUP1_STRUCTS = {
  Particle: PARTICLE_FIELDS,
  FieldParams: FIELD_PARAMS_FIELDS,
  DrawArgs: DRAW_ARGS_FIELDS,
} as const satisfies Record<string, readonly StorageStructField[]>;

export const PARTICLE_LAYOUT = layoutStruct(PARTICLE_FIELDS);
export const FIELD_PARAMS_LAYOUT = layoutStruct(FIELD_PARAMS_FIELDS);
export const DRAW_ARGS_LAYOUT = layoutStruct(DRAW_ARGS_FIELDS);

/** Bytes per particle; the array stride of `array<Particle>`. */
export const PARTICLE_STRIDE = PARTICLE_LAYOUT.size;
/** Vertices per particle billboard (two triangles, no vertex buffer). */
export const PARTICLE_VERTEX_COUNT = 6;

/** Pack `FieldParams` for `queue.writeBuffer`, honouring the derived offsets. */
export type FieldParamsValues = Record<(typeof FIELD_PARAMS_FIELDS)[number]['name'], number>;

export function buildFieldParams(values: FieldParamsValues): ArrayBuffer {
  const buffer = new ArrayBuffer(FIELD_PARAMS_LAYOUT.size);
  const view = new DataView(buffer);
  for (const field of FIELD_PARAMS_LAYOUT.fields) {
    const value = values[field.name as keyof FieldParamsValues];
    if (field.type === 'u32') view.setUint32(field.offset, value >>> 0, true);
    else view.setFloat32(field.offset, value, true);
  }
  return buffer;
}

/** Initial `DrawArgs`: six vertices per billboard, zero instances until the cull pass counts them. */
export function buildDrawArgsReset(): Uint32Array {
  const words = new Uint32Array(DRAW_ARGS_LAYOUT.size / 4);
  const vertexCount = DRAW_ARGS_LAYOUT.fields.find((field) => field.name === 'vertexCount');
  if (vertexCount) words[vertexCount.offset / 4] = PARTICLE_VERTEX_COUNT;
  return words;
}
