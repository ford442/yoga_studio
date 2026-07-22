'use client';

import React from 'react';
import { type RendererDiagnosticsState } from '../types/renderer';

interface RendererDiagnosticsProps {
  state: RendererDiagnosticsState | null;
}

const qualityLabel = (preset: number): string =>
  preset >= 0.5 ? 'high' : 'mobile';

export default function RendererDiagnostics({ state }: RendererDiagnosticsProps) {
  if (!state) return null;

  const modeText =
    state.mode === 'webgpu' ? 'WebGPU' : state.mode === 'webgl2' ? 'WebGL2 fallback' : 'Static fallback';
  const fallback = state.fallbackReason ? `Fallback: ${state.fallbackReason}` : undefined;
  const p75 =
    state.frameTimeP75Ms == null ? '—' : `${state.frameTimeP75Ms.toFixed(1)}ms`;

  return (
    <div
      className="fixed bottom-4 left-4 z-40 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 px-4 py-3 text-white/90 text-xs font-mono pointer-events-none motion-reduce:transition-none"
      data-testid="renderer-diagnostics"
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            state.mode === 'webgpu' ? 'bg-emerald-400' : state.mode === 'webgl2' ? 'bg-amber-400' : 'bg-red-400'
          }`}
        />
        <span className="font-semibold tracking-wide">{modeText}</span>
        {state.governorPaused && <span className="text-amber-300">paused</span>}
      </div>
      <div className="space-y-0.5 text-white/70">
        <div>Shader: {state.activeShader}</div>
        <div>
          Quality: {qualityLabel(state.qualityPreset)} · Scale: {state.resolutionScale.toFixed(2)} · DPR:{' '}
          {state.maxDevicePixelRatio.toFixed(2)} · Overlay: {state.overlayEnabled ? 'on' : 'off'}
        </div>
        <div>
          Frame p75: {p75} · Step-downs: {state.governorStepDowns}
        </div>
        {state.reducedMotion && <div className="text-amber-300">Reduced motion active</div>}
        {fallback && <div className="text-amber-300/90 max-w-[260px] leading-tight">{fallback}</div>}
      </div>
    </div>
  );
}
