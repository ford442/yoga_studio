/**
 * Debug-only swap-chain readback (`?gpu_readback`).
 *
 * Headless Chrome never puts a WebGPU canvas into a screenshot, so the only
 * honest pixel check is copying the frame's texture into a mappable buffer.
 * With the flag set the canvas is configured with `COPY_SRC`, and
 * `window.__sacredBreathReadback({ time })` renders the next frame at a fixed
 * `time` uniform and resolves with its bytes. Without the flag nothing here
 * runs and the canvas usage stays `RENDER_ATTACHMENT` only.
 */

import type { FieldTier } from './frameGovernor';

export const GPU_READBACK_PARAM = 'gpu_readback';

export interface ReadbackRequest {
  /** Fixed `time` uniform for the captured frame, so captures are reproducible. */
  time: number;
  /** Force the geometry overlay on/off for the captured frame, independent of the governor. */
  overlay?: boolean;
  /** Force breath-field knobs for the captured frame (the field must be buildable). */
  field?: Partial<FieldTier>;
}

export interface ReadbackResult {
  width: number;
  height: number;
  format: GPUTextureFormat;
  /** Tightly packed rows (padding stripped), base64 so it crosses `page.evaluate`. */
  base64: string;
  /** Labels of the passes that encoded this frame, in order. */
  passes: string[];
}

export type ReadbackHook = (request?: Partial<ReadbackRequest>) => Promise<ReadbackResult>;

declare global {
  interface Window {
    __sacredBreathReadback?: ReadbackHook;
  }
}

/** `?gpu_shader=<file>.wgsl` (only honoured together with `?gpu_readback`) pins the scene shader for a capture. */
export const GPU_SHADER_PARAM = 'gpu_shader';

export function readbackShaderOverride(): string | null {
  if (!isReadbackEnabled()) return null;
  try {
    const value = new URLSearchParams(window.location.search).get(GPU_SHADER_PARAM);
    return value && /^[\w-]+\.wgsl$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function isReadbackEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has(GPU_READBACK_PARAM);
  } catch {
    return false;
  }
}

/** `copyTextureToBuffer` rows must be 256-byte aligned. */
export const paddedBytesPerRow = (width: number, bytesPerPixel = 4): number =>
  Math.ceil((width * bytesPerPixel) / 256) * 256;

/** Strip row padding from a mapped readback. */
export function unpadRows(padded: Uint8Array, width: number, height: number, bytesPerPixel = 4): Uint8Array {
  const rowBytes = width * bytesPerPixel;
  const stride = paddedBytesPerRow(width, bytesPerPixel);
  if (stride === rowBytes) return padded.slice(0, rowBytes * height);
  const out = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    out.set(padded.subarray(y * stride, y * stride + rowBytes), y * rowBytes);
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Encode a copy of `texture` into a fresh MAP_READ buffer on `encoder`. Call
 * `finish` after the encoder has been submitted.
 */
export function encodeReadback(
  device: GPUDevice,
  encoder: GPUCommandEncoder,
  texture: GPUTexture,
): { finish: (passes: string[]) => Promise<ReadbackResult> } {
  const { width, height, format } = texture;
  const bytesPerRow = paddedBytesPerRow(width);
  const buffer = device.createBuffer({
    label: 'Sacred Breath debug readback',
    size: bytesPerRow * height,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow, rowsPerImage: height }, { width, height });
  return {
    async finish(passes) {
      await buffer.mapAsync(GPUMapMode.READ);
      const padded = new Uint8Array(buffer.getMappedRange().slice(0));
      buffer.unmap();
      buffer.destroy();
      return { width, height, format, base64: toBase64(unpadRows(padded, width, height)), passes };
    },
  };
}
