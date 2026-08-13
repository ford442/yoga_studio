import { describe, expect, it, vi } from 'vitest';
import { composeWgslModule, loadWgslSource, parseWgslModule } from '../wgslModules';

describe('wgslModules', () => {
  it('parses include directives without consuming ordinary comments', () => {
    expect(parseWgslModule('// heading\n// @include "./core.wgsl"\nfn main() {}\n')).toEqual([
      { kind: 'source', value: '// heading\n' },
      { kind: 'include', value: './core.wgsl' },
      { kind: 'source', value: 'fn main() {}\n' },
    ]);
  });

  it('returns a standalone shader unchanged', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      url: 'https://example.test/app/shader.wgsl',
      text: async () => 'fn main() {}\n',
    })) as unknown as typeof fetch;

    await expect(loadWgslSource('./shader.wgsl', fetcher)).resolves.toBe('fn main() {}\n');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('composes relative modules in declaration order', async () => {
    const sources = new Map([
      ['https://example.test/app/sacred-ultra.wgsl', '// @include "./parts/core.wgsl"\n// @include "./parts/main.wgsl"\n'],
      ['https://example.test/app/parts/core.wgsl', 'const PI: f32 = 3.14;\n'],
      ['https://example.test/app/parts/main.wgsl', '@fragment fn main() {}\n'],
    ]);
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input) === './sacred-ultra.wgsl'
        ? 'https://example.test/app/sacred-ultra.wgsl'
        : String(input);
      return {
        ok: sources.has(url),
        status: sources.has(url) ? 200 : 404,
        url,
        text: async () => sources.get(url) ?? '',
      };
    }) as unknown as typeof fetch;

    await expect(loadWgslSource('./sacred-ultra.wgsl', fetcher)).resolves.toBe(
      'const PI: f32 = 3.14;\n@fragment fn main() {}\n',
    );
  });

  it('rejects circular includes', async () => {
    const sources: Record<string, string> = {
      'root.wgsl': '// @include "./child.wgsl"\n',
      'child.wgsl': '// @include "./root.wgsl"\n',
    };

    await expect(composeWgslModule('root.wgsl', async (path) => ({
      source: sources[path],
      canonicalPath: path,
    }))).rejects.toThrow('Circular WGSL include: root.wgsl -> child.wgsl -> root.wgsl');
  });
});
