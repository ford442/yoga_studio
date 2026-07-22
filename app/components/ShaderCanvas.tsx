'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GeometryOverlay } from '../renderer/overlay';
import { probeCapabilities, mountRenderer, pickInitialMode } from '../renderer/selectBackend';
import { resolveMaxDpr, resolveQualityPreset } from '../renderer/quality';
import type { AnimatedUniformValues } from '../renderer/types';
import { type RendererMode, type RendererDiagnosticsState } from '../types/renderer';

interface ShaderCanvasProps {
  breathPhase: number;
  intensity?: number;
  chakraPhase?: number;
  phaseProgress?: number;
  theme?: number;
  mandalaStyle?: number;
  figurePose?: number; // 0=lotus, 1=tadasana, 2=tai-chi, 3=heart-open, 4=chinmudra, 5=warrior, 6=tree
  mouse?: { x: number; y: number };
  mouseStrength?: number;
  timeScale?: number;
  strengthLevel?: number; // 0.0=light, 1.0=regular, 2.0=strong
  chakraFocus?: number; // -1=none, 0..6=root..crown
  geometryDensity?: number; // 0.0=sparse, 1.0=default, 3.0=rich
  interference?: number; // 0.0=still, 1.0=strong moire/interference
  qualityPreset?: number; // 0=mobile, 1=high, undefined=auto-detect
  maxDevicePixelRatio?: number; // caps render resolution while preserving CSS size
  overlayEnabled?: boolean; // WebGL2 transparent geometry layer on top of the main renderer
  className?: string;
  shaderPath?: string;
  vertexEntry?: string;
  fragmentEntry?: string;
  reducedMotion?: boolean;
  onDiagnostics?: (state: RendererDiagnosticsState) => void;
}

type ShaderPropsRef = Required<
  Pick<
    ShaderCanvasProps,
    | 'breathPhase'
    | 'intensity'
    | 'chakraPhase'
    | 'phaseProgress'
    | 'theme'
    | 'mandalaStyle'
    | 'figurePose'
    | 'mouse'
    | 'mouseStrength'
    | 'timeScale'
    | 'strengthLevel'
    | 'chakraFocus'
    | 'geometryDensity'
    | 'interference'
    | 'qualityPreset'
  >
>;

const capabilities = probeCapabilities();

/** Thin React shell around the renderer backends: owns refs, prop plumbing, and diagnostics reporting. */
const ShaderCanvas: React.FC<ShaderCanvasProps> = ({
  breathPhase,
  intensity = 1.0,
  chakraPhase = 0,
  phaseProgress = 0,
  theme = 0,
  mandalaStyle = 0,
  figurePose = 0,
  mouse = { x: -2, y: -2 },
  mouseStrength = 0,
  timeScale = 1.0,
  strengthLevel = 1.0,
  chakraFocus = -1,
  geometryDensity = 1.0,
  interference = 0.5,
  qualityPreset,
  maxDevicePixelRatio,
  overlayEnabled = true,
  className = '',
  shaderPath = 'sacred-lotus-final.wgsl',
  vertexEntry = 'vs',
  fragmentEntry = 'main',
  reducedMotion = false,
  onDiagnostics,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>(() => pickInitialMode(capabilities));
  const [fallbackReason, setFallbackReason] = useState<string | undefined>(undefined);

  // Reduce motion: lower quality, cap DPR, and disable the overlay.
  const effectiveQualityPreset = reducedMotion ? 0 : resolveQualityPreset(qualityPreset);
  const effectiveMaxDpr = reducedMotion
    ? Math.min(maxDevicePixelRatio ?? 1.5, 1.5)
    : maxDevicePixelRatio;
  const effectiveOverlayEnabled = reducedMotion ? false : overlayEnabled;
  const resolvedMaxDpr = resolveMaxDpr(effectiveQualityPreset, effectiveMaxDpr);

  // Mutable refs for animated values so the graphics backend only initializes once.
  const propsRef = useRef<ShaderPropsRef>({
    breathPhase,
    intensity,
    chakraPhase,
    phaseProgress,
    theme,
    mandalaStyle,
    figurePose,
    mouse,
    mouseStrength,
    timeScale,
    strengthLevel,
    chakraFocus,
    geometryDensity,
    interference,
    qualityPreset: effectiveQualityPreset,
  });

  useEffect(() => {
    propsRef.current = {
      breathPhase,
      intensity,
      chakraPhase,
      phaseProgress,
      theme,
      mandalaStyle,
      figurePose,
      mouse,
      mouseStrength,
      timeScale,
      strengthLevel,
      chakraFocus,
      geometryDensity,
      interference,
      qualityPreset: effectiveQualityPreset,
    };
  }, [breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, figurePose, mouse, mouseStrength, timeScale, strengthLevel, chakraFocus, geometryDensity, interference, effectiveQualityPreset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let overlay: GeometryOverlay | null = null;
    if (effectiveOverlayEnabled && overlayCanvasRef.current) {
      overlay = new GeometryOverlay(overlayCanvasRef.current);
      if (!overlay.init()) overlay = null;
    }

    const getUniformSnapshot = (): AnimatedUniformValues => propsRef.current;

    const unmount = mountRenderer({
      mode: rendererMode,
      caps: capabilities,
      canvas,
      container,
      overlay,
      shaderPath,
      vertexEntry,
      fragmentEntry,
      getMaxDevicePixelRatio: () => resolveMaxDpr(propsRef.current.qualityPreset, effectiveMaxDpr),
      getUniformSnapshot,
      getTimeScale: () => propsRef.current.timeScale,
      onFallback: (nextMode, reason) => {
        setFallbackReason(reason);
        setRendererMode(nextMode);
      },
    });

    return () => {
      unmount();
      overlay?.destroy();
    };
  }, [shaderPath, vertexEntry, fragmentEntry, rendererMode, effectiveOverlayEnabled, effectiveMaxDpr]);

  // Report renderer diagnostics whenever observable state changes.
  useEffect(() => {
    if (!onDiagnostics) return;
    onDiagnostics({
      mode: rendererMode,
      fallbackReason,
      activeShader: shaderPath,
      qualityPreset: effectiveQualityPreset,
      maxDevicePixelRatio: resolvedMaxDpr,
      overlayEnabled: effectiveOverlayEnabled,
      reducedMotion: Boolean(reducedMotion),
      batterySaver: false,
    });
  }, [rendererMode, fallbackReason, shaderPath, effectiveQualityPreset, resolvedMaxDpr, effectiveOverlayEnabled, reducedMotion, onDiagnostics]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      data-renderer={rendererMode}
      data-shader={shaderPath}
      data-fallback-reason={fallbackReason ?? ''}
      data-quality={effectiveQualityPreset}
      data-dpr-cap={resolvedMaxDpr}
      data-overlay={effectiveOverlayEnabled}
      data-reduced-motion={Boolean(reducedMotion)}
    >
      <canvas
        key={rendererMode}
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />
      {effectiveOverlayEnabled && (
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          data-layer="webgl2-overlay"
          style={{ display: 'block', mixBlendMode: 'screen' }}
        />
      )}
    </div>
  );
};

export default ShaderCanvas;
