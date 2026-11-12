import { describe, expect, it, vi } from 'vitest';
import { PARTICLE_COUNTS } from '../frameGovernor';
import {
  bloomMipSizes,
  BreathFieldUnavailableError,
  createBreathField,
  FIELD_MODULES,
  fieldLimitProblem,
  HDR_FORMAT,
  SIM_WORKGROUP_SIZE,
} from '../breathField/breathField';
import type { PassFrame } from '../passes/types';

// GPU* enums are browser globals; the node project has none.
vi.stubGlobal('GPUShaderStage', { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 });
vi.stubGlobal('GPUBufferUsage', { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 });
vi.stubGlobal('GPUTextureUsage', { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 });

const coreLimits = {
  maxStorageBuffersPerShaderStage: 8,
  maxStorageBufferBindingSize: 128 * 1024 * 1024,
} as unknown as GPUSupportedLimits;

function makeDevice(options: { limits?: Partial<GPUSupportedLimits>; compileErrorIn?: string } = {}) {
  const destroyed: string[] = [];
  const modules: string[] = [];
  const device = {
    limits: { ...coreLimits, ...options.limits },
    pushErrorScope: vi.fn(),
    popErrorScope: vi.fn(async () => null),
    createShaderModule: vi.fn(({ label }: GPUShaderModuleDescriptor) => {
      modules.push(label ?? '');
      const failing = options.compileErrorIn && label?.includes(options.compileErrorIn);
      return {
        label,
        getCompilationInfo: async () => ({
          messages: failing ? [{ type: 'error', message: 'bad wgsl', lineNum: 3, linePos: 1 }] : [],
        }),
      };
    }),
    createBindGroupLayout: vi.fn((d: GPUBindGroupLayoutDescriptor) => ({ label: d.label })),
    createPipelineLayout: vi.fn((d: GPUPipelineLayoutDescriptor) => ({ label: d.label })),
    createComputePipelineAsync: vi.fn(async (d: GPUComputePipelineDescriptor) => ({ label: d.label })),
    createRenderPipelineAsync: vi.fn(async (d: GPURenderPipelineDescriptor) => ({ label: d.label, descriptor: d })),
    createBuffer: vi.fn((d: GPUBufferDescriptor) => ({ label: d.label, size: d.size, destroy: () => destroyed.push(d.label ?? '') })),
    createBindGroup: vi.fn((d: GPUBindGroupDescriptor) => ({ label: d.label })),
    createSampler: vi.fn(() => ({})),
    createTexture: vi.fn((d: GPUTextureDescriptor) => ({
      label: d.label,
      size: d.size,
      createView: () => ({ label: `${d.label} view` }),
      destroy: () => destroyed.push(d.label ?? ''),
    })),
    queue: { writeBuffer: vi.fn() },
  };
  return { device: device as unknown as GPUDevice, raw: device, destroyed, modules };
}

const deps = (device: GPUDevice) => ({
  device,
  uniformsLayout: { label: 'uniforms' } as unknown as GPUBindGroupLayout,
  fullscreenLayout: { label: 'fullscreen' } as unknown as GPUPipelineLayout,
  swapFormat: 'bgra8unorm' as GPUTextureFormat,
  sceneModule: { label: 'scene' } as unknown as GPUShaderModule,
  sceneVertexEntry: 'vs',
  sceneFragmentEntry: 'main',
  loadSource: vi.fn(async (path: string) => `// ${path}`),
});

function makeEncoder() {
  const computePasses: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
  type Fn = ReturnType<typeof vi.fn>;
  const renderPasses: Array<{ descriptor: GPURenderPassDescriptor; setBindGroup: Fn; setPipeline: Fn; draw: Fn; drawIndirect: Fn; end: Fn }> = [];
  const encoder = {
    beginComputePass: vi.fn(() => {
      const pass = { setBindGroup: vi.fn(), setPipeline: vi.fn(), dispatchWorkgroups: vi.fn(), end: vi.fn() };
      computePasses.push(pass);
      return pass;
    }),
    beginRenderPass: vi.fn((descriptor: GPURenderPassDescriptor) => {
      const pass = { descriptor, setBindGroup: vi.fn(), setPipeline: vi.fn(), draw: vi.fn(), drawIndirect: vi.fn(), end: vi.fn() };
      renderPasses.push(pass);
      return pass;
    }),
  };
  return { encoder: encoder as unknown as GPUCommandEncoder, computePasses, renderPasses };
}

const frame = (patch: Omit<Partial<PassFrame>, 'tier'> & { tier?: Partial<PassFrame['tier']> } = {}): PassFrame => ({
  device: {} as GPUDevice,
  uniforms: { label: 'uniforms bg' } as unknown as GPUBindGroup,
  width: 640,
  height: 360,
  dtSeconds: 1 / 60,
  frameIndex: 4,
  swapView: { label: 'swap' } as unknown as GPUTextureView,
  swapFormat: 'bgra8unorm',
  sceneView: { label: 'swap' } as unknown as GPUTextureView,
  sceneFormat: 'bgra8unorm',
  timestampWrites: () => undefined,
  ...patch,
  tier: { overlayEnabled: true, particleLevel: 2, bloomLevels: 0, hdrEnabled: false, ...patch.tier },
});

describe('breath field helpers', () => {
  it('reports device limits that cannot host the sim', () => {
    expect(fieldLimitProblem(coreLimits)).toBeNull();
    expect(fieldLimitProblem({ ...coreLimits, maxStorageBuffersPerShaderStage: 2 } as GPUSupportedLimits)).toMatch(/maxStorageBuffersPerShaderStage/);
    expect(fieldLimitProblem({ ...coreLimits, maxStorageBuffersInVertexStage: 0 } as unknown as GPUSupportedLimits)).toMatch(/VertexStage/);
  });

  it('halves bloom mips with floor and never goes below 1', () => {
    expect(bloomMipSizes(1921, 1081)).toEqual([[960, 540], [480, 270], [240, 135], [120, 67], [60, 33]]);
    expect(bloomMipSizes(3, 2, 3)).toEqual([[1, 1], [1, 1], [1, 1]]);
  });
});

describe('createBreathField', () => {
  it('refuses on insufficient limits without allocating anything', async () => {
    const { device, raw } = makeDevice({ limits: { maxStorageBuffersPerShaderStage: 3 } });
    await expect(createBreathField(deps(device))).rejects.toBeInstanceOf(BreathFieldUnavailableError);
    expect(raw.createBuffer).not.toHaveBeenCalled();
  });

  it('turns a compile error into BreathFieldUnavailableError, never a stage error', async () => {
    const { device } = makeDevice({ compileErrorIn: 'sim' });
    await expect(createBreathField(deps(device))).rejects.toThrow(/Breath field sim: 3:1 bad wgsl/);
    await expect(createBreathField(deps(device))).rejects.toBeInstanceOf(BreathFieldUnavailableError);
  });

  it('builds only the particle half up front; HDR waits for requestHdr', async () => {
    const { device, modules, raw } = makeDevice();
    const d = deps(device);
    const field = await createBreathField(d);
    expect(d.loadSource).toHaveBeenCalledWith(FIELD_MODULES.sim);
    expect(d.loadSource).not.toHaveBeenCalledWith(FIELD_MODULES.post);
    expect(modules).toEqual(['Breath field sim', 'Breath field particles']);
    expect(field.hdrStatus()).toBe('idle');
    expect(field.hdrScenePipeline()).toBeNull();

    const settled = new Promise<void>((resolve) => { field.onHdrSettled = resolve; });
    field.requestHdr();
    expect(field.hdrStatus()).toBe('building');
    await settled;
    expect(field.hdrStatus()).toBe('ready');
    expect(field.hdrScenePipeline()).toEqual(expect.objectContaining({ label: 'Sacred Breath WebGPU Pipeline (HDR)' }));
    const hdrScene = raw.createRenderPipelineAsync.mock.calls.find(([desc]) => desc.label?.includes('(HDR)'))![0];
    expect(hdrScene.fragment!.targets).toEqual([{ format: HDR_FORMAT }]);
    // Every create ran inside its own error scope, one at a time.
    expect(raw.pushErrorScope.mock.calls.length).toBe(raw.popErrorScope.mock.calls.length);
  });

  it('dispatches step + cull for the tier count and draws particles indirectly', async () => {
    const { device, raw } = makeDevice();
    const field = await createBreathField(deps(device));
    const f = frame({ tier: { particleLevel: 2 } });
    expect(field.simPass.enabled(f)).toBe(true);
    expect(field.bloomPass.enabled(f)).toBe(false);
    expect(field.tonemapPass.enabled(f)).toBe(false);

    const { encoder, computePasses, renderPasses } = makeEncoder();
    field.writeFrame(f);
    field.simPass.encode(encoder, f);
    field.particlesPass.encode(encoder, f);

    const groups = Math.ceil(PARTICLE_COUNTS[2] / SIM_WORKGROUP_SIZE);
    expect(computePasses).toHaveLength(1);
    expect(computePasses[0]!.dispatchWorkgroups.mock.calls).toEqual([[groups], [groups]]);
    expect(renderPasses[0]!.drawIndirect).toHaveBeenCalledWith(expect.objectContaining({ label: 'Breath field draw args' }), 0);
    expect(renderPasses[0]!.descriptor.colorAttachments).toEqual([expect.objectContaining({ loadOp: 'load' })]);
    // Params + draw-args reset written before submit, not read back.
    expect(raw.queue.writeBuffer).toHaveBeenCalledTimes(2);

    expect(field.simPass.enabled(frame({ tier: { particleLevel: 0 } }))).toBe(false);
  });

  it('ping-pongs particle buffers by frame parity', async () => {
    const { device, raw } = makeDevice();
    const field = await createBreathField(deps(device));
    const groupsUsed = (frameIndex: number) => {
      const { encoder, computePasses } = makeEncoder();
      field.simPass.encode(encoder, frame({ frameIndex }));
      return computePasses[0]!.setBindGroup.mock.calls[1]![1];
    };
    expect(groupsUsed(0)).not.toBe(groupsUsed(1));
    expect(groupsUsed(0)).toBe(groupsUsed(2));
    const simGroups = raw.createBindGroup.mock.calls.filter(([d]) => d.label?.startsWith('Breath field sim bind group'));
    const [even, odd] = simGroups.map(([d]) => [...d.entries]);
    // Parity 0 reads A writes B; parity 1 reads B writes A.
    expect((even![1]!.resource as GPUBufferBinding).buffer).toBe((odd![2]!.resource as GPUBufferBinding).buffer);
  });

  it('encodes prefilter + (L-1) down + (L-1) up bloom passes, then the tone map onto the swap chain', async () => {
    const { device } = makeDevice();
    const field = await createBreathField(deps(device));
    const settled = new Promise<void>((resolve) => { field.onHdrSettled = resolve; });
    field.requestHdr();
    await settled;
    const hdrView = field.hdrTargetView(640, 360);
    const f = frame({ sceneView: hdrView, sceneFormat: HDR_FORMAT, tier: { hdrEnabled: true, bloomLevels: 5 } });
    expect(field.bloomPass.enabled(f)).toBe(true);

    const { encoder, renderPasses } = makeEncoder();
    field.bloomPass.encode(encoder, f);
    field.tonemapPass.encode(encoder, f);
    const loadOps = renderPasses.map((p) => [...p.descriptor.colorAttachments][0]!.loadOp);
    expect(loadOps).toEqual(['clear', 'clear', 'clear', 'clear', 'clear', 'load', 'load', 'load', 'load', 'clear']);
    expect([...renderPasses.at(-1)!.descriptor.colorAttachments][0]!.view).toBe(f.swapView);

    // Bloom off but HDR on: tone map only.
    const noBloom = frame({ sceneView: hdrView, sceneFormat: HDR_FORMAT, tier: { hdrEnabled: true, bloomLevels: 0 } });
    expect(field.bloomPass.enabled(noBloom)).toBe(false);
    expect(field.tonemapPass.enabled(noBloom)).toBe(true);
  });

  it('reallocates HDR targets only when the size changes, and frees everything on destroy', async () => {
    const { device, raw, destroyed } = makeDevice();
    const field = await createBreathField(deps(device));
    field.hdrTargetView(640, 360);
    const textures = raw.createTexture.mock.calls.length;
    field.hdrTargetView(640, 360);
    expect(raw.createTexture.mock.calls.length).toBe(textures);
    field.hdrTargetView(800, 450);
    expect(raw.createTexture.mock.calls.length).toBe(textures + 6);
    expect(destroyed).toContain('Breath field HDR target');
    field.destroy();
    expect(destroyed).toEqual(expect.arrayContaining(['Breath field particles A', 'Breath field particles B', 'Breath field draw args']));
  });
});
