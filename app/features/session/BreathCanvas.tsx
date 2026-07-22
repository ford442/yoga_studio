'use client';

import React, { useRef, useState } from 'react';
import WebGPUShader from '../../components/WebGPUShader';
import { useRippleAudio } from '../../hooks/useRippleAudio';
import type { PerformanceMode, RendererDiagnosticsState } from '../../types/renderer';
import type { SessionMode } from '../../types/sessionMode';

interface BreathCanvasProps {
  breathPhase: number;
  intensity: number;
  chakraPhase: number;
  phaseProgress: number;
  selectedMode: SessionMode;
  hasEnvironment: boolean;
  effectivePerformanceMode: PerformanceMode;
  reducedMotion: boolean;
  onDiagnostics: (state: RendererDiagnosticsState) => void;
}

/** The interactive WebGPU canvas: pointer-driven ripple/mouse uniforms plus the shader itself. */
export default function BreathCanvas({
  breathPhase,
  intensity,
  chakraPhase,
  phaseProgress,
  selectedMode,
  hasEnvironment,
  effectivePerformanceMode,
  reducedMotion,
  onDiagnostics,
}: BreathCanvasProps) {
  const [mouse, setMouse] = useState({ x: -2, y: -2 });
  const [mouseStrength, setMouseStrength] = useState(0);
  const { playRipple } = useRippleAudio();
  const lastRippleRef = useRef(0);

  return (
    <div
      className={`absolute inset-0 z-[2] ${hasEnvironment ? 'mix-blend-screen' : ''}`}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const canvasW = rect.width * dpr;
        const canvasH = rect.height * dpr;
        const px = (e.clientX - rect.left) * dpr;
        const py = (e.clientY - rect.top) * dpr;
        setMouse({ x: (px - canvasW / 2) / canvasH, y: (py - canvasH / 2) / canvasH });
        setMouseStrength(0.7);
        const now = Date.now();
        if (now - lastRippleRef.current > 100) {
          lastRippleRef.current = now;
          playRipple(0.6);
        }
      }}
      onPointerLeave={() => { setMouse({ x: -2, y: -2 }); setMouseStrength(0); }}
      onPointerUp={() => { setMouse({ x: -2, y: -2 }); setMouseStrength(0); }}
    >
      <WebGPUShader
        breathPhase={breathPhase}
        intensity={intensity}
        chakraPhase={chakraPhase}
        phaseProgress={phaseProgress}
        theme={selectedMode.theme}
        mandalaStyle={selectedMode.mandalaStyle}
        figurePose={selectedMode.figurePose}
        mouse={mouse}
        mouseStrength={mouseStrength}
        timeScale={1.0}
        strengthLevel={selectedMode.strengthLevel ?? 1.0}
        chakraFocus={selectedMode.chakraFocusIndex}
        geometryDensity={selectedMode.geometryDensity ?? 1.0}
        interference={selectedMode.interference ?? 0.5}
        qualityPreset={effectivePerformanceMode === 'performance' ? 0 : effectivePerformanceMode === 'quality' ? 1 : selectedMode.qualityPreset}
        maxDevicePixelRatio={effectivePerformanceMode === 'performance' ? 1 : effectivePerformanceMode === 'quality' ? 2 : selectedMode.maxDevicePixelRatio}
        overlayEnabled={effectivePerformanceMode !== 'performance'}
        reducedMotion={reducedMotion}
        shaderPath={selectedMode.shaderPath}
        vertexEntry={selectedMode.vertexEntry}
        fragmentEntry={selectedMode.fragmentEntry}
        onDiagnostics={onDiagnostics}
        className="w-full h-full"
      />
    </div>
  );
}
