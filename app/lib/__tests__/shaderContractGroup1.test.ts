import { describe, expect, it } from 'vitest';
import {
  buildDrawArgsReset,
  buildFieldParams,
  buildStructWgsl,
  DRAW_ARGS_LAYOUT,
  FIELD_PARAMS_LAYOUT,
  layoutStruct,
  PARTICLE_FIELDS,
  PARTICLE_LAYOUT,
  PARTICLE_STRIDE,
  PARTICLE_VERTEX_COUNT,
} from '../shaderContract';

describe('group-1 struct layout (derived, not hand offsets)', () => {
  it('lays out Particle with WGSL rules: vec2 align 8, stride rounded to 8', () => {
    expect(PARTICLE_LAYOUT.fields.map((f) => [f.name, f.offset])).toEqual([
      ['pos', 0],
      ['vel', 8],
      ['life', 16],
      ['seed', 20],
    ]);
    expect(PARTICLE_LAYOUT.align).toBe(8);
    expect(PARTICLE_STRIDE).toBe(24);
  });

  it('pads a trailing scalar up to the struct alignment', () => {
    const layout = layoutStruct([
      { name: 'a', type: 'vec2<f32>' },
      { name: 'b', type: 'f32' },
    ]);
    expect(layout.size).toBe(16);
    const vec4 = layoutStruct([
      { name: 'a', type: 'f32' },
      { name: 'b', type: 'vec4<f32>' },
    ]);
    expect(vec4.fields[1]!.offset).toBe(16);
    expect(vec4.size).toBe(32);
  });

  it('keeps FieldParams and DrawArgs at 16 bytes', () => {
    expect(FIELD_PARAMS_LAYOUT.size).toBe(16);
    expect(DRAW_ARGS_LAYOUT.size).toBe(16);
  });

  it('packs FieldParams at the derived offsets with u32 counts', () => {
    const view = new DataView(buildFieldParams({ dt: 0.016, count: 16384, frame: 7, pointerRadius: 0.18 }));
    expect(view.getFloat32(0, true)).toBeCloseTo(0.016);
    expect(view.getUint32(4, true)).toBe(16384);
    expect(view.getUint32(8, true)).toBe(7);
    expect(view.getFloat32(12, true)).toBeCloseTo(0.18);
  });

  it('resets draw args to six vertices and zero instances', () => {
    expect(Array.from(buildDrawArgsReset())).toEqual([PARTICLE_VERTEX_COUNT, 0, 0, 0]);
  });

  it('generates the WGSL struct the field modules must match', () => {
    expect(buildStructWgsl('Particle', PARTICLE_FIELDS)).toBe(
      'struct Particle {\n    pos: vec2<f32>,\n    vel: vec2<f32>,\n    life: f32,\n    seed: u32,\n}\n',
    );
  });
});
