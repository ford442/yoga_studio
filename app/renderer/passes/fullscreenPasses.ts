import { SCENE_PASS_LABEL } from '../gpuTimestamps';
import { FULLSCREEN_VERTEX_COUNT, UNIFORMS_GROUP } from '../pipelineLayout';
import type { FramePass, PassFrame } from './types';

export const OVERLAY_PASS_LABEL = 'overlay';

/**
 * The technique's scene shader. `pipelineFor` returns the pipeline compiled
 * for the frame's scene target format (swap chain, or rgba16float in HDR);
 * it clears that target, so it must run before anything else draws into it.
 */
export function createScenePass(pipelineFor: (format: GPUTextureFormat) => GPURenderPipeline | null): FramePass {
  return {
    label: SCENE_PASS_LABEL,
    enabled: (frame) => pipelineFor(frame.sceneFormat) !== null,
    encode(encoder, frame) {
      const pipeline = pipelineFor(frame.sceneFormat);
      if (!pipeline) return;
      const timestampWrites = frame.timestampWrites(SCENE_PASS_LABEL);
      const pass = encoder.beginRenderPass({
        label: 'Sacred Breath scene pass',
        colorAttachments: [{ view: frame.sceneView, clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }],
        ...(timestampWrites ? { timestampWrites } : {}),
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(UNIFORMS_GROUP, frame.uniforms);
      pass.draw(FULLSCREEN_VERTEX_COUNT);
      pass.end();
    },
  };
}

/**
 * The geometry overlay, screen-blended onto the swap chain (always the final
 * 8-bit image, after any tone map). Null pipeline = overlay failed to compile.
 */
export function createOverlayPass(pipeline: GPURenderPipeline | null): FramePass {
  return {
    label: OVERLAY_PASS_LABEL,
    enabled: (frame: PassFrame) => pipeline !== null && frame.tier.overlayEnabled,
    encode(encoder, frame) {
      if (!pipeline) return;
      const timestampWrites = frame.timestampWrites(OVERLAY_PASS_LABEL);
      const pass = encoder.beginRenderPass({
        label: 'Sacred Breath overlay pass',
        colorAttachments: [{ view: frame.swapView, loadOp: 'load', storeOp: 'store' }],
        ...(timestampWrites ? { timestampWrites } : {}),
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(UNIFORMS_GROUP, frame.uniforms);
      pass.draw(FULLSCREEN_VERTEX_COUNT);
      pass.end();
    },
  };
}
