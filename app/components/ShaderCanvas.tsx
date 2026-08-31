'use client';

import React, { useEffect, useRef, useState } from 'react';
import { GeometryOverlay } from '../renderer/overlay';
import { probeCapabilities, mountRenderer, pickInitialMode } from '../renderer/selectBackend';
import { resolveMaxDpr, resolveQualityPreset } from '../renderer/quality';
import {
  createFrameGovernor,
  parseGovernorTier,
  type FrameGovernor,
  type GovernorSnapshot,
  type GovernorTier,
} from '../renderer/frameGovernor';
import type { AnimatedUniformValues } from '../renderer/types';
import {
  type GpuFailureStage,
  type RendererMode,
  type RendererDiagnosticsState,
  type GovernorPersistedTier,
  type PerformanceMode,
  type RendererBackendDiagnostics,
} from '../types/renderer';

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
  effectivePerformanceMode: PerformanceMode;
  className?: string;
  shaderPath?: string;
  vertexEntry?: string;
  fragmentEntry?: string;
  reducedMotion?: boolean;
  /** Skip GPU work while the completion overlay covers the canvas. */
  pauseRendering?: boolean;
  /** Seed / persist adaptive quality tier across sessions. */
  persistedGovernorTier?: GovernorPersistedTier;
  onGovernorTierChange?: (tier: GovernorPersistedTier) => void;
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

const toBaseTier = (
  qualityPreset: number,
  overlayEnabled: boolean,
): GovernorTier => ({
  resolutionScale: 1,
  qualityPreset: qualityPreset >= 0.5 ? 1 : 0,
  overlayEnabled,
});

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
  effectivePerformanceMode,
  className = '',
  shaderPath = 'sacred-lotus-final.wgsl',
  vertexEntry = 'vs',
  fragmentEntry = 'main',
  reducedMotion = false,
  pauseRendering = false,
  persistedGovernorTier,
  onGovernorTierChange,
  onDiagnostics,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>(() => pickInitialMode(capabilities));
  const [fallbackReason, setFallbackReason] = useState<string | undefined>(undefined);
  const [gpuFailureStage, setGpuFailureStage] = useState<GpuFailureStage | undefined>(undefined);
  const [governorSnap, setGovernorSnap] = useState<GovernorSnapshot>(() => ({
    resolutionScale: 1,
    qualityPreset: 1,
    overlayEnabled: true,
    p75FrameMs: null,
    stepDownCount: 0,
    paused: false,
  }));

  // Reduce motion: lower quality, cap DPR, and disable the overlay.
  const effectiveQualityPreset = reducedMotion ? 0 : resolveQualityPreset(qualityPreset);
  const effectiveMaxDpr = reducedMotion
    ? Math.min(maxDevicePixelRatio ?? 1.5, 1.5)
    : maxDevicePixelRatio;
  const effectiveOverlayEnabled = reducedMotion ? false : overlayEnabled;
  const resolvedMaxDpr = resolveMaxDpr(effectiveQualityPreset, effectiveMaxDpr);

  const pauseRef = useRef(pauseRendering);
  const onGovernorTiersChangeRef = useRef(onGovernorTierChange);
  const onDiagnosticsRef = useRef(onDiagnostics);
  const backendDiagnosticsRef = useRef<RendererBackendDiagnostics>({
    compilationMessages: [],
    recoveryStatus: 'idle',
  });
  const diagMetaRef = useRef({
    rendererMode,
    fallbackReason,
    shaderPath,
    effectiveQualityPreset,
    resolvedMaxDpr,
    effectiveOverlayEnabled,
    reducedMotion: Boolean(reducedMotion),
    pauseRendering,
  });
  const governorRef = useRef<FrameGovernor | null>(null);
  const publishDiagnosticsRef = useRef<() => void>(() => {});
  if (governorRef.current == null) {
    governorRef.current = createFrameGovernor({
      base: toBaseTier(effectiveQualityPreset, effectiveOverlayEnabled),
      initial: parseGovernorTier(persistedGovernorTier),
    });
  }

  useEffect(() => {
    pauseRef.current = pauseRendering;
  }, [pauseRendering]);

  useEffect(() => {
    onGovernorTiersChangeRef.current = onGovernorTierChange;
  }, [onGovernorTierChange]);

  useEffect(() => {
    onDiagnosticsRef.current = onDiagnostics;
  }, [onDiagnostics]);

  useEffect(() => {
    diagMetaRef.current = {
      rendererMode,
      fallbackReason,
      shaderPath,
      effectiveQualityPreset,
      resolvedMaxDpr,
      effectiveOverlayEnabled,
      reducedMotion: Boolean(reducedMotion),
      pauseRendering,
    };
  }, [
    rendererMode,
    fallbackReason,
    shaderPath,
    effectiveQualityPreset,
    resolvedMaxDpr,
    effectiveOverlayEnabled,
    reducedMotion,
    pauseRendering,
  ]);

  // Keep the governor ceiling in sync with technique / performance-mode props.
  useEffect(() => {
    governorRef.current?.setBase(toBaseTier(effectiveQualityPreset, effectiveOverlayEnabled));
  }, [effectiveQualityPreset, effectiveOverlayEnabled]);

  // Publish diagnostics + data-attribute snapshot on an interval (external timer callback).
  useEffect(() => {
    const publish = () => {
      const snap = governorRef.current?.getSnapshot();
      if (!snap) return;
      setGovernorSnap(snap);
      const meta = diagMetaRef.current;
      onDiagnosticsRef.current?.({
        mode: meta.rendererMode,
        fallbackReason: meta.fallbackReason,
        activeShader: meta.shaderPath,
        qualityPreset: Math.min(meta.effectiveQualityPreset, snap.qualityPreset),
        maxDevicePixelRatio: meta.resolvedMaxDpr * snap.resolutionScale,
        overlayEnabled: snap.overlayEnabled && meta.effectiveOverlayEnabled,
        reducedMotion: meta.reducedMotion,
        batterySaver: false,
        resolutionScale: snap.resolutionScale,
        frameTimeP75Ms: snap.p75FrameMs,
        governorStepDowns: snap.stepDownCount,
        governorPaused: snap.paused || meta.pauseRendering,
        adapterInfo: backendDiagnosticsRef.current.adapterInfo,
        compilationMessages: backendDiagnosticsRef.current.compilationMessages ?? [],
        recoveryStatus: backendDiagnosticsRef.current.recoveryStatus ?? 'idle',
        gpuFailureStage: backendDiagnosticsRef.current.gpuFailureStage,
        gpuFailureReason: backendDiagnosticsRef.current.gpuFailureReason,
      });
    };

    const id = window.setInterval(publish, 500);
    publishDiagnosticsRef.current = publish;
    return () => window.clearInterval(id);
  }, []);

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
    const governor = governorRef.current;
    if (!canvas || !container || !governor) return;

    // Overlay canvas is created when the base setting allows it; the governor
    // may skip drawing it without tearing down the GL context.
    let overlay: GeometryOverlay | null = null;
    if (effectiveOverlayEnabled && overlayCanvasRef.current) {
      overlay = new GeometryOverlay(overlayCanvasRef.current);
      if (!overlay.init()) overlay = null;
    }

    const getUniformSnapshot = (): AnimatedUniformValues => {
      const base = propsRef.current;
      const snap = governor.getSnapshot();
      return {
        ...base,
        qualityPreset: Math.min(base.qualityPreset, snap.qualityPreset),
      };
    };

    const unmount = mountRenderer({
      mode: rendererMode,
      caps: capabilities,
      canvas,
      container,
      overlay,
      shaderPath,
      vertexEntry,
      fragmentEntry,
      performanceMode: effectivePerformanceMode,
      governor,
      shouldRender: () => !pauseRef.current,
      getMaxDevicePixelRatio: () =>
        resolveMaxDpr(propsRef.current.qualityPreset, effectiveMaxDpr) * governor.getSnapshot().resolutionScale,
      getUniformSnapshot,
      getTimeScale: () => propsRef.current.timeScale,
      onGovernorChange: () => {
        const snap = governor.getSnapshot();
        onGovernorTiersChangeRef.current?.({
          resolutionScale: snap.resolutionScale,
          qualityPreset: snap.qualityPreset,
          overlayEnabled: snap.overlayEnabled,
        });
        setGovernorSnap(snap);
      },
      onBackendDiagnostics: (next) => {
        backendDiagnosticsRef.current = {
          ...backendDiagnosticsRef.current,
          ...next,
        };
        if ('gpuFailureStage' in next) setGpuFailureStage(next.gpuFailureStage);
        if (next.gpuFailureStage) publishDiagnosticsRef.current();
      },
      onFallback: (nextMode, reason) => {
        setFallbackReason(reason);
        setRendererMode(nextMode);
      },
    });

    return () => {
      unmount();
      overlay?.destroy();
    };
  }, [shaderPath, vertexEntry, fragmentEntry, rendererMode, effectiveOverlayEnabled, effectiveMaxDpr, effectivePerformanceMode]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      data-renderer={rendererMode}
      data-shader={shaderPath}
      data-fallback-reason={fallbackReason ?? ''}
      data-gpu-failure-stage={gpuFailureStage ?? ''}
      data-quality={Math.min(effectiveQualityPreset, governorSnap.qualityPreset)}
      data-dpr-cap={resolvedMaxDpr}
      data-resolution-scale={governorSnap.resolutionScale}
      data-overlay={governorSnap.overlayEnabled && effectiveOverlayEnabled}
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
