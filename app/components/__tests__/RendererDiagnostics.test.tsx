import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RendererDiagnostics, { GpuErrorBanner } from '../RendererDiagnostics';
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
  gpuPassP75Ms: null,
  choreLastMs: null,
  gpuTimestamps: 'unsupported',
  governorBound: null,
  choresPaused: false,
  instructorVideoEnabled: true,
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

describe('RendererDiagnostics', () => {
  it('splits cpu p75, gpu p75, chore time and timestamp state', () => {
    render(
      <RendererDiagnostics
        state={base({
          frameTimeP75Ms: 21.4,
          gpuPassP75Ms: 14.2,
          choreLastMs: 3.5,
          gpuTimestamps: 'on',
          governorBound: 'gpu',
        })}
      />,
    );

    const row = screen.getByTestId('governor-timing');
    expect(row.textContent).toContain('cpu p75: 21.4ms');
    expect(row.textContent).toContain('gpu p75: 14.2ms');
    expect(row.textContent).toContain('chores: 3.5ms');
    expect(row.textContent).toContain('timestamps: on');
    expect(row.dataset.governorBound).toBe('gpu');
  });

  it('marks GPU timing unsupported and shows CPU-bound relief', () => {
    render(
      <RendererDiagnostics
        state={base({
          frameTimeP75Ms: 30,
          gpuTimestamps: 'unsupported',
          governorBound: 'cpu',
          choresPaused: true,
          instructorVideoEnabled: false,
        })}
      />,
    );

    const row = screen.getByTestId('governor-timing');
    expect(row.textContent).toContain('gpu p75: —');
    expect(row.textContent).toContain('timestamps: unsupported');
    expect(screen.getByTestId('renderer-diagnostics').textContent).toContain('chores paused');
    expect(screen.getByTestId('renderer-diagnostics').textContent).toContain('video off');
  });

  it('shows the gpu-chores backend and why it was picked', () => {
    render(
      <RendererDiagnostics
        state={base({ chores: { backend: 'webgpu', reason: 'adopted renderer GPUDevice', jobCount: 2, lastDurationMs: 3.5 } })}
      />,
    );

    const row = screen.getByTestId('chores-backend');
    expect(row.dataset.choresBackend).toBe('webgpu');
    expect(row.textContent).toContain('adopted renderer GPUDevice');
  });

  it('reads as idle before any chore has run', () => {
    render(<RendererDiagnostics state={base({})} />);

    const row = screen.getByTestId('chores-backend');
    expect(row.dataset.choresBackend).toBe('idle');
    expect(row.textContent).toContain('no chores run yet');
  });
});
