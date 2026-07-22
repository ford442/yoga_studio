import { resizeCanvasForDpr } from './canvasUtils';
import type { RendererBackend, RendererBackendContext } from './types';

/** Last-resort fallback when neither WebGPU nor WebGL2 is available: a static gradient, no animation loop. */
export class StaticBackend implements RendererBackend {
  readonly mode = 'static' as const;

  private ro: ResizeObserver | null = null;
  private ctx: RendererBackendContext | null = null;

  start(ctx: RendererBackendContext): void {
    this.ctx = ctx;
    const { canvas } = ctx;

    const draw = () => {
      const c2d = canvas.getContext('2d');
      if (!c2d || canvas.width === 0 || canvas.height === 0) return;
      const gradient = c2d.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) / 2
      );
      gradient.addColorStop(0, '#1a0b2e');
      gradient.addColorStop(1, '#03010a');
      c2d.fillStyle = gradient;
      c2d.fillRect(0, 0, canvas.width, canvas.height);
    };

    const resize = () => {
      resizeCanvasForDpr(canvas, ctx.getMaxDevicePixelRatio(), draw);
      draw();
    };

    resize();
    this.ro = new ResizeObserver(resize);
    this.ro.observe(ctx.container);
  }

  stop(): void {
    this.ro?.disconnect();
    this.ro = null;
    this.ctx = null;
  }
}
