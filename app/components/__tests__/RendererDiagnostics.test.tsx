import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GpuErrorBanner } from '../RendererDiagnostics';
import type { RendererDiagnosticsState } from '../../types/renderer';

const base = (patch: Partial<RendererDiagnosticsState>): RendererDiagnosticsState => ({
  mode: 'webgpu',
  activeShader: 'sacred-monk.wgsl',
  qualityPreset: 1,
  maxDevicePixelRatio: 2,
  overlayEnabled: false,
  reducedMotion: false,
  batterySaver: false,
  resolutionScale: 1,
  frameTimeP75Ms: null,
  governorStepDowns: 0,
  governorPaused: false,
  compilationMessages: [],
  recoveryStatus: 'idle',
  ...patch,
});

describe('GpuErrorBanner', () => {
  it('names shader module vs render pipeline vs device', () => {
    const { rerender } = render(
      <GpuErrorBanner state={base({ gpuFailureStage: 'module', gpuFailureReason: 'WebGPU shader module failed.' })} />,
    );
    expect(screen.getByTestId('gpu-error-banner').textContent).toContain('GPU error (shader module)');
    rerender(
      <GpuErrorBanner state={base({ gpuFailureStage: 'pipeline', gpuFailureReason: 'WebGPU render pipeline failed.' })} />,
    );
    expect(screen.getByTestId('gpu-error-banner').textContent).toContain('GPU error (render pipeline)');
    rerender(
      <GpuErrorBanner state={base({ gpuFailureStage: 'device', gpuFailureReason: 'WebGPU device failed.' })} />,
    );
    expect(screen.getByTestId('gpu-error-banner').textContent).toContain('GPU error (device)');
  });
});
