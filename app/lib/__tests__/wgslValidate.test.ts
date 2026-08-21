import { describe, expect, it } from 'vitest';
import {
  findDuplicateDeclarations,
  findEntryPointNames,
  findFloatModulo,
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
});
