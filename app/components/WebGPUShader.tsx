'use client';

import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback, useState } from 'react';

interface WebGPUShaderProps {
  strengthLevel: number;
}

export interface WebGPUShaderRef {
  updateUniforms: (data: {
    time: number;
    phase: number;
    phaseProgress: number;
    cycle: number;
    strengthLevel: number;
    intensity: number;
    activeChakra: number;
    secondaryChakra: number;
  }) => void;
}

// Uniform buffer layout (48 bytes = 12 × f32):
//   [0] time  [1] phase  [2] phaseProgress  [3] cycle
//   [4] strengthLevel  [5] intensity
//   [6] sin_time  [7] cos_time  [8] sin_fast  [9] cos_fast
//   [10] activeChakra  [11] secondaryChakra
const UNIFORM_FLOATS = 12;
const PARTICLE_COUNT = 4096;
const PARTICLE_STRIDE = 32; // 8 floats × 4 bytes: pos(3) + life(1) + vel(3) + hue(1)

// Shared WGSL struct injected into all shaders at load time.
// Single source of truth — shaders must NOT define BreathUniforms themselves.
const BREATH_UNIFORMS_WGSL = `
struct BreathUniforms {
    time:            f32,
    phase:           u32,
    phaseProgress:   f32,
    cycle:           u32,
    strengthLevel:   u32,
    intensity:       f32,
    sin_time:        f32,
    cos_time:        f32,
    sin_fast:        f32,
    cos_fast:        f32,
    activeChakra:    f32,
    secondaryChakra: f32,
}
`;

// ---------------------------------------------------------------------------
// Pass descriptors — data-driven render loop
// ---------------------------------------------------------------------------
// To add a new pass, append to the `passes` array in rebuildPasses().
// The render loop iterates the array — no copy-paste needed.
// ---------------------------------------------------------------------------
type ComputePass = {
  type: 'compute';
  label: string;
  pipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
  workgroups: [number, number?, number?];
};
type RenderPass = {
  type: 'render';
  label: string;
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  target: GPUTextureView;
  clearValue: GPUColor;
  vertices: number;
  instances?: number;
};
type CanvasRenderPass = {
  type: 'render-canvas';
  label: string;
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup;
  vertices: number;
};
type PassDescriptor = ComputePass | RenderPass | CanvasRenderPass;

const WebGPUShader = forwardRef<WebGPUShaderRef, WebGPUShaderProps>(({ strengthLevel }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Data-driven pass list (rebuilt on texture resize)
  const passesRef = useRef<PassDescriptor[]>([]);

  // Buffers
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const resolutionBufferRef = useRef<GPUBuffer | null>(null);
  const particleBufferRef = useRef<GPUBuffer | null>(null);

  // Base render pass (yoga-breath.wgsl → offscreen texture)
  const basePipelineRef = useRef<GPURenderPipeline | null>(null);
  const baseBindGroupRef = useRef<GPUBindGroup | null>(null);

  // Compute passes
  const bloomExtractPipelineRef = useRef<GPUComputePipeline | null>(null);
  const bloomBlurPipelineRef = useRef<GPUComputePipeline | null>(null);
  const particlePipelineRef = useRef<GPUComputePipeline | null>(null);
  const auroraPipelineRef = useRef<GPUComputePipeline | null>(null);

  // Particle render pass (instanced quads → particleTexture)
  const particleRenderPipelineRef = useRef<GPURenderPipeline | null>(null);
  const particleRenderBindGroupRef = useRef<GPUBindGroup | null>(null);

  // Compute bind groups
  const bloomExtractBindGroupRef = useRef<GPUBindGroup | null>(null);
  const bloomBlurHBindGroupRef = useRef<GPUBindGroup | null>(null);
  const bloomBlurVBindGroupRef = useRef<GPUBindGroup | null>(null);
  const particleBindGroupRef = useRef<GPUBindGroup | null>(null);
  const auroraBindGroupRef = useRef<GPUBindGroup | null>(null);

  // Composite pass
  const compositePipelineRef = useRef<GPURenderPipeline | null>(null);
  const compositeBindGroupRef = useRef<GPUBindGroup | null>(null);

  // Textures
  const sceneTextureRef = useRef<GPUTexture | null>(null);
  const bloomTemp1TextureRef = useRef<GPUTexture | null>(null);
  const bloomTemp2TextureRef = useRef<GPUTexture | null>(null);
  const auroraTextureRef = useRef<GPUTexture | null>(null);
  const particleTextureRef = useRef<GPUTexture | null>(null);

  // Bloom params buffers
  const bloomParamsHRef = useRef<GPUBuffer | null>(null);
  const bloomParamsVRef = useRef<GPUBuffer | null>(null);
  const auroraParamsRef = useRef<GPUBuffer | null>(null);

  // Sampler
  const samplerRef = useRef<GPUSampler | null>(null);

  // Track canvas size
  const canvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Load shader from file, stripping any local BreathUniforms definition
  // and prepending the shared header so the struct is defined exactly once.
  const loadShader = async (path: string): Promise<string> => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load shader: ${path}`);
    let code = await response.text();
    // Remove the duplicated struct block (matches `struct BreathUniforms { ... }`)
    code = code.replace(/struct\s+BreathUniforms\s*\{[\s\S]*?\}/, '');
    return BREATH_UNIFORMS_WGSL + code;
  };

  // Create textures sized to canvas
  const createTextures = useCallback((device: GPUDevice, w: number, h: number, format: GPUTextureFormat) => {
    // Destroy old textures
    sceneTextureRef.current?.destroy();
    bloomTemp1TextureRef.current?.destroy();
    bloomTemp2TextureRef.current?.destroy();
    auroraTextureRef.current?.destroy();

    const hw = Math.max(1, Math.floor(w / 2));
    const hh = Math.max(1, Math.floor(h / 2));

    // Scene texture (full res) — render target + texture binding for composite
    sceneTextureRef.current = device.createTexture({
      size: [w, h],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      label: 'sceneTexture',
    });

    // Bloom temp textures (half res) — storage for compute read/write
    bloomTemp1TextureRef.current = device.createTexture({
      size: [hw, hh],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      label: 'bloomTemp1',
    });

    bloomTemp2TextureRef.current = device.createTexture({
      size: [hw, hh],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      label: 'bloomTemp2',
    });

    // Aurora texture (half res)
    auroraTextureRef.current = device.createTexture({
      size: [hw, hh],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
      label: 'auroraTexture',
    });

    // Particle render texture (full res) — render target for instanced particle quads
    particleTextureRef.current?.destroy();
    particleTextureRef.current = device.createTexture({
      size: [w, h],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      label: 'particleTexture',
    });

    canvasSizeRef.current = { w, h };
  }, []);

  // Initialize particle buffer with random data
  const initParticleBuffer = useCallback((device: GPUDevice) => {
    const data = new Float32Array(PARTICLE_COUNT * 8);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const offset = i * 8;
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.02 + Math.random() * 0.08;
      // pos
      data[offset + 0] = Math.cos(angle) * radius;
      data[offset + 1] = -0.8 + Math.random() * 1.7; // along spine
      data[offset + 2] = Math.sin(angle) * radius;
      // life
      data[offset + 3] = Math.random() * 2.0;
      // vel
      data[offset + 4] = (Math.random() - 0.5) * 0.1;
      data[offset + 5] = 0.1 + Math.random() * 0.3;
      data[offset + 6] = (Math.random() - 0.5) * 0.1;
      // hue
      data[offset + 7] = Math.random();
    }

    const buffer = device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
      label: 'particleBuffer',
    });
    new Float32Array(buffer.getMappedRange()).set(data);
    buffer.unmap();
    particleBufferRef.current = buffer;
  }, []);

  // Rebuild bind groups after texture resize
  const rebuildBindGroups = useCallback((device: GPUDevice, format: GPUTextureFormat) => {
    const sampler = samplerRef.current!;
    const uniformBuffer = uniformBufferRef.current!;
    const resolutionBuffer = resolutionBufferRef.current!;
    const particleBuffer = particleBufferRef.current!;
    const { w, h } = canvasSizeRef.current;
    const hw = Math.max(1, Math.floor(w / 2));
    const hh = Math.max(1, Math.floor(h / 2));

    // --- Base render pass bind group ---
    if (basePipelineRef.current) {
      baseBindGroupRef.current = device.createBindGroup({
        layout: basePipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: resolutionBuffer } },
        ],
        label: 'baseBindGroup',
      });
    }

    // --- Bloom extract bind group ---
    if (bloomExtractPipelineRef.current && sceneTextureRef.current && bloomTemp1TextureRef.current) {
      // Update bloom params with current half-res dimensions
      device.queue.writeBuffer(bloomParamsHRef.current!, 0, new Float32Array([1, 0, 1.0 / hw, 1.0 / hh]));
      device.queue.writeBuffer(bloomParamsVRef.current!, 0, new Float32Array([0, 1, 1.0 / hw, 1.0 / hh]));

      bloomExtractBindGroupRef.current = device.createBindGroup({
        layout: bloomExtractPipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: bloomParamsHRef.current! } },
          { binding: 2, resource: sceneTextureRef.current.createView() },
          { binding: 3, resource: bloomTemp1TextureRef.current.createView() },
        ],
        label: 'bloomExtractBindGroup',
      });
    }

    // --- Bloom blur horizontal: bloomTemp1 → bloomTemp2 ---
    if (bloomBlurPipelineRef.current && bloomTemp1TextureRef.current && bloomTemp2TextureRef.current) {
      bloomBlurHBindGroupRef.current = device.createBindGroup({
        layout: bloomBlurPipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: bloomParamsHRef.current! } },
          { binding: 2, resource: bloomTemp1TextureRef.current.createView() },
          { binding: 3, resource: bloomTemp2TextureRef.current.createView() },
        ],
        label: 'bloomBlurHBindGroup',
      });

      // --- Bloom blur vertical: bloomTemp2 → bloomTemp1 ---
      bloomBlurVBindGroupRef.current = device.createBindGroup({
        layout: bloomBlurPipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: bloomParamsVRef.current! } },
          { binding: 2, resource: bloomTemp2TextureRef.current.createView() },
          { binding: 3, resource: bloomTemp1TextureRef.current.createView() },
        ],
        label: 'bloomBlurVBindGroup',
      });
    }

    // --- Particle compute bind group ---
    if (particlePipelineRef.current) {
      particleBindGroupRef.current = device.createBindGroup({
        layout: particlePipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: particleBuffer } },
        ],
        label: 'particleBindGroup',
      });
    }

    // --- Particle render bind group ---
    if (particleRenderPipelineRef.current && particleTextureRef.current) {
      particleRenderBindGroupRef.current = device.createBindGroup({
        layout: particleRenderPipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: resolutionBuffer } },
          { binding: 2, resource: { buffer: particleBuffer } },
        ],
        label: 'particleRenderBindGroup',
      });
    }

    // --- Aurora compute bind group ---
    if (auroraPipelineRef.current && auroraTextureRef.current) {
      device.queue.writeBuffer(auroraParamsRef.current!, 0, new Float32Array([hw, hh, 0, 0]));

      auroraBindGroupRef.current = device.createBindGroup({
        layout: auroraPipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: auroraParamsRef.current! } },
          { binding: 2, resource: auroraTextureRef.current.createView() },
        ],
        label: 'auroraBindGroup',
      });
    }

    // --- Composite bind group ---
    if (compositePipelineRef.current && sceneTextureRef.current && bloomTemp1TextureRef.current && auroraTextureRef.current && particleTextureRef.current) {
      compositeBindGroupRef.current = device.createBindGroup({
        layout: compositePipelineRef.current.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: resolutionBuffer } },
          { binding: 2, resource: sceneTextureRef.current.createView() },
          { binding: 3, resource: bloomTemp1TextureRef.current.createView() },
          { binding: 4, resource: auroraTextureRef.current.createView() },
          { binding: 5, resource: sampler },
          { binding: 6, resource: particleTextureRef.current.createView() },
        ],
        label: 'compositeBindGroup',
      });
    }
  }, []);

  // Build the data-driven pass list from current pipelines, bind groups, and textures.
  // Called after rebuildBindGroups() whenever textures are (re-)created.
  const rebuildPasses = useCallback(() => {
    const { w, h } = canvasSizeRef.current;
    const hw = Math.max(1, Math.floor(w / 2));
    const hh = Math.max(1, Math.floor(h / 2));
    const passes: PassDescriptor[] = [];

    // Pass 1: Base yoga shader → sceneTexture
    if (basePipelineRef.current && baseBindGroupRef.current && sceneTextureRef.current) {
      passes.push({
        type: 'render', label: 'base',
        pipeline: basePipelineRef.current, bindGroup: baseBindGroupRef.current,
        target: sceneTextureRef.current.createView(),
        clearValue: [0.0, 0.0, 0.02, 1.0], vertices: 6,
      });
    }

    // Pass 2: Bloom extract
    if (bloomExtractPipelineRef.current && bloomExtractBindGroupRef.current) {
      passes.push({
        type: 'compute', label: 'bloomExtract',
        pipeline: bloomExtractPipelineRef.current, bindGroup: bloomExtractBindGroupRef.current,
        workgroups: [Math.ceil(w / 16), Math.ceil(h / 16)],
      });
    }

    // Pass 3: Bloom blur horizontal
    if (bloomBlurPipelineRef.current && bloomBlurHBindGroupRef.current) {
      passes.push({
        type: 'compute', label: 'bloomBlurH',
        pipeline: bloomBlurPipelineRef.current, bindGroup: bloomBlurHBindGroupRef.current,
        workgroups: [Math.ceil(hw / 16), Math.ceil(hh / 16)],
      });
    }

    // Pass 4: Bloom blur vertical
    if (bloomBlurPipelineRef.current && bloomBlurVBindGroupRef.current) {
      passes.push({
        type: 'compute', label: 'bloomBlurV',
        pipeline: bloomBlurPipelineRef.current, bindGroup: bloomBlurVBindGroupRef.current,
        workgroups: [Math.ceil(hw / 16), Math.ceil(hh / 16)],
      });
    }

    // Pass 5: Particle simulation (compute)
    if (particlePipelineRef.current && particleBindGroupRef.current) {
      passes.push({
        type: 'compute', label: 'particleSim',
        pipeline: particlePipelineRef.current, bindGroup: particleBindGroupRef.current,
        workgroups: [Math.ceil(PARTICLE_COUNT / 256)],
      });
    }

    // Pass 6: Particle render (instanced quads → particleTexture)
    if (particleRenderPipelineRef.current && particleRenderBindGroupRef.current && particleTextureRef.current) {
      passes.push({
        type: 'render', label: 'particleRender',
        pipeline: particleRenderPipelineRef.current, bindGroup: particleRenderBindGroupRef.current,
        target: particleTextureRef.current.createView(),
        clearValue: [0.0, 0.0, 0.0, 0.0], vertices: 6, instances: PARTICLE_COUNT,
      });
    }

    // Pass 7: Aurora generation
    if (auroraPipelineRef.current && auroraBindGroupRef.current) {
      passes.push({
        type: 'compute', label: 'aurora',
        pipeline: auroraPipelineRef.current, bindGroup: auroraBindGroupRef.current,
        workgroups: [Math.ceil(hw / 16), Math.ceil(hh / 16)],
      });
    }

    // Pass 8: Composite → canvas
    if (compositePipelineRef.current && compositeBindGroupRef.current) {
      passes.push({
        type: 'render-canvas', label: 'composite',
        pipeline: compositePipelineRef.current, bindGroup: compositeBindGroupRef.current,
        vertices: 6,
      });
    }

    passesRef.current = passes;
  }, []);

  // Initialize WebGPU
  const initWebGPU = useCallback(async () => {
    if (!canvasRef.current) return;

    if (!navigator.gpu) {
      setError('WebGPU not supported. Please use Chrome 113+ or Edge 113+');
      return;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) { setError('No WebGPU adapter found'); return; }

      const device = await adapter.requestDevice();
      deviceRef.current = device;

      const context = canvasRef.current.getContext('webgpu');
      if (!context) { setError('Failed to get WebGPU context'); return; }
      contextRef.current = context;

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'premultiplied' });

      // Create sampler for composite pass
      samplerRef.current = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });

      // Create uniform buffers
      uniformBufferRef.current = device.createBuffer({
        size: UNIFORM_FLOATS * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'uniformBuffer',
      });

      resolutionBufferRef.current = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'resolutionBuffer',
      });

      // Bloom params buffers
      bloomParamsHRef.current = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'bloomParamsH',
      });
      bloomParamsVRef.current = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'bloomParamsV',
      });
      auroraParamsRef.current = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: 'auroraParams',
      });

      // Initialize particle buffer
      initParticleBuffer(device);

      // Load all shaders in parallel
      const [baseCode, bloomCode, particleCode, particleRenderCode, auroraCode, compositeCode] = await Promise.all([
        loadShader('./yoga-breath.wgsl'),
        loadShader('./shaders/bloom-compute.wgsl'),
        loadShader('./shaders/particle-compute.wgsl'),
        loadShader('./shaders/particle-render.wgsl'),
        loadShader('./shaders/aurora-compute.wgsl'),
        loadShader('./shaders/composite.wgsl'),
      ]);

      // Compile all shader modules
      const baseModule = device.createShaderModule({ code: baseCode, label: 'yoga-breath' });
      const bloomModule = device.createShaderModule({ code: bloomCode, label: 'bloom-compute' });
      const particleModule = device.createShaderModule({ code: particleCode, label: 'particle-compute' });
      const particleRenderModule = device.createShaderModule({ code: particleRenderCode, label: 'particle-render' });
      const auroraModule = device.createShaderModule({ code: auroraCode, label: 'aurora-compute' });
      const compositeModule = device.createShaderModule({ code: compositeCode, label: 'composite' });

      // Check compilation for all modules
      const modules = [baseModule, bloomModule, particleModule, particleRenderModule, auroraModule, compositeModule];
      for (const mod of modules) {
        const info = await mod.getCompilationInfo();
        for (const msg of info.messages) {
          if (msg.type === 'error') {
            console.error(`Shader compilation error in ${mod.label}:`, msg.message, 'at line', msg.lineNum);
          }
        }
      }

      // --- Create pipelines ---

      // 1. Base render pipeline (yoga-breath.wgsl → offscreen texture)
      // Use rgba8unorm for the scene texture (storage-compatible)
      basePipelineRef.current = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: baseModule, entryPoint: 'vs_main' },
        fragment: {
          module: baseModule,
          entryPoint: 'fs_main',
          targets: [{ format: 'rgba8unorm' }],
        },
        primitive: { topology: 'triangle-list' },
        label: 'basePipeline',
      });

      // 2. Bloom extract compute pipeline
      bloomExtractPipelineRef.current = device.createComputePipeline({
        layout: 'auto',
        compute: { module: bloomModule, entryPoint: 'bloom_extract' },
        label: 'bloomExtractPipeline',
      });

      // 3. Bloom blur compute pipeline
      bloomBlurPipelineRef.current = device.createComputePipeline({
        layout: 'auto',
        compute: { module: bloomModule, entryPoint: 'bloom_blur' },
        label: 'bloomBlurPipeline',
      });

      // 4. Particle compute pipeline
      particlePipelineRef.current = device.createComputePipeline({
        layout: 'auto',
        compute: { module: particleModule, entryPoint: 'update_particles' },
        label: 'particlePipeline',
      });

      // 4b. Particle render pipeline (instanced quads → particleTexture)
      particleRenderPipelineRef.current = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: particleRenderModule, entryPoint: 'vs_main' },
        fragment: {
          module: particleRenderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: 'rgba8unorm',
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
              alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
            },
          }],
        },
        primitive: { topology: 'triangle-list' },
        label: 'particleRenderPipeline',
      });

      // 5. Aurora compute pipeline
      auroraPipelineRef.current = device.createComputePipeline({
        layout: 'auto',
        compute: { module: auroraModule, entryPoint: 'generate_aurora' },
        label: 'auroraPipeline',
      });

      // 6. Composite render pipeline (→ canvas)
      compositePipelineRef.current = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: compositeModule, entryPoint: 'vs_main' },
        fragment: {
          module: compositeModule,
          entryPoint: 'fs_main',
          targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
        label: 'compositePipeline',
      });

      // Create initial textures and bind groups
      const rect = canvasRef.current.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      device.queue.writeBuffer(resolutionBufferRef.current, 0, new Float32Array([w, h, 1.0, 0.0]));

      createTextures(device, w, h, 'rgba8unorm');
      rebuildBindGroups(device, format);
      rebuildPasses();

    } catch (e) {
      console.error('WebGPU initialization failed:', e);
      setError('WebGPU initialization failed: ' + (e as Error).message);
    }
  }, [createTextures, initParticleBuffer, rebuildBindGroups, rebuildPasses]);

  // Update uniforms
  const updateUniforms = useCallback((data: {
    time: number;
    phase: number;
    phaseProgress: number;
    cycle: number;
    strengthLevel: number;
    intensity: number;
    activeChakra: number;
    secondaryChakra: number;
  }) => {
    if (!uniformBufferRef.current || !deviceRef.current) return;
    const t = data.time;
    const array = new Float32Array([
      t, data.phase, data.phaseProgress, data.cycle,
      data.strengthLevel, data.intensity,
      Math.sin(t), Math.cos(t), Math.sin(t * 4.0), Math.cos(t * 4.0),
      data.activeChakra, data.secondaryChakra,
    ]);
    deviceRef.current.queue.writeBuffer(uniformBufferRef.current, 0, array);
  }, []);

  useImperativeHandle(ref, () => ({ updateUniforms }), [updateUniforms]);

  // Store the latest render closure in a ref so the rAF loop always invokes
  // the most up-to-date version without a self-referential useCallback.
  const renderRef = useRef<() => void>(() => {});

  useEffect(() => {
    renderRef.current = () => {
      const device = deviceRef.current;
      const context = contextRef.current;
      const passes = passesRef.current;

      if (!device || !context || passes.length === 0) {
        animationRef.current = requestAnimationFrame(() => renderRef.current());
        return;
      }

      try {
        const encoder = device.createCommandEncoder();

        for (const pass of passes) {
          switch (pass.type) {
            case 'compute': {
              const cp = encoder.beginComputePass();
              cp.setPipeline(pass.pipeline);
              cp.setBindGroup(0, pass.bindGroup);
              cp.dispatchWorkgroups(...pass.workgroups);
              cp.end();
              break;
            }
            case 'render': {
              const rp = encoder.beginRenderPass({
                colorAttachments: [{
                  view: pass.target,
                  loadOp: 'clear',
                  clearValue: pass.clearValue,
                  storeOp: 'store',
                }],
              });
              rp.setPipeline(pass.pipeline);
              rp.setBindGroup(0, pass.bindGroup);
              rp.draw(pass.vertices, pass.instances ?? 1);
              rp.end();
              break;
            }
            case 'render-canvas': {
              const canvasView = context.getCurrentTexture().createView();
              const rp = encoder.beginRenderPass({
                colorAttachments: [{
                  view: canvasView,
                  loadOp: 'clear',
                  clearValue: [0.0, 0.0, 0.0, 1.0],
                  storeOp: 'store',
                }],
              });
              rp.setPipeline(pass.pipeline);
              rp.setBindGroup(0, pass.bindGroup);
              rp.draw(pass.vertices);
              rp.end();
              break;
            }
          }
        }

        device.queue.submit([encoder.finish()]);
      } catch (e) {
        console.error('Render error:', e);
      }

      animationRef.current = requestAnimationFrame(() => renderRef.current());
    };
  }, []);

  // Initialize on mount
  useEffect(() => {
    let cancelled = false;

    // Run init asynchronously to avoid synchronous setState in effect body
    const run = async () => {
      await initWebGPU();
      // Start render loop once initialized (only if not unmounted)
      if (!cancelled && basePipelineRef.current && compositePipelineRef.current) {
        animationRef.current = requestAnimationFrame(() => renderRef.current());
      }
    };
    run();

    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      sceneTextureRef.current?.destroy();
      bloomTemp1TextureRef.current?.destroy();
      bloomTemp2TextureRef.current?.destroy();
      auroraTextureRef.current?.destroy();
      particleTextureRef.current?.destroy();
      uniformBufferRef.current?.destroy();
      resolutionBufferRef.current?.destroy();
      particleBufferRef.current?.destroy();
      bloomParamsHRef.current?.destroy();
      bloomParamsVRef.current?.destroy();
      auroraParamsRef.current?.destroy();
      deviceRef.current?.destroy();
    };
  }, [initWebGPU]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const device = deviceRef.current;
      if (!canvas || !device || !resolutionBufferRef.current) return;

      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));

      if (w === canvasSizeRef.current.w && h === canvasSizeRef.current.h) return;

      canvas.width = w;
      canvas.height = h;
      device.queue.writeBuffer(resolutionBufferRef.current, 0, new Float32Array([w, h, 1.0, 0.0]));

      const format = navigator.gpu.getPreferredCanvasFormat();
      createTextures(device, w, h, 'rgba8unorm');
      rebuildBindGroups(device, format);
      rebuildPasses();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [createTextures, rebuildBindGroups, rebuildPasses]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-900 text-red-400 p-8 text-center">
        <div>
          <p className="text-lg font-semibold mb-2">WebGPU Error</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
});

WebGPUShader.displayName = 'WebGPUShader';

export default WebGPUShader;
