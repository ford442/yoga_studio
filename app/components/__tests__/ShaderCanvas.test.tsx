import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MountRendererOptions } from '../../renderer/selectBackend';

const mocks = vi.hoisted(() => ({
  mountRenderer: vi.fn((_options: MountRendererOptions) => vi.fn()),
}));

vi.mock('../../renderer/selectBackend', () => ({
  probeCapabilities: () => ({ webgpu: true, webgl2: true }),
  pickInitialMode: () => 'webgpu',
  mountRenderer: mocks.mountRenderer,
}));

import ShaderCanvas from '../ShaderCanvas';

describe('ShaderCanvas', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mocks.mountRenderer.mockClear();
  });

  it('renders one canvas and opens no WebGL context for a WebGPU session with the overlay on', () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    const { container } = render(
      <ShaderCanvas breathPhase={0} overlayEnabled effectivePerformanceMode="quality" />,
    );

    expect(container.querySelectorAll('canvas')).toHaveLength(1);
    expect(container.querySelector('[data-layer="webgl2-overlay"]')).toBeNull();
    expect(getContext.mock.calls.filter(([kind]) => /webgl/.test(String(kind)))).toEqual([]);
    expect(mocks.mountRenderer).toHaveBeenCalledTimes(1);
    expect(mocks.mountRenderer.mock.calls[0][0]).not.toHaveProperty('overlay');
  });

  it('toggles the overlay through the governor without remounting the renderer', () => {
    const { rerender, container } = render(
      <ShaderCanvas breathPhase={0} overlayEnabled effectivePerformanceMode="quality" />,
    );
    const { governor } = mocks.mountRenderer.mock.calls[0][0];
    expect(governor.getSnapshot().overlayEnabled).toBe(true);

    rerender(<ShaderCanvas breathPhase={0} overlayEnabled={false} effectivePerformanceMode="quality" />);

    expect(mocks.mountRenderer).toHaveBeenCalledTimes(1);
    expect(governor.getSnapshot().overlayEnabled).toBe(false);
    expect(container.querySelector('[data-overlay]')?.getAttribute('data-overlay')).toBe('false');
  });
});
