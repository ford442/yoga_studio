import type { RendererMode } from '../types/renderer';
import { StaticBackend } from './staticBackend';
import type { RendererBackend, RendererBackendContext } from './types';
import { WebGL2Backend } from './webgl2Backend';
import { WebGPUBackend } from './webgpuBackend';

export interface RendererCapabilities {
  webgpu: boolean;
  webgl2: boolean;
}

/** Probe what the current browser claims to support (WebGPU may still fail to init an adapter/device). */
export const probeCapabilities = (): RendererCapabilities => {
  if (typeof navigator === 'undefined') return { webgpu: false, webgl2: false };
  const webgpu = Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
  let webgl2 = false;
  if (typeof document !== 'undefined') {
    try {
      webgl2 = Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      webgl2 = false;
    }
  }
  return { webgpu, webgl2 };
};

/** The order backends are attempted in, given what the browser claims to support. Always terminates at 'static'. */
export const fallbackOrder = (caps: RendererCapabilities): RendererMode[] => {
  const order: RendererMode[] = [];
  if (caps.webgpu) order.push('webgpu');
  if (caps.webgl2) order.push('webgl2');
  order.push('static');
  return order;
};

/** The mode to try first, given capabilities. */
export const pickInitialMode = (caps: RendererCapabilities): RendererMode => fallbackOrder(caps)[0];

/** The next mode to try after `mode` fails. Terminal at 'static'. */
export const getNextMode = (mode: RendererMode, caps: RendererCapabilities): RendererMode => {
  const order = fallbackOrder(caps);
  const index = order.indexOf(mode);
  if (index === -1 || index === order.length - 1) return 'static';
  return order[index + 1];
};

export const createBackend = (mode: RendererMode): RendererBackend => {
  switch (mode) {
    case 'webgpu':
      return new WebGPUBackend();
    case 'webgl2':
      return new WebGL2Backend();
    case 'static':
      return new StaticBackend();
  }
};

export interface MountRendererOptions extends Omit<RendererBackendContext, 'onFatalError'> {
  mode: RendererMode;
  caps: RendererCapabilities;
  /** Fired when the active backend hits an unrecoverable error (device/context loss, init failure). */
  onFallback: (nextMode: RendererMode, reason: string) => void;
}

/**
 * Instantiates and starts the backend for `mode`, wiring device-lost/context-lost
 * and init-failure callbacks to advance the fallback chain. Returns a cleanup
 * function that stops the backend; call it before mounting a new mode.
 */
export const mountRenderer = (options: MountRendererOptions): (() => void) => {
  const { mode, caps, onFallback, ...ctxBase } = options;
  const backend = createBackend(mode);
  let stopped = false;

  const ctx: RendererBackendContext = {
    ...ctxBase,
    onFatalError: (reason, error) => {
      if (stopped) return;
      console.warn(`[renderer] ${mode} backend failed: ${reason}`, error);
      onFallback(getNextMode(mode, caps), reason);
    },
  };

  void backend.start(ctx);

  return () => {
    stopped = true;
    backend.stop();
  };
};
