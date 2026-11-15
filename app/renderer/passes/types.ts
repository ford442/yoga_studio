import type { GovernorSnapshot } from '../frameGovernor';

/**
 * One frame's worth of state every pass may read. Built once per rAF by the
 * WebGPU backend; passes never reach back into the backend.
 */
export interface PassFrame {
  readonly device: GPUDevice;
  /** Group 0: the shared 72-byte `shaderContract` uniforms. */
  readonly uniforms: GPUBindGroup;
  /** Governor tier for this frame (after any debug override). */
  readonly tier: Pick<GovernorSnapshot, 'overlayEnabled' | 'particleLevel' | 'bloomLevels' | 'hdrEnabled'>;
  readonly width: number;
  readonly height: number;
  /** Clamped frame delta in seconds (sim step). */
  readonly dtSeconds: number;
  /** Monotonic frame counter (respawn hashing, ping-pong parity). */
  readonly frameIndex: number;
  /** This frame's swap-chain texture view. */
  readonly swapView: GPUTextureView;
  readonly swapFormat: GPUTextureFormat;
  /**
   * Where scene-space passes draw (scene, particles): the swap chain, or the
   * HDR target while `tier.hdrEnabled` and the field is ready.
   */
  readonly sceneView: GPUTextureView;
  readonly sceneFormat: GPUTextureFormat;
  /** `timestampWrites` for a pass with this label, or undefined when this frame isn't sampled. */
  timestampWrites(label: string): GPURenderPassTimestampWrites | undefined;
}

/**
 * A unit of GPU work on the frame's single command encoder. The backend owns
 * an ordered list and calls `encode` for every pass whose `enabled` is true,
 * so turning a layer on or off is a governor decision, never a remount.
 *
 * This is also the interface the #77 layer graph can adopt: a layer is a
 * labelled pass with an `enabled` predicate over the frame.
 */
export interface FramePass {
  /** Timestamp label; passes sharing a label are summed in the governor breakdown. */
  readonly label: string;
  enabled(frame: PassFrame): boolean;
  encode(encoder: GPUCommandEncoder, frame: PassFrame): void;
}

/** Run `passes` in order; returns the labels that encoded (for diagnostics / readback). */
export function encodePasses(encoder: GPUCommandEncoder, frame: PassFrame, passes: readonly FramePass[]): string[] {
  const encoded: string[] = [];
  for (const pass of passes) {
    if (!pass.enabled(frame)) continue;
    pass.encode(encoder, frame);
    encoded.push(pass.label);
  }
  return encoded;
}
