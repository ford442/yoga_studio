import { UNIFORM_BUFFER_SIZE } from '../lib/shaderContract';

/**
 * Explicit bind-group / pipeline layouts for the WebGPU practice path.
 *
 * `layout: 'auto'` gives every pipeline a private bind-group layout, so a bind
 * group built for the scene can't be bound to the overlay (or a later post /
 * compute pass). Owning the layout here lets every pass on the frame's one
 * command encoder share group 0: the 72-byte `shaderContract` uniforms.
 */

/** Every fullscreen pass draws one oversized triangle: no quad, no vertex buffer. */
export const FULLSCREEN_VERTEX_COUNT = 3;

/** Group 0, binding 0: `var<uniform> u: Uniforms` in every scene/overlay/post shader. */
export const UNIFORMS_GROUP = 0;
export const UNIFORMS_BINDING = 0;

export interface FramePipelineLayouts {
  uniforms: GPUBindGroupLayout;
  /** Layout for every fullscreen render pass that reads only the shared uniforms. */
  fullscreen: GPUPipelineLayout;
}

export function createFramePipelineLayouts(device: GPUDevice): FramePipelineLayouts {
  const uniforms = device.createBindGroupLayout({
    label: 'Sacred Breath Uniforms Layout',
    entries: [{
      binding: UNIFORMS_BINDING,
      // COMPUTE so a future bloom / chores pass can bind the same group 0.
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
      buffer: { type: 'uniform', minBindingSize: UNIFORM_BUFFER_SIZE },
    }],
  });
  const fullscreen = device.createPipelineLayout({
    label: 'Sacred Breath Fullscreen Pipeline Layout',
    bindGroupLayouts: [uniforms],
  });
  return { uniforms, fullscreen };
}
