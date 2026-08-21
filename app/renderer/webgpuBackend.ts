import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import { buildUniformBuffer, UNIFORM_BUFFER_SIZE } from '../lib/shaderContract';
import { loadWgslSource } from '../lib/wgslModules';
import type {
  RendererAdapterInfo,
  RendererCompilationMessage,
} from '../types/renderer';
import { getWebGPUAdapterOptions } from './adapterOptions';
import { resizeCanvasForDpr } from './canvasUtils';
import { attachVisibilityPause, beginFrame } from './frameGate';
import type { RendererBackend, RendererBackendContext } from './types';

const DEVICE_LABEL = 'Sacred Breath WebGPU Device';

class ShaderCompilationError extends Error {}

type ShaderModuleWithOptionalInfo = GPUShaderModule & {
  getCompilationInfo?: () => Promise<GPUCompilationInfo>;
};

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
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
  } | null = null;
  private ctx: RendererBackendContext | null = null;

  async start(ctx: RendererBackendContext): Promise<void> {
    this.ctx = ctx;
    this.cancelled = false;
    this.recoveryAttempted = false;
    this.startTime = Date.now();
    this.canvasContext = ctx.canvas.getContext('webgpu');
    if (!this.canvasContext) {
      ctx.onFatalError('Unable to create a WebGPU canvas context.');
      return;
    }
    this.format = navigator.gpu?.getPreferredCanvasFormat() ?? null;
    if (!this.format) {
      ctx.onFatalError('WebGPU is unavailable.');
      return;
    }

    this.resizeFn = () => {
      try {
        const resized = resizeCanvasForDpr(
          ctx.canvas,
          ctx.getMaxDevicePixelRatio(),
          () => this.configureCanvas(true),
        );
        if (resized) ctx.overlay?.resize(ctx.getMaxDevicePixelRatio());
      } catch (error) {
        ctx.onFatalError('Failed to configure the WebGPU context after resize.', error);
      }
    };
    this.resizeFn();
    this.ro = new ResizeObserver(this.resizeFn);
    this.ro.observe(ctx.container);

    try {
      await this.initializeGeneration(false);
    } catch (error) {
      if (this.cancelled) return;
      const reason = error instanceof ShaderCompilationError
        ? 'WebGPU shader compilation failed.'
        : 'WebGPU initialization failed.';
      ctx.onFatalError(reason, error);
    }
  }

  private async initializeGeneration(recovery: boolean): Promise<void> {
    const ctx = this.ctx;
    const gpu = navigator.gpu;
    if (!ctx || !gpu || !this.canvasContext || !this.format) {
      throw new Error('WebGPU is unavailable.');
    }
    const generation = ++this.generation;
    const adapter = await gpu.requestAdapter(getWebGPUAdapterOptions(ctx.performanceMode));
    if (!adapter) throw new Error('No WebGPU adapter was returned.');
    if (!this.isCurrent(generation)) return;
    ctx.onBackendDiagnostics?.({ adapterInfo: readAdapterInfo(adapter) });

    const device = await adapter.requestDevice({
      label: DEVICE_LABEL,
      requiredFeatures: [],
      requiredLimits: {},
    });
    if (!this.isCurrent(generation)) {
      device.destroy();
      return;
    }

    let shaderSource: string;
    try {
      shaderSource = await loadWgslSource(resolveAssetUrl(ctx.shaderPath));
    } catch (error) {
      device.destroy();
      throw error;
    }
    const shaderModule = device.createShaderModule({
      label: `Sacred Breath shader: ${ctx.shaderPath}`,
      code: shaderSource,
    }) as ShaderModuleWithOptionalInfo;
    if (!this.isCurrent(generation)) {
      device.destroy();
      return;
    }

    if (typeof shaderModule.getCompilationInfo === 'function') {
      const messages = normalizeCompilationMessages(await shaderModule.getCompilationInfo());
      if (!this.isCurrent(generation)) {
        device.destroy();
        return;
      }
      ctx.onBackendDiagnostics?.({ compilationMessages: messages });
      if (messages.some((message) => message.type === 'error')) {
        device.destroy();
        throw new ShaderCompilationError('The WGSL compiler reported one or more errors.');
      }
    } else {
      ctx.onBackendDiagnostics?.({ compilationMessages: [] });
    }

    const pipeline = device.createRenderPipeline({
      label: 'Sacred Breath WebGPU Pipeline',
      layout: 'auto',
      vertex: { module: shaderModule, entryPoint: ctx.vertexEntry },
      fragment: { module: shaderModule, entryPoint: ctx.fragmentEntry, targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
    });
    const uniformBuffer = device.createBuffer({
      label: 'Sacred Breath Uniform Buffer',
      size: UNIFORM_BUFFER_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
      label: 'Sacred Breath Uniform Bind Group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });
    if (!this.isCurrent(generation)) {
      device.destroy();
      return;
    }

    const previousDevice = this.device;
    this.device = device;
    this.loopArgs = { pipeline, uniformBuffer, bindGroup };
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
    if (recovery) ctx.onBackendDiagnostics?.({ recoveryStatus: 'recovered' });
    else ctx.onBackendDiagnostics?.({ recoveryStatus: 'idle' });
    this.scheduleFrame();
  }

  private isCurrent(generation: number): boolean {
    return !this.cancelled && generation === this.generation;
  }

  private async handleDeviceLoss(info: GPUDeviceLostInfo): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || this.cancelled) return;
    this.cancelFrame();
    this.loopArgs = null;
    if (this.recoveryAttempted) {
      ctx.onBackendDiagnostics?.({ recoveryStatus: 'failed' });
      ctx.onFatalError(`WebGPU device was lost again (${info.reason}).`, info.message);
      return;
    }
    this.recoveryAttempted = true;
    ctx.onBackendDiagnostics?.({ recoveryStatus: 'recovering' });
    try {
      await this.initializeGeneration(true);
    } catch (error) {
      if (this.cancelled) return;
      ctx.onBackendDiagnostics?.({ recoveryStatus: 'failed' });
      const detail = error instanceof ShaderCompilationError ? ' Shader compilation failed.' : '';
      ctx.onFatalError(`WebGPU device recovery failed.${detail}`, error);
    }
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
    context.configure({ device, format, alphaMode: 'premultiplied' });
    this.configuredDevice = device;
    this.configuredWidth = canvas.width;
    this.configuredHeight = canvas.height;
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
    try {
      view = context.getCurrentTexture().createView();
      this.currentTextureFailed = false;
    } catch (error) {
      if (!this.currentTextureFailed) {
        this.currentTextureFailed = true;
        try {
          this.configureCanvas(true);
          this.scheduleFrame();
          return;
        } catch (configureError) {
          ctx.onFatalError('WebGPU canvas reconfiguration failed.', configureError);
          return;
        }
      }
      ctx.onFatalError('WebGPU could not acquire the current canvas texture after reconfiguration.', error);
      return;
    }

    const values = ctx.getUniformSnapshot();
    const currentTime = ((Date.now() - (this.startTime ?? Date.now())) / 1000) * ctx.getTimeScale();
    const uniforms = buildUniformBuffer({
      ...values,
      time: currentTime,
      resolution: { x: canvas.width, y: canvas.height },
    });

    try {
      device.queue.writeBuffer(args.uniformBuffer, 0, uniforms as GPUAllowSharedBufferSource);
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view, clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }],
      });
      pass.setPipeline(args.pipeline);
      pass.setBindGroup(0, args.bindGroup);
      pass.draw(6);
      pass.end();
      device.queue.submit([encoder.finish()]);
      if (gate.governor.overlayEnabled) ctx.overlay?.render(currentTime, values);
    } catch (error) {
      ctx.onFatalError('WebGPU render loop failed.', error);
      return;
    }
    this.scheduleFrame();
  }

  stop(): void {
    this.cancelled = true;
    this.generation += 1;
    this.cancelFrame();
    this.detachVisibility?.();
    this.detachVisibility = null;
    this.ro?.disconnect();
    this.ro = null;
    this.resizeFn = null;
    this.loopArgs = null;
    try { this.canvasContext?.unconfigure(); } catch { /* optional cleanup */ }
    try { this.device?.destroy(); } catch { /* ignore */ }
    this.device = null;
    this.canvasContext = null;
    this.configuredDevice = null;
    this.ctx = null;
  }
}
