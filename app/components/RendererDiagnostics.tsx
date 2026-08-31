'use client';

import React from 'react';
import {
  GPU_FAILURE_STAGE_LABEL,
  type RendererDiagnosticsState,
} from '../types/renderer';

interface RendererDiagnosticsProps {
  state: RendererDiagnosticsState | null;
}

/** Always-on GPU failure banner (not gated on the diagnostics toggle). */
export function GpuErrorBanner({ state }: RendererDiagnosticsProps) {
  if (!state?.gpuFailureStage) return null;
  const firstError = state.compilationMessages.find((message) => message.type === 'error');
  const reason = state.gpuFailureReason ?? state.fallbackReason ?? 'WebGPU initialization failed.';

  return (
    <div
      className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-400/40 bg-red-950/80 px-4 py-2 text-red-100 text-xs font-mono pointer-events-none max-w-[min(92vw,420px)] leading-tight"
      data-testid="gpu-error-banner"
      data-gpu-failure-stage={state.gpuFailureStage}
    >
      <div>GPU error ({GPU_FAILURE_STAGE_LABEL[state.gpuFailureStage]}): {reason}</div>
      {firstError && (
        <div className="mt-1 text-red-200/90">
          {firstError.line}:{firstError.column} {firstError.text}
        </div>
      )}
    </div>
  );
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
  const adapter = state.adapterInfo
    ? [state.adapterInfo.vendor, state.adapterInfo.architecture, state.adapterInfo.device, state.adapterInfo.description]
      .filter(Boolean)
      .join(' · ')
    : '';
  const visibleMessages = state.compilationMessages
    .filter((message) => message.type !== 'info')
    .slice(0, 3);
  const hiddenMessageCount = Math.max(
    0,
    state.compilationMessages.filter((message) => message.type !== 'info').length - visibleMessages.length,
  );

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
        {adapter && <div className="max-w-[320px] leading-tight">Adapter: {adapter}</div>}
        {state.recoveryStatus !== 'idle' && (
          <div className="text-amber-300">Recovery: {state.recoveryStatus}</div>
        )}
        {visibleMessages.map((message, index) => (
          <div
            key={`${message.type}-${message.line}-${message.column}-${index}`}
            className={message.type === 'error' ? 'text-red-300 max-w-[320px] leading-tight' : 'text-amber-300 max-w-[320px] leading-tight'}
          >
            {message.type.toUpperCase()} {message.line}:{message.column} {message.text}
          </div>
        ))}
        {hiddenMessageCount > 0 && <div>+{hiddenMessageCount} more compiler messages</div>}
        {state.reducedMotion && <div className="text-amber-300">Reduced motion active</div>}
        {fallback && <div className="text-amber-300/90 max-w-[260px] leading-tight">{fallback}</div>}
        {state.webgpuProbe && (
          <div className="text-white/55 max-w-[320px] leading-tight break-all" data-testid="webgpu-probe">
            Probe: {state.webgpuProbe.ok ? 'ok' : state.webgpuProbe.stage}
            {state.webgpuProbe.error ? ` · ${state.webgpuProbe.error}` : ''}
          </div>
        )}
      </div>
    </div>
  );
}
