'use client';

import React from 'react';
import type { BreathSettings } from '../../hooks/useBreathTimer';
import type { EnvironmentOverride } from '../../types/environment';
import type { InstructorVideoSettings } from '../../types/instructorVideo';
import type { RendererSettings, PerformanceMode } from '../../types/renderer';
import { ENVIRONMENTS } from '../../data/environments';
import type { SessionMode } from '../../types/sessionMode';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedMode: SessionMode;
  settings: BreathSettings;
  updateSettings: (next: Partial<BreathSettings>) => void;
  environmentOverride: EnvironmentOverride;
  setEnvironmentOverride: (next: EnvironmentOverride) => void;
  canUseInstructor: boolean;
  instructorSettings: InstructorVideoSettings;
  updateInstructorSettings: (patch: Partial<InstructorVideoSettings>) => void;
  rendererSettings: RendererSettings;
  updateRendererSettings: (patch: Partial<RendererSettings>) => void;
  effectivePerformanceMode: PerformanceMode;
  isPerformanceForced: boolean;
}

export default function SettingsDrawer({
  open,
  onClose,
  selectedMode,
  settings,
  updateSettings,
  environmentOverride,
  setEnvironmentOverride,
  canUseInstructor,
  instructorSettings,
  updateInstructorSettings,
  rendererSettings,
  updateRendererSettings,
  effectivePerformanceMode,
  isPerformanceForced,
}: SettingsDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div role="dialog" aria-modal="true" aria-labelledby="settings-title" className="bg-[#0f081f] w-full max-w-md max-h-[90dvh] overflow-y-auto mx-auto rounded-t-3xl p-6 text-white">
        <h2 id="settings-title" className="text-2xl font-light mb-6">Customize Breath</h2>

        <div className="mb-8">
          <p className="text-sm text-white/60 mb-3 tracking-wider">ENVIRONMENT</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setEnvironmentOverride('auto')}
              className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                environmentOverride === 'auto'
                  ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                  : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
              }`}
            >
              AUTO (MODE)
            </button>
            {ENVIRONMENTS.map((env) => (
              <button
                key={env.id}
                onClick={() => setEnvironmentOverride(env.id)}
                className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                  environmentOverride === env.id
                    ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                    : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                }`}
              >
                {env.emoji} {env.label.toUpperCase()}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/45 leading-relaxed">
            {environmentOverride === 'auto'
              ? `Following ${selectedMode.label} — ${ENVIRONMENTS.find((e) => e.id === (selectedMode.backgroundId ?? 'none'))?.label ?? 'Cosmic Void'}`
              : 'Manual environment — persists across sessions'}
          </p>
        </div>

        {canUseInstructor && (
          <div className="mb-8">
            <p className="text-sm text-white/60 mb-3 tracking-wider">INSTRUCTOR GUIDE</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => updateInstructorSettings({ enabled: !instructorSettings.enabled })}
                className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                  instructorSettings.enabled
                    ? 'bg-cyan-500/30 border-cyan-300 text-cyan-100'
                    : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                }`}
              >
                {instructorSettings.enabled ? 'ON' : 'OFF'}
              </button>
              {(['pip', 'underlay'] as const).map((layout) => (
                <button
                  key={layout}
                  onClick={() => updateInstructorSettings({ layout })}
                  className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                    instructorSettings.layout === layout
                      ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                      : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {layout === 'pip' ? 'PICTURE IN PICTURE' : 'SOFT UNDERLAY'}
                </button>
              ))}
            </div>
            {instructorSettings.layout === 'pip' && (
              <div className="flex flex-wrap gap-2 mb-3">
                {(['sm', 'md', 'lg'] as const).map((pipSize) => (
                  <button
                    key={pipSize}
                    onClick={() => updateInstructorSettings({ pipSize })}
                    className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                      instructorSettings.pipSize === pipSize
                        ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {pipSize.toUpperCase()}
                  </button>
                ))}
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((pipCorner) => (
                  <button
                    key={pipCorner}
                    onClick={() => updateInstructorSettings({ pipCorner, pipDragOffset: { x: 0, y: 0 } })}
                    className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                      instructorSettings.pipCorner === pipCorner
                        ? 'bg-purple-500/30 border-purple-300 text-purple-100'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {pipCorner.replace('-', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-3 text-sm text-white/70 mb-2">
              <input
                type="checkbox"
                checked={instructorSettings.audioEnabled}
                onChange={(e) => updateInstructorSettings({ audioEnabled: e.target.checked })}
                className="accent-cyan-400"
              />
              Instructor audio (muted when voice guidance is on)
            </label>
            <p className="text-[11px] text-white/45 leading-relaxed">
              Drag the PiP window to reposition. Video pauses when practice is paused.
            </p>
          </div>
        )}

        <div className="mb-8">
          <p className="text-sm text-white/60 mb-3 tracking-wider">RENDERER</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['auto', 'performance', 'quality'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateRendererSettings({ performanceMode: mode })}
                className={`px-3 py-2 rounded-xl text-xs tracking-wider border transition-all ${
                  effectivePerformanceMode === mode
                    ? 'bg-emerald-500/30 border-emerald-300 text-emerald-100'
                    : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                }`}
              >
                {mode === 'auto' && 'AUTO'}
                {mode === 'performance' && 'PERFORMANCE'}
                {mode === 'quality' && 'QUALITY'}
                {isPerformanceForced && mode === 'performance' && ' (forced)'}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-3 text-sm text-white/70 mb-2">
            <input
              type="checkbox"
              checked={rendererSettings.reducedMotion}
              onChange={(e) => updateRendererSettings({ reducedMotion: e.target.checked })}
              className="accent-emerald-400"
            />
            Reduced motion (lowers detail & disables overlay)
          </label>
          <label className="flex items-center gap-3 text-sm text-white/70 mb-2">
            <input
              type="checkbox"
              checked={rendererSettings.showDiagnostics}
              onChange={(e) => updateRendererSettings({ showDiagnostics: e.target.checked })}
              className="accent-emerald-400"
            />
            Show renderer diagnostics
          </label>
          <p className="text-[11px] text-white/45 leading-relaxed mb-2">
            WebGPU is required in Chrome and Edge. A failed boot probe hard-fails; WebGL fallback is deferred.
          </p>
          <p className="text-[11px] text-white/45 leading-relaxed">
            {effectivePerformanceMode === 'auto'
              ? 'Following technique defaults.'
              : effectivePerformanceMode === 'performance'
                ? 'Capped resolution, lower detail, no overlay.'
                : 'Maximum detail, overlay enabled.'}
          </p>
        </div>

        {(['inhale', 'hold1', 'exhale', 'hold2'] as const).map((key) => (
          <div key={key} className="flex items-center gap-4 mb-6">
            <span className="w-20 capitalize text-white/70">{key}</span>
            <input
              type="range"
              min="0"
              max={key === 'hold2' ? 10 : 15}
              value={settings[key]}
              onChange={(e) => updateSettings({ [key]: parseInt(e.target.value) })}
              className="flex-1 accent-purple-500"
            />
            <span className="font-mono w-8 text-right">{settings[key]}s</span>
          </div>
        ))}

        <div className="mt-8 border-t border-white/10 pt-6">
          <p className="text-sm text-white/60 mb-3 tracking-wider">PRACTICE HISTORY</p>
          <p className="mb-2 text-xs leading-relaxed text-white/45">
            Session recording and history sync are paused while the practice companion is still in early preview.
            Local session ledgers are not saved.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-4 mt-4 bg-white/10 hover:bg-white/20 rounded-3xl text-lg font-light"
        >
          DONE
        </button>
      </div>
    </div>
  );
}
