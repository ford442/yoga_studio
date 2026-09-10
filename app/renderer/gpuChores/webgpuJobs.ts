import {
  HISTOGRAM_BINS,
  meanLumaFromBins,
  type ChoreImageSource,
  type GpuChoreExecutor,
  type HistogramResult,
  type Rgba8Image,
} from '../../lib/gpuChores';
import { isRgba8Image } from '../../lib/gpuChores/cpuJobs';
import { createWithValidationScope } from '../webgpuBackend';
import { getChoreDevice } from './choreDevice';

/** 2D chores dispatch at (8,8), per the shared gpu-chores kit. */
const WORKGROUP = 8;
/** `copyTextureToBuffer` requires a 256-byte aligned row stride. */
const BYTES_PER_ROW_ALIGNMENT = 256;

const LUMA_WGSL_EXPR = '0.2126 * px.r + 0.7152 * px.g + 0.0722 * px.b';

const HISTOGRAM_WGSL = `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> bins: array<atomic<u32>, ${HISTOGRAM_BINS}>;

@compute @workgroup_size(${WORKGROUP}, ${WORKGROUP})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(src);
  if ((gid.x >= dims.x) || (gid.y >= dims.y)) {
    return;
  }
  let px = textureLoad(src, vec2<i32>(i32(gid.x), i32(gid.y)), 0);
  let luma = (${LUMA_WGSL_EXPR}) * 255.0;
  let bin = i32(clamp(round(luma), 0.0, 255.0));
  atomicAdd(&bins[bin], 1u);
}
`;

const DOWNSAMPLE_WGSL = `
struct Params {
  srcSize: vec2<u32>,
  dstSize: vec2<u32>,
};

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(${WORKGROUP}, ${WORKGROUP})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if ((gid.x >= params.dstSize.x) || (gid.y >= params.dstSize.y)) {
    return;
  }
  let ratio = vec2<f32>(params.srcSize) / vec2<f32>(params.dstSize);
  let start = vec2<i32>(floor(vec2<f32>(gid.xy) * ratio));
  let limit = vec2<i32>(params.srcSize);
  let stop = max(start + vec2<i32>(1, 1), min(limit, vec2<i32>(ceil((vec2<f32>(gid.xy) + vec2<f32>(1.0, 1.0)) * ratio))));

  var total = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  var count = 0.0;
  for (var y = start.y; y < stop.y; y = y + 1) {
    for (var x = start.x; x < stop.x; x = x + 1) {
      total = total + textureLoad(src, vec2<i32>(x, y), 0);
      count = count + 1.0;
    }
  }
  textureStore(dst, vec2<i32>(i32(gid.x), i32(gid.y)), total / count);
}
`;

const LUT_WGSL = `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<storage, read> lut: array<u32, ${HISTOGRAM_BINS / 4}>;

fn mapChannel(value: f32) -> f32 {
  let index = i32(clamp(round(value * 255.0), 0.0, 255.0));
  let word = lut[index / 4];
  let shift = u32((index % 4) * 8);
  return f32((word >> shift) & 255u) / 255.0;
}

@compute @workgroup_size(${WORKGROUP}, ${WORKGROUP})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(src);
  if ((gid.x >= dims.x) || (gid.y >= dims.y)) {
    return;
  }
  let coord = vec2<i32>(i32(gid.x), i32(gid.y));
  let px = textureLoad(src, coord, 0);
  textureStore(dst, coord, vec4<f32>(mapChannel(px.r), mapChannel(px.g), mapChannel(px.b), px.a));
}
`;

const pipelineCache = new WeakMap<GPUDevice, Map<string, GPUComputePipeline>>();

/** Compile-once-per-device compute pipelines, validated the same way the renderer validates its own. */
async function getPipeline(device: GPUDevice, key: string, code: string): Promise<GPUComputePipeline> {
  let byKey = pipelineCache.get(device);
  if (!byKey) {
    byKey = new Map();
    pipelineCache.set(device, byKey);
  }
  const cached = byKey.get(key);
  if (cached) return cached;

  const shaderModule = await createWithValidationScope(device, 'module', () =>
    device.createShaderModule({ label: `gpu-chores ${key}`, code }),
  );
  const descriptor: GPUComputePipelineDescriptor = {
    label: `gpu-chores ${key}`,
    layout: 'auto',
    compute: { module: shaderModule, entryPoint: 'main' },
  };
  const pipeline = await createWithValidationScope(device, 'pipeline', () =>
    typeof device.createComputePipelineAsync === 'function'
      ? device.createComputePipelineAsync(descriptor)
      : device.createComputePipeline(descriptor),
  );
  byKey.set(key, pipeline);
  return pipeline;
}

function uploadSource(device: GPUDevice, source: ChoreImageSource): GPUTexture {
  const { width, height } = source;
  const texture = device.createTexture({
    label: 'gpu-chores source',
    size: { width, height },
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });
  if (isRgba8Image(source)) {
    device.queue.writeTexture(
      { texture },
      source.data as GPUAllowSharedBufferSource,
      { bytesPerRow: width * 4, rowsPerImage: height },
      { width, height },
    );
  } else {
    device.queue.copyExternalImageToTexture({ source }, { texture }, { width, height });
  }
  return texture;
}

const dispatchCount = (size: number): number => Math.ceil(size / WORKGROUP);

async function readBuffer(device: GPUDevice, source: GPUBuffer, size: number): Promise<ArrayBuffer> {
  const staging = device.createBuffer({
    label: 'gpu-chores readback',
    size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyBufferToBuffer(source, 0, staging, 0, size);
  device.queue.submit([encoder.finish()]);
  try {
    await staging.mapAsync(GPUMapMode.READ);
    const copy = staging.getMappedRange().slice(0);
    staging.unmap();
    return copy;
  } finally {
    staging.destroy();
  }
}

/** Copy a storage texture back into packed RGBA8 bytes, undoing the 256-byte row padding. */
async function readTexture(device: GPUDevice, texture: GPUTexture, width: number, height: number): Promise<Rgba8Image> {
  const bytesPerRow =
    Math.ceil((width * 4) / BYTES_PER_ROW_ALIGNMENT) * BYTES_PER_ROW_ALIGNMENT;
  const buffer = device.createBuffer({
    label: 'gpu-chores texture readback',
    size: bytesPerRow * height,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow, rowsPerImage: height }, { width, height });
  device.queue.submit([encoder.finish()]);
  try {
    const padded = new Uint8Array(await readBuffer(device, buffer, bytesPerRow * height));
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      data.set(padded.subarray(y * bytesPerRow, y * bytesPerRow + width * 4), y * width * 4);
    }
    return { data, width, height };
  } finally {
    buffer.destroy();
  }
}

async function runHistogram(device: GPUDevice, source: ChoreImageSource): Promise<HistogramResult> {
  const pipeline = await getPipeline(device, 'luma_histogram_bt709', HISTOGRAM_WGSL);
  const texture = uploadSource(device, source);
  const bins = device.createBuffer({
    label: 'gpu-chores histogram bins',
    size: HISTOGRAM_BINS * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  try {
    device.queue.writeBuffer(bins, 0, new Uint32Array(HISTOGRAM_BINS));
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: { buffer: bins } },
      ],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatchCount(source.width), dispatchCount(source.height));
    pass.end();
    device.queue.submit([encoder.finish()]);

    const counts = new Uint32Array(await readBuffer(device, bins, HISTOGRAM_BINS * 4));
    const total = source.width * source.height;
    return { bins: counts, total, meanLuma: meanLumaFromBins(counts, total) };
  } finally {
    bins.destroy();
    texture.destroy();
  }
}

async function runTextureJob(
  device: GPUDevice,
  key: string,
  code: string,
  source: ChoreImageSource,
  width: number,
  height: number,
  extraEntry: (destroy: (buffer: GPUBuffer) => void) => GPUBindingResource,
): Promise<Rgba8Image> {
  const pipeline = await getPipeline(device, key, code);
  const texture = uploadSource(device, source);
  const target = device.createTexture({
    label: `gpu-chores ${key} target`,
    size: { width, height },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });
  const scratch: GPUBuffer[] = [];
  try {
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: target.createView() },
        { binding: 2, resource: extraEntry((buffer) => scratch.push(buffer)) },
      ],
    });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatchCount(width), dispatchCount(height));
    pass.end();
    device.queue.submit([encoder.finish()]);
    return await readTexture(device, target, width, height);
  } finally {
    for (const buffer of scratch) buffer.destroy();
    target.destroy();
    texture.destroy();
  }
}

async function runDownsample(
  device: GPUDevice,
  source: ChoreImageSource,
  width: number,
  height: number,
): Promise<Rgba8Image> {
  return runTextureJob(device, 'downsample_2d', DOWNSAMPLE_WGSL, source, width, height, (keep) => {
    const params = device.createBuffer({
      label: 'gpu-chores downsample params',
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      params,
      0,
      new Uint32Array([source.width, source.height, width, height]),
    );
    keep(params);
    return { buffer: params };
  });
}

async function runLutMap(device: GPUDevice, source: ChoreImageSource, lut: Uint8Array): Promise<Rgba8Image> {
  if (lut.length !== HISTOGRAM_BINS) {
    throw new Error(`gpu-chores: lut_u8_map needs a ${HISTOGRAM_BINS}-entry LUT, got ${lut.length}.`);
  }
  return runTextureJob(device, 'lut_u8_map', LUT_WGSL, source, source.width, source.height, (keep) => {
    const buffer = device.createBuffer({
      label: 'gpu-chores lut',
      size: HISTOGRAM_BINS,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, new Uint32Array(new Uint8Array(lut).buffer));
    keep(buffer);
    return { buffer };
  });
}

/**
 * The WebGPU tier of gpu-chores, bound to whatever device the renderer lends.
 * Every entry point throws on failure so the runner can drop to Canvas2D / JS.
 */
export function createWebGpuChoreExecutor(
  readDevice: () => GPUDevice | null = getChoreDevice,
): GpuChoreExecutor {
  const demandDevice = (): GPUDevice => {
    const device = readDevice();
    if (!device) throw new Error('gpu-chores: the renderer is not lending a GPUDevice.');
    return device;
  };
  return {
    isAvailable: () => readDevice() !== null,
    lumaHistogram: async (source) => runHistogram(demandDevice(), source),
    downsample: async (source, width, height) => runDownsample(demandDevice(), source, width, height),
    lutMap: async (source, lut) => runLutMap(demandDevice(), source, lut),
  };
}
