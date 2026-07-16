import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('resolveAssetUrl', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_BASE_PATH;
  });

  it('passes absolute URLs through unchanged', async () => {
    const { resolveAssetUrl } = await import('../resolveAssetUrl');

    expect(resolveAssetUrl('https://example.com/foo.png')).toBe('https://example.com/foo.png');
    expect(resolveAssetUrl('http://example.com/foo.png')).toBe('http://example.com/foo.png');
    expect(resolveAssetUrl('//example.com/foo.png')).toBe('//example.com/foo.png');
    expect(resolveAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('prefixes relative paths with ./ when no base path is set', async () => {
    const { resolveAssetUrl } = await import('../resolveAssetUrl');

    expect(resolveAssetUrl('sacred-monk.wgsl')).toBe('./sacred-monk.wgsl');
    expect(resolveAssetUrl('/sacred-monk.wgsl')).toBe('./sacred-monk.wgsl');
    expect(resolveAssetUrl('backgrounds/zendo-dawn-16x9.avif')).toBe('./backgrounds/zendo-dawn-16x9.avif');
  });

  it('uses NEXT_PUBLIC_BASE_PATH when set', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/yoga';
    vi.resetModules();
    const { resolveAssetUrl } = await import('../resolveAssetUrl');

    expect(resolveAssetUrl('sacred-monk.wgsl')).toBe('/yoga/sacred-monk.wgsl');
    expect(resolveAssetUrl('/sacred-monk.wgsl')).toBe('/yoga/sacred-monk.wgsl');
  });

  it('handles a base path with a trailing slash', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/yoga/';
    vi.resetModules();
    const { resolveAssetUrl } = await import('../resolveAssetUrl');

    expect(resolveAssetUrl('sacred-monk.wgsl')).toBe('/yoga/sacred-monk.wgsl');
  });
});
