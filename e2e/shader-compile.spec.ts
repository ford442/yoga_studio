import { test, expect } from '@playwright/test';

const SHADERS: Array<{ path: string; vertex: string; fragment: string }> = [
  { path: '/sacred-monk.wgsl', vertex: 'vs', fragment: 'main' },
  { path: '/sacred-lotus-final.wgsl', vertex: 'vs', fragment: 'main' },
  { path: '/sacred-ultra.wgsl', vertex: 'vs', fragment: 'main' },
  { path: '/yoga-regular.wgsl', vertex: 'vs_main', fragment: 'fs_main' },
];

test('WebGPU compiles every active shader without grammar or context errors', async ({ page }) => {
  await page.goto('/');
  const report = await page.evaluate(async (shaders) => {
    const gpu = navigator.gpu;
    if (!gpu) return { skipped: true as const, results: [] };

    const includeRe = /^[ \t]*\/\/[ \t]*@include[ \t]+"([^"\r\n]+)"[ \t]*(?:\r?\n|$)/gm;
    async function compose(url: string, ancestors: string[] = []): Promise<string> {
      if (ancestors.includes(url)) throw new Error(`circular ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url} ${response.status}`);
      const source = await response.text();
      const canonical = response.url || url;
      const parts: string[] = [];
      let cursor = 0;
      includeRe.lastIndex = 0;
      for (let match = includeRe.exec(source); match; match = includeRe.exec(source)) {
        if (match.index > cursor) parts.push(source.slice(cursor, match.index));
        const child = new URL(match[1], canonical).toString();
        parts.push(await compose(child, [...ancestors, canonical]));
        cursor = match.index + match[0].length;
      }
      parts.push(source.slice(cursor));
      return parts.join('');
    }

    const adapter = await gpu.requestAdapter();
    if (!adapter) return { skipped: true as const, results: [] };
    const device = await adapter.requestDevice();
    const results: Array<{ path: string; errors: string[] }> = [];
    for (const shader of shaders) {
      const code = await compose(new URL(shader.path, location.href).toString());
      const module = device.createShaderModule({ code });
      const info = await module.getCompilationInfo();
      const errors = info.messages
        .filter((message) => message.type === 'error')
        .map((message) => `${message.lineNum}:${message.linePos} ${message.message}`);
      try {
        device.createRenderPipeline({
          layout: 'auto',
          vertex: { module, entryPoint: shader.vertex },
          fragment: {
            module,
            entryPoint: shader.fragment,
            targets: [{ format: gpu.getPreferredCanvasFormat() }],
          },
          primitive: { topology: 'triangle-list' },
        });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      results.push({ path: shader.path, errors });
    }
    device.destroy();
    return { skipped: false as const, results };
  }, SHADERS);

  if (report.skipped) {
    test.skip(true, 'WebGPU adapter not available in this browser');
  }

  for (const result of report.results) {
    expect(result.errors, `${result.path} WGSL errors:\n${result.errors.join('\n')}`).toEqual([]);
  }
});
