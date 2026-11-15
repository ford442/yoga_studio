import {
  buildDrawArgsReset,
  buildFieldParams,
  DRAW_ARGS_LAYOUT,
  FIELD_PARAMS_LAYOUT,
  PARTICLE_STRIDE,
} from '../../lib/shaderContract';
import { MAX_BLOOM_LEVELS, PARTICLE_COUNTS } from '../frameGovernor';
import { createWithValidationScope, GpuStageError } from '../gpuValidation';
import { FULLSCREEN_VERTEX_COUNT, UNIFORMS_GROUP } from '../pipelineLayout';
import type { FramePass, PassFrame } from '../passes/types';

/**
 * The "living breath field": a GPU particle sim driven by breath phase and
 * pointer, plus the optional HDR target, dual-filter bloom and tone map.
 *
 * Everything here is optional. `createBreathField` either returns a ready
 * field or throws `BreathFieldUnavailableError`; the backend then keeps the
 * plain scene + overlay path and never raises the fatal banner for it.
 */

/** HDR scene target and bloom mip format (filterable + blendable in core WebGPU). */
export const HDR_FORMAT: GPUTextureFormat = 'rgba16float';
/** Group 1 for every field pass (group 0 stays the shared uniforms). */
export const FIELD_GROUP = 1;
export const SIM_WORKGROUP_SIZE = 64;
/** Pointer/touch influence radius, pointer-space units (canvas heights). */
export const POINTER_RADIUS = 0.18;
/** Particle core gain on the HDR target, so bright cores clear the bloom threshold. */
export const HDR_PARTICLE_GAIN = 2.5;

export const FIELD_MODULES = {
  sim: 'breath-field/sim.wgsl',
  particles: 'breath-field/particles.wgsl',
  post: 'breath-field/post.wgsl',
} as const;

export const FIELD_PASS_LABELS = {
  sim: 'field-sim',
  particles: 'particles',
  bloom: 'bloom',
  tonemap: 'tonemap',
} as const;

/** Storage buffers the sim's compute stage binds at once (in, out, visible, draw args). */
export const SIM_STORAGE_BUFFERS = 4;
/** Storage buffers the particle vertex stage reads (particles, visible). */
export const DRAW_VERTEX_STORAGE_BUFFERS = 2;

export class BreathFieldUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BreathFieldUnavailableError';
  }
}

/**
 * Why this device can't run the field, or null if it can. Core WebGPU
 * guarantees 8 storage buffers per stage, but compatibility-mode devices may
 * report 0 in the vertex stage.
 */
export function fieldLimitProblem(limits: GPUSupportedLimits): string | null {
  if (limits.maxStorageBuffersPerShaderStage < SIM_STORAGE_BUFFERS) {
    return `maxStorageBuffersPerShaderStage ${limits.maxStorageBuffersPerShaderStage} < ${SIM_STORAGE_BUFFERS}`;
  }
  const vertexLimit = (limits as GPUSupportedLimits & { maxStorageBuffersInVertexStage?: number })
    .maxStorageBuffersInVertexStage;
  if (typeof vertexLimit === 'number' && vertexLimit < DRAW_VERTEX_STORAGE_BUFFERS) {
    return `maxStorageBuffersInVertexStage ${vertexLimit} < ${DRAW_VERTEX_STORAGE_BUFFERS}`;
  }
  const maxParticles = PARTICLE_COUNTS[PARTICLE_COUNTS.length - 1] ?? 0;
  if (limits.maxStorageBufferBindingSize < maxParticles * PARTICLE_STRIDE) {
    return `maxStorageBufferBindingSize ${limits.maxStorageBufferBindingSize} < ${maxParticles * PARTICLE_STRIDE}`;
  }
  return null;
}

/** Bloom mip sizes: each level halves the one above (floor), never below 1. */
export function bloomMipSizes(width: number, height: number, levels = MAX_BLOOM_LEVELS): Array<[number, number]> {
  const sizes: Array<[number, number]> = [];
  let w = width;
  let h = height;
  for (let i = 0; i < levels; i += 1) {
    w = Math.max(1, Math.floor(w / 2));
    h = Math.max(1, Math.floor(h / 2));
    sizes.push([w, h]);
  }
  return sizes;
}

export interface BreathFieldDeps {
  device: GPUDevice;
  /** Group-0 uniforms layout shared with the scene/overlay passes. */
  uniformsLayout: GPUBindGroupLayout;
  /** Pipeline layout of the fullscreen scene pass (group 0 only). */
  fullscreenLayout: GPUPipelineLayout;
  swapFormat: GPUTextureFormat;
  /** The technique's compiled scene module, re-targeted at the HDR format. */
  sceneModule: GPUShaderModule;
  sceneVertexEntry: string;
  sceneFragmentEntry: string;
  /** Fetch + `@include`-compose a public WGSL module (`loadWgslSource`). */
  loadSource: (publicPath: string) => Promise<string>;
}

export type HdrStageStatus = 'idle' | 'building' | 'ready' | 'unavailable';

export interface BreathField {
  /**
   * The HDR half (scene re-targeted at `HDR_FORMAT`, bloom, tone map) builds
   * on first request: compiling the scene shader a second time is the
   * expensive part, and particles-only sessions never need it.
   */
  requestHdr(): void;
  hdrStatus(): HdrStageStatus;
  /** Why the HDR stage could not be built, if it couldn't. */
  hdrReason(): string | undefined;
  /** The technique's scene compiled for `HDR_FORMAT`, once `hdrStatus()` is 'ready'. */
  hdrScenePipeline(): GPURenderPipeline | null;
  /** Ordered field passes; the backend interleaves them with scene/overlay. */
  readonly simPass: FramePass;
  readonly particlesPass: FramePass;
  readonly bloomPass: FramePass;
  readonly tonemapPass: FramePass;
  /** (Re)allocate the HDR target and bloom chain for this size; returns the HDR view. */
  hdrTargetView(width: number, height: number): GPUTextureView;
  /** Notified when the lazy HDR stage settles (so the backend can redraw / report). */
  onHdrSettled?: () => void;
  /** Per-frame queue writes (sim params, draw-args reset). Call before submit. */
  writeFrame(frame: PassFrame): void;
  destroy(): void;
}

async function compileModule(device: GPUDevice, label: string, code: string): Promise<GPUShaderModule> {
  return createWithValidationScope(device, 'module', async () => {
    const created = device.createShaderModule({ label, code });
    const info = typeof created.getCompilationInfo === 'function' ? await created.getCompilationInfo() : null;
    const errors = info ? Array.from(info.messages).filter((message) => message.type === 'error') : [];
    if (errors.length > 0) {
      const first = errors[0]!;
      throw new GpuStageError('module', `${label}: ${first.lineNum}:${first.linePos} ${first.message}`);
    }
    return created;
  });
}

const renderPipeline = (device: GPUDevice, descriptor: GPURenderPipelineDescriptor) =>
  createWithValidationScope(device, 'pipeline', () =>
    typeof device.createRenderPipelineAsync === 'function'
      ? device.createRenderPipelineAsync(descriptor)
      : device.createRenderPipeline(descriptor),
  );

const computePipeline = (device: GPUDevice, descriptor: GPUComputePipelineDescriptor) =>
  createWithValidationScope(device, 'pipeline', () =>
    typeof device.createComputePipelineAsync === 'function'
      ? device.createComputePipelineAsync(descriptor)
      : device.createComputePipeline(descriptor),
  );

const ADDITIVE_BLEND: GPUBlendState = {
  color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
  alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' },
};

/** Build every field pipeline and buffer, or throw `BreathFieldUnavailableError`. */
export async function createBreathField(deps: BreathFieldDeps): Promise<BreathField> {
  const { device, uniformsLayout, swapFormat } = deps;
  const limitProblem = fieldLimitProblem(device.limits);
  if (limitProblem) throw new BreathFieldUnavailableError(limitProblem);

  const created: Array<{ destroy(): void }> = [];
  const track = <T extends { destroy(): void }>(resource: T): T => {
    created.push(resource);
    return resource;
  };
  const destroyAll = () => {
    for (const resource of created.splice(0)) {
      try { resource.destroy(); } catch { /* device already gone */ }
    }
  };

  try {
    // Error scopes are a per-device stack, so every create below is awaited
    // in turn: concurrent scopes would pop each other's errors.
    const [simSource, particleSource] = await Promise.all([
      deps.loadSource(FIELD_MODULES.sim),
      deps.loadSource(FIELD_MODULES.particles),
    ]);
    const simModule = await compileModule(device, 'Breath field sim', simSource);
    const particleModule = await compileModule(device, 'Breath field particles', particleSource);

    // --- Layouts (group 1 per pass family) -------------------------------
    const simLayout = device.createBindGroupLayout({
      label: 'Breath field sim layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', minBindingSize: FIELD_PARAMS_LAYOUT.size } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage', minBindingSize: PARTICLE_STRIDE } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', minBindingSize: PARTICLE_STRIDE } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', minBindingSize: 4 } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage', minBindingSize: DRAW_ARGS_LAYOUT.size } },
      ],
    });
    const drawLayout = device.createBindGroupLayout({
      label: 'Breath field draw layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage', minBindingSize: PARTICLE_STRIDE } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage', minBindingSize: 4 } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform', minBindingSize: FIELD_PARAMS_LAYOUT.size } },
      ],
    });
    const postLayout = device.createBindGroupLayout({
      label: 'Breath field post layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ],
    });
    const simPipelineLayout = device.createPipelineLayout({ label: 'Breath field sim pipeline layout', bindGroupLayouts: [uniformsLayout, simLayout] });
    const drawPipelineLayout = device.createPipelineLayout({ label: 'Breath field draw pipeline layout', bindGroupLayouts: [uniformsLayout, drawLayout] });
    const postPipelineLayout = device.createPipelineLayout({ label: 'Breath field post pipeline layout', bindGroupLayouts: [uniformsLayout, postLayout] });

    // --- Pipelines --------------------------------------------------------
    const particleTarget = (format: GPUTextureFormat, gain: number): GPURenderPipelineDescriptor => ({
      label: `Breath field particles (${format})`,
      layout: drawPipelineLayout,
      vertex: { module: particleModule, entryPoint: 'particle_vs' },
      fragment: {
        module: particleModule,
        entryPoint: 'particle_fs',
        targets: [{ format, blend: ADDITIVE_BLEND }],
        constants: { HDR_GAIN: gain },
      },
      primitive: { topology: 'triangle-list' },
    });
    const stepPipeline = await computePipeline(device, { label: 'Breath field step', layout: simPipelineLayout, compute: { module: simModule, entryPoint: 'field_step' } });
    const cullPipeline = await computePipeline(device, { label: 'Breath field cull', layout: simPipelineLayout, compute: { module: simModule, entryPoint: 'field_cull' } });
    const particlesSdr = await renderPipeline(device, particleTarget(swapFormat, 1));

    interface HdrPipelines {
      scene: GPURenderPipeline;
      particles: GPURenderPipeline;
      prefilter: GPURenderPipeline;
      down: GPURenderPipeline;
      up: GPURenderPipeline;
      tonemap: GPURenderPipeline;
    }
    let hdr: HdrPipelines | null = null;
    let hdrState: HdrStageStatus = 'idle';
    let hdrFailure: string | undefined;
    let fieldDestroyed = false;

    const buildHdr = async (): Promise<HdrPipelines> => {
      const postSource = await deps.loadSource(FIELD_MODULES.post);
      const postModule = await compileModule(device, 'Breath field post', postSource);
      const postTarget = (label: string, entryPoint: string, format: GPUTextureFormat, blend?: GPUBlendState): GPURenderPipelineDescriptor => ({
        label,
        layout: postPipelineLayout,
        vertex: { module: postModule, entryPoint: 'post_vs' },
        fragment: { module: postModule, entryPoint, targets: [{ format, ...(blend ? { blend } : {}) }] },
        primitive: { topology: 'triangle-list' },
      });
      const particles = await renderPipeline(device, particleTarget(HDR_FORMAT, HDR_PARTICLE_GAIN));
      const prefilter = await renderPipeline(device, postTarget('Breath field bloom prefilter', 'bloom_prefilter_fs', HDR_FORMAT));
      const down = await renderPipeline(device, postTarget('Breath field bloom down', 'bloom_down_fs', HDR_FORMAT));
      const up = await renderPipeline(device, postTarget('Breath field bloom up', 'bloom_up_fs', HDR_FORMAT, ADDITIVE_BLEND));
      const tonemap = await renderPipeline(device, postTarget('Breath field tonemap', 'tonemap_fs', swapFormat));
      const scene = await renderPipeline(device, {
        label: 'Sacred Breath WebGPU Pipeline (HDR)',
        layout: deps.fullscreenLayout,
        vertex: { module: deps.sceneModule, entryPoint: deps.sceneVertexEntry },
        fragment: { module: deps.sceneModule, entryPoint: deps.sceneFragmentEntry, targets: [{ format: HDR_FORMAT }] },
        primitive: { topology: 'triangle-list' },
      });
      return { scene, particles, prefilter, down, up, tonemap };
    };

    // --- Buffers ------------------------------------------------------------
    const maxParticles = PARTICLE_COUNTS[PARTICLE_COUNTS.length - 1] ?? 0;
    // Zero-filled: `seed == 0` makes field_step respawn everything on frame one.
    const particleBuffers = [0, 1].map((index) => track(device.createBuffer({
      label: `Breath field particles ${index === 0 ? 'A' : 'B'}`,
      size: maxParticles * PARTICLE_STRIDE,
      usage: GPUBufferUsage.STORAGE,
    })));
    const visibleBuffer = track(device.createBuffer({
      label: 'Breath field visible indices',
      size: maxParticles * 4,
      usage: GPUBufferUsage.STORAGE,
    }));
    const drawArgsBuffer = track(device.createBuffer({
      label: 'Breath field draw args',
      size: DRAW_ARGS_LAYOUT.size,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
    }));
    const paramsBuffer = track(device.createBuffer({
      label: 'Breath field params',
      size: FIELD_PARAMS_LAYOUT.size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }));
    const drawArgsReset = buildDrawArgsReset();

    // Parity p: step reads particleBuffers[p], writes [1 - p]; draw reads [1 - p].
    const simBindGroups = [0, 1].map((parity) => device.createBindGroup({
      label: `Breath field sim bind group ${parity}`,
      layout: simLayout,
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: particleBuffers[parity]! } },
        { binding: 2, resource: { buffer: particleBuffers[1 - parity]! } },
        { binding: 3, resource: { buffer: visibleBuffer } },
        { binding: 4, resource: { buffer: drawArgsBuffer } },
      ],
    }));
    const drawBindGroups = [0, 1].map((parity) => device.createBindGroup({
      label: `Breath field draw bind group ${parity}`,
      layout: drawLayout,
      entries: [
        { binding: 0, resource: { buffer: particleBuffers[1 - parity]! } },
        { binding: 1, resource: { buffer: visibleBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    }));

    // --- Post targets (sized lazily) -----------------------------------------
    const sampler = device.createSampler({
      label: 'Breath field post sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
    const black = track(device.createTexture({
      label: 'Breath field black',
      size: [1, 1],
      format: HDR_FORMAT,
      usage: GPUTextureUsage.TEXTURE_BINDING,
    }));
    const blackView = black.createView();

    interface PostTargets {
      width: number;
      height: number;
      hdr: GPUTexture;
      hdrView: GPUTextureView;
      mips: GPUTexture[];
      mipViews: GPUTextureView[];
      prefilter: GPUBindGroup;
      /** down[i] samples mip i-1 (index 0 unused: the prefilter covers it). */
      down: GPUBindGroup[];
      /** up[i] samples mip i, drawn into mip i-1. */
      up: GPUBindGroup[];
      tonemapWithBloom: GPUBindGroup;
      tonemapNoBloom: GPUBindGroup;
    }
    let targets: PostTargets | null = null;

    const postBindGroup = (label: string, sourceView: GPUTextureView, bloomView: GPUTextureView) =>
      device.createBindGroup({
        label,
        layout: postLayout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: sourceView },
          { binding: 2, resource: bloomView },
        ],
      });

    const destroyTargets = () => {
      if (!targets) return;
      for (const texture of [targets.hdr, ...targets.mips]) {
        try { texture.destroy(); } catch { /* already gone */ }
      }
      targets = null;
    };

    const ensureTargets = (width: number, height: number): PostTargets => {
      if (targets && targets.width === width && targets.height === height) return targets;
      destroyTargets();
      const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
      const hdr = device.createTexture({ label: 'Breath field HDR target', size: [width, height], format: HDR_FORMAT, usage });
      const hdrView = hdr.createView();
      const mips = bloomMipSizes(width, height).map(([w, h], level) =>
        device.createTexture({ label: `Breath field bloom mip ${level}`, size: [w, h], format: HDR_FORMAT, usage }));
      const mipViews = mips.map((mip) => mip.createView());
      targets = {
        width,
        height,
        hdr,
        hdrView,
        mips,
        mipViews,
        prefilter: postBindGroup('Breath field bloom prefilter', hdrView, blackView),
        down: mipViews.map((_, level) => postBindGroup(`Breath field bloom down ${level}`, level === 0 ? hdrView : mipViews[level - 1]!, blackView)),
        up: mipViews.map((view, level) => postBindGroup(`Breath field bloom up ${level}`, view, blackView)),
        tonemapWithBloom: postBindGroup('Breath field tonemap', hdrView, mipViews[0]!),
        tonemapNoBloom: postBindGroup('Breath field tonemap (no bloom)', hdrView, blackView),
      };
      return targets;
    };

    const particleCount = (frame: PassFrame): number => PARTICLE_COUNTS[frame.tier.particleLevel] ?? 0;
    const hdrActive = (frame: PassFrame): boolean => frame.sceneFormat === HDR_FORMAT && targets !== null && hdr !== null;
    const parity = (frame: PassFrame): number => frame.frameIndex & 1;

    const fullscreen = (
      encoder: GPUCommandEncoder,
      frame: PassFrame,
      label: string,
      view: GPUTextureView,
      pipeline: GPURenderPipeline,
      bindGroup: GPUBindGroup,
      loadOp: GPULoadOp,
    ) => {
      const timestampWrites = frame.timestampWrites(label);
      const pass = encoder.beginRenderPass({
        label: `Breath field ${label} pass`,
        colorAttachments: [{ view, clearValue: [0, 0, 0, 1], loadOp, storeOp: 'store' }],
        ...(timestampWrites ? { timestampWrites } : {}),
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(UNIFORMS_GROUP, frame.uniforms);
      pass.setBindGroup(FIELD_GROUP, bindGroup);
      pass.draw(FULLSCREEN_VERTEX_COUNT);
      pass.end();
    };

    const simPass: FramePass = {
      label: FIELD_PASS_LABELS.sim,
      enabled: (frame) => particleCount(frame) > 0,
      encode(encoder, frame) {
        const count = particleCount(frame);
        const groups = Math.ceil(count / SIM_WORKGROUP_SIZE);
        const timestampWrites = frame.timestampWrites(FIELD_PASS_LABELS.sim);
        const pass = encoder.beginComputePass({
          label: 'Breath field sim pass',
          ...(timestampWrites ? { timestampWrites } : {}),
        });
        pass.setBindGroup(UNIFORMS_GROUP, frame.uniforms);
        pass.setBindGroup(FIELD_GROUP, simBindGroups[parity(frame)]!);
        pass.setPipeline(stepPipeline);
        pass.dispatchWorkgroups(groups);
        // Separate dispatch = WebGPU orders the step's writes before the cull's reads.
        pass.setPipeline(cullPipeline);
        pass.dispatchWorkgroups(groups);
        pass.end();
      },
    };

    const particlesPass: FramePass = {
      label: FIELD_PASS_LABELS.particles,
      enabled: (frame) => particleCount(frame) > 0,
      encode(encoder, frame) {
        const pipeline = frame.sceneFormat === HDR_FORMAT && hdr ? hdr.particles : particlesSdr;
        const timestampWrites = frame.timestampWrites(FIELD_PASS_LABELS.particles);
        const pass = encoder.beginRenderPass({
          label: 'Breath field particles pass',
          colorAttachments: [{ view: frame.sceneView, loadOp: 'load', storeOp: 'store' }],
          ...(timestampWrites ? { timestampWrites } : {}),
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(UNIFORMS_GROUP, frame.uniforms);
        pass.setBindGroup(FIELD_GROUP, drawBindGroups[parity(frame)]!);
        pass.drawIndirect(drawArgsBuffer, 0);
        pass.end();
      },
    };

    const bloomLevels = (frame: PassFrame): number => Math.min(Math.max(0, frame.tier.bloomLevels), MAX_BLOOM_LEVELS);

    const bloomPass: FramePass = {
      label: FIELD_PASS_LABELS.bloom,
      enabled: (frame) => hdrActive(frame) && bloomLevels(frame) > 0,
      encode(encoder, frame) {
        const t = targets;
        const p = hdr;
        if (!t || !p) return;
        const levels = bloomLevels(frame);
        fullscreen(encoder, frame, FIELD_PASS_LABELS.bloom, t.mipViews[0]!, p.prefilter, t.prefilter, 'clear');
        for (let level = 1; level < levels; level += 1) {
          fullscreen(encoder, frame, FIELD_PASS_LABELS.bloom, t.mipViews[level]!, p.down, t.down[level]!, 'clear');
        }
        for (let level = levels - 1; level >= 1; level -= 1) {
          fullscreen(encoder, frame, FIELD_PASS_LABELS.bloom, t.mipViews[level - 1]!, p.up, t.up[level]!, 'load');
        }
      },
    };

    const tonemapPass: FramePass = {
      label: FIELD_PASS_LABELS.tonemap,
      enabled: (frame) => hdrActive(frame),
      encode(encoder, frame) {
        const t = targets;
        const p = hdr;
        if (!t || !p) return;
        const bindGroup = bloomLevels(frame) > 0 ? t.tonemapWithBloom : t.tonemapNoBloom;
        fullscreen(encoder, frame, FIELD_PASS_LABELS.tonemap, frame.swapView, p.tonemap, bindGroup, 'clear');
      },
    };

    const field: BreathField = {
      requestHdr() {
        if (hdrState !== 'idle' || fieldDestroyed) return;
        hdrState = 'building';
        buildHdr().then(
          (pipelines) => {
            if (fieldDestroyed) return;
            hdr = pipelines;
            hdrState = 'ready';
            field.onHdrSettled?.();
          },
          (error: unknown) => {
            if (fieldDestroyed) return;
            hdrState = 'unavailable';
            hdrFailure = error instanceof Error ? error.message : String(error);
            console.warn(`[WebGPU] breath field HDR stage unavailable: ${hdrFailure}`);
            field.onHdrSettled?.();
          },
        );
      },
      hdrStatus: () => hdrState,
      hdrReason: () => hdrFailure,
      hdrScenePipeline: () => hdr?.scene ?? null,
      simPass,
      particlesPass,
      bloomPass,
      tonemapPass,
      hdrTargetView(width, height) {
        return ensureTargets(width, height).hdrView;
      },
      writeFrame(frame) {
        const count = particleCount(frame);
        if (count === 0) return;
        device.queue.writeBuffer(paramsBuffer, 0, buildFieldParams({
          dt: frame.dtSeconds,
          count,
          frame: frame.frameIndex >>> 0,
          pointerRadius: POINTER_RADIUS,
        }));
        device.queue.writeBuffer(drawArgsBuffer, 0, drawArgsReset as GPUAllowSharedBufferSource);
      },
      destroy() {
        fieldDestroyed = true;
        destroyTargets();
        destroyAll();
      },
    };
    return field;
  } catch (error) {
    destroyAll();
    if (error instanceof BreathFieldUnavailableError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new BreathFieldUnavailableError(message);
  }
}
