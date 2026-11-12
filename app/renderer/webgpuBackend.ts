import { monotonicNow } from '../lib/monotonicClock';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import { buildUniformBuffer, UNIFORM_BUFFER_SIZE } from '../lib/shaderContract';
import { loadWgslSource } from '../lib/wgslModules';
import type {
  GpuFailureStage,
  RendererAdapterInfo,
  RendererCanvasConfig,
  RendererCompilationMessage,
  WebGpuProbeResult,
} from '../types/renderer';
import { resizeCanvasForDpr } from './canvasUtils';
import { attachVisibilityPause, beginFrame } from './frameGate';
import { lendChoreDevice } from './gpuChores/choreDevice';
import { buildGpuCanvasConfiguration, buildGpuDeviceDescriptor, getWebGPUAdapterOptions } from './gpuDeviceContract';
import {
  BreathFieldUnavailableError,
  createBreathField,
  HDR_FORMAT,
  type BreathField,
} from './breathField/breathField';
import { encodeReadback, isReadbackEnabled, readbackShaderOverride, type ReadbackRequest, type ReadbackResult } from './gpuReadback';
import { createOverlayPass, createScenePass } from './passes/fullscreenPasses';
import { encodePasses, type FramePass, type PassFrame } from './passes/types';
import { createGpuFrameTimer, supportsTimestampQuery, type GpuFrameTimer } from './gpuTimestamps';
import { buildOverlayWgsl, OVERLAY_BLEND, OVERLAY_FRAGMENT_ENTRY, OVERLAY_VERTEX_ENTRY } from './overlayWgsl';
import { createFramePipelineLayouts, type FramePipelineLayouts, UNIFORMS_BINDING } from './pipelineLayout';
import type { RendererBackend, RendererBackendContext } from './types';
import { createWithValidationScope, GpuStageError } from './gpuValidation';

export { createWithValidationScope, GpuStageError };

const DEVICE_LABEL = 'Sacred Breath WebGPU Device';

/**
 * Frames the loop may have queued on the GPU before it waits. Browsers usually
 * apply this back-pressure through the swap chain, but not all do (software
 * adapters queue without bound), and an unbounded queue stalls every
 * queue-ordered promise — `popErrorScope`, `mapAsync`, `onSubmittedWorkDone`.
 * A skipped rAF also keeps the CPU frame delta honest for the governor when
 * the GPU, not the CPU, is the bottleneck.
 */
export const MAX_FRAMES_IN_FLIGHT = 2;

/** Sim step ceiling: a resumed tab must not fling every particle off screen. */
const MAX_SIM_DT_SECONDS = 1 / 20;

type FieldState =
  | { status: 'idle' }
  | { status: 'building' }
  | { status: 'ready'; field: BreathField }
  | { status: 'unavailable'; reason: string };

type ShaderModuleWithOptionalInfo = GPUShaderModule & {
  getCompilationInfo?: () => Promise<GPUCompilationInfo>;
};

export function fatalReasonForGpuError(error: unknown): string {
  if (error instanceof GpuStageError) {
    if (error.stage === 'module') return 'WebGPU shader module failed.';
    if (error.stage === 'pipeline') return 'WebGPU render pipeline failed.';
  }
  return 'WebGPU device failed.';
}

export function logCompilationInfo(messages: RendererCompilationMessage[]): void {
  for (const message of messages) {
    const line = `[WebGPU] GPUCompilationInfo ${message.type} ${message.line}:${message.column} ${message.text}`;
    if (message.type === 'error') console.error(line);
    else if (message.type === 'warning') console.warn(line);
  }
}

function publishWebGpuProbe(probe: WebGpuProbeResult): void {
  if (typeof window !== 'undefined') {
    (window as Window & { webgpuProbe?: WebGpuProbeResult }).webgpuProbe = probe;
  }
}

function currentUserAgent(): string {
  return typeof navigator !== 'undefined' ? navigator.userAgent : '';
}

export function readAdapterInfo(adapter: GPUAdapter): RendererAdapterInfo | undefined {
  const info = adapter.info;
  if (!info) return undefined;
  const result: RendererAdapterInfo = {};
  for (const key of ['vendor', 'architecture', 'device', 'description'] as const) {
    const value = info[key];
    if (typeof value === 'string' && value) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function normalizeCompilationMessages(info: GPUCompilationInfo): RendererCompilationMessage[] {
  return Array.from(info.messages, (message) => ({
    type: message.type,
    text: message.message,
    line: message.lineNum ?? 0,
    column: message.linePos ?? 0,
  }));
}

/** WebGPU renderer with one same-backend device-loss recovery attempt. */
export class WebGPUBackend implements RendererBackend {
  readonly mode = 'webgpu' as const;

  private cancelled = false;
  private generation = 0;
  private recoveryAttempted = false;
  private ro: ResizeObserver | null = null;
  private device: GPUDevice | null = null;
  private canvasContext: GPUCanvasContext | null = null;
  private format: GPUTextureFormat | null = null;
  private configuredDevice: GPUDevice | null = null;
  private configuredWidth = 0;
  private configuredHeight = 0;
  private currentTextureFailed = false;
  private animationFrame: number | null = null;
  private startTime: number | null = null;
  private lastFrameMs: number | null = null;
  private detachVisibility: (() => void) | null = null;
  private resizeFn: (() => void) | null = null;
  private loopArgs: {
    pipeline: GPURenderPipeline;
    /** Null when the overlay failed to compile; the scene still renders. */
    overlayPipeline: GPURenderPipeline | null;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    /** Kept so the breath field can re-target the scene at the HDR format. */
    sceneModule: GPUShaderModule;
    layouts: FramePipelineLayouts;
    scenePass: FramePass;
    overlayPass: FramePass;
  } | null = null;
  /** Built lazily the first time the governor asks for particles or HDR. */
  private fieldState: FieldState = { status: 'idle' };
  private fieldGeneration = 0;
  private frameIndex = 0;
  private framesInFlight = 0;
  /** Bumped per device so a lost device's work-done callbacks can't skew the count. */
  private inFlightEpoch = 0;
  private ctx: RendererBackendContext | null = null;
  private frameTimer: GpuFrameTimer | null = null;
  private probeAdapterInfo: RendererAdapterInfo | undefined;
  private probeMessages: RendererCompilationMessage[] = [];
  private probeEnabledFeatures: string[] | undefined;
  private probeCanvasConfig: RendererCanvasConfig | undefined;
  private uncapturedListener: ((event: GPUUncapturedErrorEvent) => void) | null = null;
  private fatal = false;
  private readbackEnabled = false;
  private pendingReadbacks: Array<{
    request: ReadbackRequest;
    resolve: (result: ReadbackResult) => void;
    reject: (error: unknown) => void;
  }> = [];

  async start(ctx: RendererBackendContext): Promise<void> {
    this.ctx = ctx;
    this.cancelled = false;
    this.fatal = false;
    this.recoveryAttempted = false;
    this.startTime = monotonicNow();
    this.readbackEnabled = isReadbackEnabled();
    if (this.readbackEnabled && typeof window !== 'undefined') {
      window.__sacredBreathReadback = (request) => new Promise((resolve, reject) => {
        this.pendingReadbacks.push({ request: { time: request?.time ?? 0, overlay: request?.overlay, field: request?.field }, resolve, reject });
        this.scheduleFrame();
      });
    }
    this.canvasContext = ctx.canvas.getContext('webgpu');
    if (!this.canvasContext) {
      this.fail('device', 'Unable to create a WebGPU canvas context.');
      return;
    }
    this.format = navigator.gpu?.getPreferredCanvasFormat() ?? null;
    if (!this.format) {
      this.fail('device', 'WebGPU is unavailable.');
      return;
    }

    this.resizeFn = () => {
      try {
        resizeCanvasForDpr(ctx.canvas, ctx.getMaxDevicePixelRatio(), () => this.configureCanvas(true));
      } catch (error) {
        this.fail('device', 'Failed to configure the WebGPU context after resize.', error);
      }
    };
    this.resizeFn();
    this.ro = new ResizeObserver(this.resizeFn);
    this.ro.observe(ctx.container);

    try {
      await this.initializeGeneration(false);
    } catch (error) {
      if (this.cancelled) return;
      const stage: GpuFailureStage = error instanceof GpuStageError ? error.stage : 'device';
      this.fail(stage, fatalReasonForGpuError(error), error);
    }
  }

  private reportProbe(stage: GpuFailureStage | 'ok', error?: string): WebGpuProbeResult {
    const probe: WebGpuProbeResult = {
      ok: stage === 'ok',
      stage,
      userAgent: currentUserAgent(),
      adapterInfo: this.probeAdapterInfo,
      compilationMessages: this.probeMessages,
      enabledFeatures: this.probeEnabledFeatures,
      canvasConfig: this.probeCanvasConfig,
      error,
      timestamp: Date.now(),
    };
    publishWebGpuProbe(probe);
    this.ctx?.onBackendDiagnostics?.({ webgpuProbe: probe });
    return probe;
  }

  private attachUncapturedError(device: GPUDevice): void {
    this.detachUncapturedError();
    const listener = (event: GPUUncapturedErrorEvent) => {
      event.preventDefault?.();
      const message = event.error?.message ?? 'Uncaptured WebGPU error';
      console.error('[WebGPU] uncapturederror:', message);
      const stage: GpuFailureStage = /shader|wgsl|module/i.test(message)
        ? 'module'
        : /pipeline/i.test(message)
          ? 'pipeline'
          : 'device';
      this.fail(stage, fatalReasonForGpuError(new GpuStageError(stage, message)), event.error);
    };
    this.uncapturedListener = listener;
    device.addEventListener('uncapturederror', listener);
  }

  private detachUncapturedError(device?: GPUDevice | null): void {
    const target = device ?? this.device;
    if (target && this.uncapturedListener) {
      target.removeEventListener('uncapturederror', this.uncapturedListener);
    }
    this.uncapturedListener = null;
  }

  /** Query sets belong to a device; a lost/replaced device must not keep one alive. */
  private destroyFrameTimer(): void {
    try { this.frameTimer?.destroy(); } catch { /* device already gone */ }
    this.frameTimer = null;
  }

  private discardDevice(device: GPUDevice): void {
    this.detachUncapturedError(device);
    try { device.destroy(); } catch { /* already lost */ }
  }

  private fail(stage: GpuFailureStage, reason: string, error?: unknown): void {
    const ctx = this.ctx;
    if (!ctx || this.fatal || this.cancelled) return;
    this.fatal = true;
    this.destroyFrameTimer();
    lendChoreDevice(null, `renderer WebGPU failed (${stage})`);
    const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
    this.reportProbe(stage, detail ?? reason);
    ctx.onBackendDiagnostics?.({ gpuFailureStage: stage, gpuFailureReason: reason });
    ctx.onFatalError(reason, error);
  }

  private async initializeGeneration(recovery: boolean): Promise<void> {
    const ctx = this.ctx;
    const gpu = navigator.gpu;
    if (!ctx || !gpu || !this.canvasContext || !this.format) {
      throw new Error('WebGPU is unavailable.');
    }
    const generation = ++this.generation;
    this.probeAdapterInfo = undefined;
    this.probeMessages = [];
    this.probeEnabledFeatures = undefined;
    this.probeCanvasConfig = undefined;
    const adapter = await gpu.requestAdapter(getWebGPUAdapterOptions(ctx.performanceMode));
    if (!adapter) throw new Error('No WebGPU adapter was returned.');
    if (!this.isCurrent(generation)) return;
    this.probeAdapterInfo = readAdapterInfo(adapter);
    ctx.onBackendDiagnostics?.({ adapterInfo: this.probeAdapterInfo });

    // gpu-chores borrows this same device rather than requesting its own adapter,
    // so its required features/limits are resolved here, once, at boot.
    const device = await adapter.requestDevice(buildGpuDeviceDescriptor(adapter, DEVICE_LABEL));
    if (!this.isCurrent(generation)) {
      this.discardDevice(device);
      return;
    }
    this.attachUncapturedError(device);
    this.probeEnabledFeatures = Array.from(device.features);
    // GPU pass timing is optional: without `timestamp-query` the governor keeps
    // steering off the CPU delta alone (Safari/Firefox today).
    this.destroyFrameTimer();
    this.frameTimer = createGpuFrameTimer(device);
    ctx.onBackendDiagnostics?.({
      enabledFeatures: this.probeEnabledFeatures,
      gpuTimestamps: supportsTimestampQuery(device)
        ? this.frameTimer
          ? 'on'
          : 'off'
        : 'unsupported',
    });

    const shaderPath = readbackShaderOverride() ?? ctx.shaderPath;
    let shaderSource: string;
    try {
      shaderSource = await loadWgslSource(resolveAssetUrl(shaderPath));
    } catch (error) {
      this.discardDevice(device);
      throw error;
    }
    let shaderModule: ShaderModuleWithOptionalInfo;
    try {
      shaderModule = await createWithValidationScope(device, 'module', async () => {
        const created = device.createShaderModule({
          label: `Sacred Breath shader: ${shaderPath}`,
          code: shaderSource,
        }) as ShaderModuleWithOptionalInfo;
        let messages: RendererCompilationMessage[] = [];
        if (typeof created.getCompilationInfo === 'function') {
          messages = normalizeCompilationMessages(await created.getCompilationInfo());
          logCompilationInfo(messages);
        }
        this.probeMessages = messages;
        ctx.onBackendDiagnostics?.({ compilationMessages: messages });
        if (messages.some((message) => message.type === 'error')) {
          throw new GpuStageError('module', 'The WGSL compiler reported one or more errors.');
        }
        return created;
      });
    } catch (error) {
      this.discardDevice(device);
      throw error;
    }
    if (!this.isCurrent(generation)) {
      this.discardDevice(device);
      return;
    }

    // Explicit layout: the overlay pass (and later post/compute passes) bind
    // the same group-0 uniforms bind group as the scene.
    const layouts = createFramePipelineLayouts(device);
    const pipelineDescriptor: GPURenderPipelineDescriptor = {
      label: 'Sacred Breath WebGPU Pipeline',
      layout: layouts.fullscreen,
      vertex: { module: shaderModule, entryPoint: ctx.vertexEntry },
      fragment: { module: shaderModule, entryPoint: ctx.fragmentEntry, targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    };
    let pipeline: GPURenderPipeline;
    try {
      pipeline = await createWithValidationScope(device, 'pipeline', () =>
        typeof device.createRenderPipelineAsync === 'function'
          ? device.createRenderPipelineAsync(pipelineDescriptor)
          : device.createRenderPipeline(pipelineDescriptor),
      );
    } catch (error) {
      this.discardDevice(device);
      throw error;
    }
    const overlayPipeline = await this.createOverlayPipeline(device, layouts.fullscreen);
    if (!this.isCurrent(generation)) {
      this.discardDevice(device);
      return;
    }
    const uniformBuffer = device.createBuffer({
      label: 'Sacred Breath Uniform Buffer',
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
      label: 'Sacred Breath Uniform Bind Group',
      layout: layouts.uniforms,
      entries: [{ binding: UNIFORMS_BINDING, resource: { buffer: uniformBuffer } }],
    });
    if (!this.isCurrent(generation)) {
      this.discardDevice(device);
      return;
    }

    const previousDevice = this.device;
    this.device = device;
    this.inFlightEpoch += 1;
    this.framesInFlight = 0;
    this.destroyField();
    const format = this.format;
    const scenePass = createScenePass((target) => {
      if (target === format) return pipeline;
      const state = this.fieldState;
      return target === HDR_FORMAT && state.status === 'ready' ? state.field.hdrScenePipeline() : null;
    });
    this.loopArgs = {
      pipeline,
      overlayPipeline,
      uniformBuffer,
      bindGroup,
      sceneModule: shaderModule,
      layouts,
      scenePass,
      overlayPass: createOverlayPass(overlayPipeline),
    };
    this.currentTextureFailed = false;
    this.configureCanvas(true);
    this.resizeFn?.();
    if (previousDevice && previousDevice !== device) {
      try { previousDevice.destroy(); } catch { /* already lost */ }
    }

    device.lost.then((info) => {
      if (this.isCurrent(generation)) void this.handleDeviceLoss(info);
    });

    if (!this.detachVisibility) {
      this.detachVisibility = attachVisibilityPause(
        () => this.cancelFrame(),
        () => this.scheduleFrame(),
      );
    }
    // gpu-chores borrow this device rather than requesting a second adapter.
    lendChoreDevice(device, 'adopted renderer GPUDevice');
    ctx.onBackendDiagnostics?.({
      recoveryStatus: recovery ? 'recovered' : 'idle',
      gpuFailureStage: undefined,
      gpuFailureReason: undefined,
    });
    this.reportProbe('ok');
    this.scheduleFrame();
  }

  /**
   * The geometry overlay, drawn as a second pass on the scene's encoder. A
   * failure here only costs the overlay, never the session, matching the old
   * WebGL2 overlay's `init()` returning false.
   */
  private async createOverlayPipeline(
    device: GPUDevice,
    layout: GPUPipelineLayout,
  ): Promise<GPURenderPipeline | null> {
    if (!this.format) return null;
    const format = this.format;
    try {
      const overlayModule = await createWithValidationScope(device, 'module', () =>
        device.createShaderModule({ label: 'Sacred Breath overlay shader', code: buildOverlayWgsl() }),
      );
      const descriptor: GPURenderPipelineDescriptor = {
        label: 'Sacred Breath Overlay Pipeline',
        layout,
        vertex: { module: overlayModule, entryPoint: OVERLAY_VERTEX_ENTRY },
        fragment: {
          module: overlayModule,
          entryPoint: OVERLAY_FRAGMENT_ENTRY,
          targets: [{ format, blend: OVERLAY_BLEND }],
        },
        primitive: { topology: 'triangle-list' },
      };
      return await createWithValidationScope(device, 'pipeline', () =>
        typeof device.createRenderPipelineAsync === 'function'
          ? device.createRenderPipelineAsync(descriptor)
          : device.createRenderPipeline(descriptor),
      );
    } catch (error) {
      console.warn('[WebGPU] geometry overlay disabled:', error);
      return null;
    }
  }

  private isCurrent(generation: number): boolean {
    return !this.cancelled && generation === this.generation;
  }

  private async handleDeviceLoss(info: GPUDeviceLostInfo): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.cancelled) return;
    this.cancelFrame();
    this.loopArgs = null;
    this.destroyField();
    this.destroyFrameTimer();
    lendChoreDevice(null, 'renderer device lost');
    if (this.recoveryAttempted) {
      ctx.onBackendDiagnostics?.({ recoveryStatus: 'failed' });
      this.fail('device', `WebGPU device was lost again (${info.reason}).`, info.message);
      return;
    }
    this.recoveryAttempted = true;
    ctx.onBackendDiagnostics?.({ recoveryStatus: 'recovering' });
    try {
      await this.initializeGeneration(true);
    } catch (error) {
      if (this.cancelled) return;
      ctx.onBackendDiagnostics?.({ recoveryStatus: 'failed' });
      const stage: GpuFailureStage = error instanceof GpuStageError ? error.stage : 'device';
      const detail = error instanceof GpuStageError && error.stage === 'module'
        ? ' Shader module failed.'
        : error instanceof GpuStageError && error.stage === 'pipeline'
          ? ' Render pipeline failed.'
          : '';
      this.fail(stage, `WebGPU device recovery failed.${detail}`, error);
    }
  }

  private trackInFlight(device: GPUDevice): void {
    if (typeof device.queue.onSubmittedWorkDone !== 'function') return;
    const epoch = this.inFlightEpoch;
    this.framesInFlight += 1;
    const settle = () => {
      if (epoch === this.inFlightEpoch) this.framesInFlight = Math.max(0, this.framesInFlight - 1);
    };
    device.queue.onSubmittedWorkDone().then(settle, settle);
  }

  private destroyField(): void {
    this.fieldGeneration += 1;
    if (this.fieldState.status === 'ready') {
      try { this.fieldState.field.destroy(); } catch { /* device already gone */ }
    }
    this.fieldState = { status: 'idle' };
  }

  private reportField(): void {
    const state = this.fieldState;
    const hdrReason = state.status === 'ready' && state.field.hdrStatus() === 'unavailable'
      ? `HDR unavailable: ${state.field.hdrReason() ?? 'unknown'}`
      : undefined;
    this.ctx?.onBackendDiagnostics?.({
      breathFieldStatus: state.status === 'ready' ? 'on' : state.status === 'idle' ? 'off' : state.status,
      breathFieldReason: state.status === 'unavailable' ? state.reason : hdrReason,
    });
  }

  /** Disable the field for this device; the plain scene + overlay keep running. */
  private markFieldUnavailable(reason: string, error?: unknown): void {
    console.warn(`[WebGPU] breath field unavailable: ${reason}`, error ?? '');
    if (this.fieldState.status === 'ready') {
      try { this.fieldState.field.destroy(); } catch { /* device already gone */ }
    }
    this.fieldGeneration += 1;
    this.fieldState = { status: 'unavailable', reason };
    this.reportField();
  }

  /** Kick off the async field build once per device; frames keep rendering without it meanwhile. */
  private ensureField(device: GPUDevice): void {
    const ctx = this.ctx;
    const args = this.loopArgs;
    if (!ctx || !args || !this.format || this.fieldState.status !== 'idle') return;
    const generation = ++this.fieldGeneration;
    this.fieldState = { status: 'building' };
    this.reportField();
    createBreathField({
      device,
      uniformsLayout: args.layouts.uniforms,
      fullscreenLayout: args.layouts.fullscreen,
      swapFormat: this.format,
      sceneModule: args.sceneModule,
      sceneVertexEntry: ctx.vertexEntry,
      sceneFragmentEntry: ctx.fragmentEntry,
      loadSource: (path) => loadWgslSource(resolveAssetUrl(path)),
    }).then(
      (field) => {
        if (generation !== this.fieldGeneration || this.cancelled) {
          field.destroy();
          return;
        }
        this.fieldState = { status: 'ready', field };
        field.onHdrSettled = () => {
          if (this.fieldState.status !== 'ready' || this.fieldState.field !== field) return;
          this.reportField();
          this.scheduleFrame();
        };
        this.reportField();
        this.scheduleFrame();
      },
      (error: unknown) => {
        if (generation !== this.fieldGeneration || this.cancelled) return;
        const reason = error instanceof BreathFieldUnavailableError ? error.message : String(error);
        this.markFieldUnavailable(reason, error);
        this.scheduleFrame();
      },
    );
  }

  private configureCanvas(force: boolean): boolean {
    const context = this.canvasContext;
    const device = this.device;
    const format = this.format;
    const canvas = this.ctx?.canvas;
    if (!context || !device || !format || !canvas || canvas.width === 0 || canvas.height === 0) return false;
    if (!force && this.configuredDevice === device && this.configuredWidth === canvas.width && this.configuredHeight === canvas.height) {
      return true;
    }
    try { context.unconfigure(); } catch { /* older implementations may reject redundant unconfigure */ }
    const config = buildGpuCanvasConfiguration(device, format, { copySrc: this.readbackEnabled });
    context.configure(config);
    this.configuredDevice = device;
    this.configuredWidth = canvas.width;
    this.configuredHeight = canvas.height;
    this.probeCanvasConfig = {
      format: config.format,
      alphaMode: config.alphaMode ?? 'premultiplied',
      colorSpace: config.colorSpace ?? 'srgb',
      usage: config.usage ?? GPUTextureUsage.RENDER_ATTACHMENT,
    };
    this.ctx?.onBackendDiagnostics?.({ canvasConfig: this.probeCanvasConfig });
    return true;
  }

  private cancelFrame(): void {
    if (this.animationFrame != null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.lastFrameMs = null;
  }

  private scheduleFrame(): void {
    if (this.cancelled || this.animationFrame != null || !this.loopArgs) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    this.animationFrame = requestAnimationFrame(() => this.loop());
  }

  private loop(): void {
    this.animationFrame = null;
    const ctx = this.ctx;
    const device = this.device;
    const args = this.loopArgs;
    const context = this.canvasContext;
    if (this.cancelled || !ctx || !device || !args || !context) return;

    // GPU still busy with earlier frames: wait a vsync without sampling the
    // governor, so the next delta carries the real (GPU-bound) frame time.
    if (this.framesInFlight >= MAX_FRAMES_IN_FLIGHT) {
      this.scheduleFrame();
      return;
    }

    const gate = beginFrame(ctx, this.lastFrameMs);
    this.lastFrameMs = gate?.now ?? null;
    if (gate?.governor.changed) this.resizeFn?.();
    if (!gate) {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') this.scheduleFrame();
      return;
    }
    const canvas = ctx.canvas;
    if (canvas.width === 0 || canvas.height === 0) {
      this.scheduleFrame();
      return;
    }

    let view: GPUTextureView;
    let texture: GPUTexture;
    try {
      texture = context.getCurrentTexture();
      view = texture.createView();
      this.currentTextureFailed = false;
    } catch (error) {
      if (!this.currentTextureFailed) {
        this.currentTextureFailed = true;
        try {
          this.configureCanvas(true);
          this.scheduleFrame();
          return;
        } catch (configureError) {
          this.fail('device', 'WebGPU canvas reconfiguration failed.', configureError);
          return;
        }
      }
      this.fail('device', 'WebGPU could not acquire the current canvas texture after reconfiguration.', error);
      return;
    }

    const values = ctx.getUniformSnapshot();
    const readback = this.pendingReadbacks[0];
    const tier = {
      overlayEnabled: readback?.request.overlay ?? gate.governor.overlayEnabled,
      particleLevel: readback?.request.field?.particleLevel ?? gate.governor.particleLevel ?? 0,
      bloomLevels: readback?.request.field?.bloomLevels ?? gate.governor.bloomLevels ?? 0,
      hdrEnabled: readback?.request.field?.hdrEnabled ?? gate.governor.hdrEnabled ?? false,
    };
    const wantsField = tier.particleLevel > 0 || tier.hdrEnabled;
    if (wantsField && this.fieldState.status === 'idle') this.ensureField(device);
    // A capture that asked for the field waits until the build settles.
    if (readback && wantsField && this.fieldState.status === 'building') {
      this.scheduleFrame();
      return;
    }
    if (readback) this.pendingReadbacks.shift();
    const fieldState = this.fieldState;
    const field = wantsField && fieldState.status === 'ready' ? fieldState.field : null;
    if (field && tier.hdrEnabled) field.requestHdr();
    // Same for a capture that asked for HDR: wait for the lazy HDR stage.
    if (readback && field && tier.hdrEnabled && field.hdrStatus() === 'building') {
      this.pendingReadbacks.unshift(readback);
      this.scheduleFrame();
      return;
    }

    const currentTime = readback
      ? readback.request.time
      : ((monotonicNow() - (this.startTime ?? monotonicNow())) / 1000) * ctx.getTimeScale();
    const uniforms = buildUniformBuffer({
      ...values,
      time: currentTime,
      resolution: { x: canvas.width, y: canvas.height },
    });

    // Field frames run inside error scopes: a bad field pass disables the
    // field instead of reaching the uncaptured-error → fatal banner path.
    const scoped = field !== null;
    const scopedGeneration = this.fieldGeneration;
    let scopesOpen = false;
    try {
      device.queue.writeBuffer(args.uniformBuffer, 0, uniforms as GPUAllowSharedBufferSource);
      const timer = this.frameTimer;
      const sampling = timer?.beginFrame() ?? false;
      const hdr = field !== null && tier.hdrEnabled && field.hdrStatus() === 'ready';
      const frame: PassFrame = {
        device,
        uniforms: args.bindGroup,
        tier,
        width: canvas.width,
        height: canvas.height,
        dtSeconds: Math.min(Math.max(gate.deltaMs, 0) / 1000, MAX_SIM_DT_SECONDS),
        frameIndex: this.frameIndex,
        swapView: view,
        swapFormat: this.format ?? texture.format,
        sceneView: hdr && field ? field.hdrTargetView(canvas.width, canvas.height) : view,
        sceneFormat: hdr ? HDR_FORMAT : (this.format ?? texture.format),
        timestampWrites: (label) =>
          !sampling || !timer ? undefined : label === 'scene' ? timer.sceneWrites() : timer.passWrites(label),
      };
      const passes: FramePass[] = field
        ? [field.simPass, args.scenePass, field.particlesPass, field.bloomPass, field.tonemapPass, args.overlayPass]
        : [args.scenePass, args.overlayPass];
      if (scoped) {
        device.pushErrorScope('out-of-memory');
        device.pushErrorScope('validation');
        scopesOpen = true;
      }
      field?.writeFrame(frame);
      const encoder = device.createCommandEncoder();
      const encoded = encodePasses(encoder, frame, passes);
      if (sampling) timer?.resolve(encoder);
      const capture = readback ? encodeReadback(device, encoder, texture) : null;
      device.queue.submit([encoder.finish()]);
      this.frameIndex = (this.frameIndex + 1) >>> 0;
      this.trackInFlight(device);
      if (scopesOpen) {
        scopesOpen = false;
        const validation = device.popErrorScope();
        const oom = device.popErrorScope();
        void Promise.all([validation, oom]).then(([validationError, oomError]) => {
          const error = validationError ?? oomError;
          if (error && scopedGeneration === this.fieldGeneration && this.fieldState.status === 'ready') {
            this.markFieldUnavailable(`field frame failed: ${error.message}`, error);
          }
        }, () => { /* device lost: handled by device.lost */ });
      }
      if (readback && capture) {
        capture.finish(encoded).then(readback.resolve, readback.reject);
      }
      // Fire-and-forget: the map resolves on a later task, never inside this rAF.
      if (sampling) timer?.readback();
      const gpuPassMs = timer?.lastGpuPassMs() ?? null;
      if (gpuPassMs != null) ctx.governor.noteGpuPass(gate.now, gpuPassMs, timer?.lastPassBreakdown() ?? undefined);
    } catch (error) {
      if (scopesOpen) {
        void device.popErrorScope().catch(() => undefined);
        void device.popErrorScope().catch(() => undefined);
      }
      if (scoped) {
        // Encoding a field pass threw synchronously: shed the field, keep the session.
        this.markFieldUnavailable('field frame threw', error);
        this.scheduleFrame();
        return;
      }
      this.fail('device', 'WebGPU render loop failed.', error);
      return;
    }
    this.scheduleFrame();
  }

  stop(): void {
    this.cancelled = true;
    for (const pending of this.pendingReadbacks.splice(0)) pending.reject(new Error('renderer stopped'));
    if (this.readbackEnabled && typeof window !== 'undefined') delete window.__sacredBreathReadback;
    lendChoreDevice(null, 'renderer stopped');
    this.generation += 1;
    this.cancelFrame();
    this.detachVisibility?.();
    this.detachVisibility = null;
    this.ro?.disconnect();
    this.ro = null;
    this.resizeFn = null;
    this.loopArgs = null;
    this.destroyField();
    this.destroyFrameTimer();
    this.detachUncapturedError();
    try { this.canvasContext?.unconfigure(); } catch { /* optional cleanup */ }
    try { this.device?.destroy(); } catch { /* ignore */ }
    this.device = null;
    this.canvasContext = null;
    this.configuredDevice = null;
    this.ctx = null;
  }
}
