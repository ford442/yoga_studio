import { describe, expect, it } from 'vitest';
import {
  findDuplicateDeclarations,
  findEntryPointNames,
  findFloatModulo,
  findFullscreenQuads,
  findIncrementOperators,
  findU32ArrayIndexes,
  findUnparenthesizedIf,
} from '../wgslValidate';

describe('wgslValidate', () => {
  it('flags duplicate function names after compose', () => {
    expect(findDuplicateDeclarations('fn rot2() {}\nfn rot2() {}\n')).toEqual([
      "redefinition of 'rot2' (fn then fn)",
    ]);
  });

  it('reads vertex and fragment entry points', () => {
    expect(
      findEntryPointNames('@vertex\nfn vs() {}\n@fragment\nfn main() {}\n'),
    ).toEqual({ vertex: ['vs'], fragment: ['main'] });
  });

  it('flags postfix increment and float remainder', () => {
    expect(findIncrementOperators('for (var i = 0; i < 3; i++) {}')).toHaveLength(1);
    expect(findFloatModulo('let x = uv.x % 1.0;')).toHaveLength(1);
    expect(findFloatModulo('let ones = cycleInt % 10;')).toHaveLength(0);
  });

  it('flags u32 array indexes and unparenthesized if', () => {
    expect(findU32ArrayIndexes('return CHAKRA[u32(i)];')).toHaveLength(1);
    expect(findUnparenthesizedIf('fn f() { if length(p) > 1.0 { return; } }')).toHaveLength(1);
    expect(findUnparenthesizedIf('fn f() { if (length(p) > 1.0) { return; } }')).toHaveLength(0);
  });

  it('flags a 6-vertex fullscreen quad but not a triangle or fragment-side arrays', () => {
    const quad = `@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>, 6>(vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0));
    return vec4<f32>(pos[i], 0.0, 1.0);
}`;
    expect(findFullscreenQuads(quad)).toEqual([
      "vertex 'vs' builds a 6-vertex position array; use a 3-vertex fullscreen triangle",
    ]);
    const triangle = `@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4<f32> {
    let pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
    return vec4<f32>(pos[i], 0.0, 1.0);
}
fn hexagon() -> f32 { let corners = array<vec2<f32>, 6>(); return 0.0; }`;
    expect(findFullscreenQuads(triangle)).toEqual([]);
  });
});
