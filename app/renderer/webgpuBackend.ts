import { resolveAssetUrl } from '../lib/resolveAssetUrl';
import { buildUniformBuffer, UNIFORM_BUFFER_SIZE } from '../lib/shaderContract';
import { resizeCanvasForDpr } from './canvasUtils';
import { attachVisibilityPause, beginFrame } from './frameGate';
import type { RendererBackend, RendererBackendContext } from './types';

/** WebGPU renderer: the primary pipeline, used whenever the browser supports it. */
export class WebGPUBackend implements RendererBackend {
  readonly mode = 'webgpu' as const;

  private cancelled = false;
  private ro: ResizeObserver | null = null;
  private device: GPUDevice | null = null;
  private animationFrame: number | null = null;
  private startTime: number | null = null;
  private lastFrameMs: number | null = null;
  private detachVisibility: (() => void) | null = null;
  private resizeFn: (() => void) | null = null;
  private loopArgs: {
    context: GPUCanvasContext;
    pipeline: GPURenderPipeline;
    uniformBuffer: GPUBuffer;
    bindGroup: GPUBindGroup;
  } | null = null;
  private ctx: RendererBackendContext | null = null;

  async start(ctx: RendererBackendContext): Promise<void> {
    this.ctx = ctx;
    this.cancelled = false;
    const { canvas, shaderPath, vertexEntry, fragmentEntry } = ctx;
    this.startTime = Date.now();

    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter) {
      ctx.onFatalError('WebGPU is unavailable.');
      return;
    }

    let device: GPUDevice;
    try {
      device = await adapter.requestDevice();
    } catch (error) {
      ctx.onFatalError('Unable to request a WebGPU device.', error);
      return;
    }

    if (this.cancelled) {
      device.destroy();
      return;
    }
    this.device = device;
    device.lost.then((info) => {
      if (!this.cancelled) ctx.onFatalError(`WebGPU device was lost (${info.reason}).`, info.message);
    });

    const context = canvas.getContext('webgpu');
    if (!context) {
      ctx.onFatalError('Unable to create a WebGPU canvas context.');
      return;
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    const configure = () => {
      try {
        context.configure({ device, format, alphaMode: 'premultiplied' });
      } catch (error) {
        ctx.onFatalError('Failed to configure the WebGPU context.', error);
      }
    };

    const resize = () => {
      resizeCanvasForDpr(canvas, ctx.getMaxDevicePixelRatio(), configure);
      ctx.overlay?.resize(ctx.getMaxDevicePixelRatio());
    };
    this.resizeFn = resize;

    resize();
    this.ro = new ResizeObserver(resize);
    this.ro.observe(ctx.container);

    let pipeline: GPURenderPipeline | null = null;
    let uniformBuffer: GPUBuffer | null = null;
    let bindGroup: GPUBindGroup | null = null;

    try {
      const shaderUrl = resolveAssetUrl(shaderPath);
      const shaderResponse = await fetch(shaderUrl);
      if (!shaderResponse.ok) {
        throw new Error(`Shader load failed: ${shaderResponse.status} ${shaderUrl}`);
      }

      const shaderCode = await shaderResponse.text();
      const shaderModule = device.createShaderModule({ code: shaderCode });
      pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: vertexEntry },
        fragment: { module: shaderModule, entryPoint: fragmentEntry, targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      // Uniform buffer size comes from the shared shader contract.
      uniformBuffer = device.createBuffer({
        size: UNIFORM_BUFFER_SIZE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });
    } catch (error) {
      ctx.onFatalError('WebGPU pipeline setup failed.', error);
      return;
    }

    // Force a final size measurement + reconfigure now that the (potentially
    // slow) shader fetch + pipeline creation is complete. This guarantees the
    // canvas has its real layout size even if the early measurement was 0.
    resize();

    this.loopArgs = { context, pipeline, uniformBuffer, bindGroup };
    this.detachVisibility = attachVisibilityPause(
      () => this.cancelFrame(),
      () => this.scheduleFrame(),
    );
    this.scheduleFrame();
  }

  private cancelFrame(): void {
    if (this.animationFrame) {
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
    if (this.cancelled || !ctx || !device || !args) return;

    const gate = beginFrame(ctx, this.lastFrameMs);
    if (gate) this.lastFrameMs = gate.now;
    else this.lastFrameMs = null;

    if (gate?.governor.changed) this.resizeFn?.();

    if (!gate) {
      // Paused (completion / hidden) — only restart when visible; visibility
      // listener handles hidden→visible. Completion pause keeps a cheap poll.
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        this.animationFrame = requestAnimationFrame(() => this.loop());
      }
      return;
    }

    const { context, pipeline, uniformBuffer, bindGroup } = args;
    const canvas = ctx.canvas;
    if (canvas.width === 0 || canvas.height === 0) {
      this.scheduleFrame();
      return;
    }

    const values = ctx.getUniformSnapshot();
    const start = this.startTime ?? Date.now();
    const currentTime = ((Date.now() - start) / 1000) * ctx.getTimeScale();

    const uniforms = buildUniformBuffer({
      ...values,
      time: currentTime,
      resolution: { x: canvas.width, y: canvas.height },
    });

    try {
      device.queue.writeBuffer(uniformBuffer, 0, uniforms as GPUAllowSharedBufferSource);

      const encoder = device.createCommandEncoder();
      const view = context.getCurrentTexture().createView();

      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view, clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }],
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
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
    this.cancelFrame();
    this.detachVisibility?.();
    this.detachVisibility = null;
    this.ro?.disconnect();
    this.ro = null;
    this.resizeFn = null;
    this.loopArgs = null;
    if (this.device) {
      try {
        this.device.destroy();
      } catch {
        /* ignore */
      }
      this.device = null;
    }
    this.ctx = null;
  }
}
