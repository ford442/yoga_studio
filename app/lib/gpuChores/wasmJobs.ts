import { meanLumaFromBins, toRgba8 } from './cpuJobs';
import { CHORES_OK, type ChoresWasm } from './wasm/choresModule';
import {
  HISTOGRAM_BINS,
  type ChoreImageSource,
  type HistogramResult,
  type Rgba8Image,
} from './types';

/**
 * The WASM tier of gpu-chores: thin marshalling around the C ABI in
 * `native/gpu-chores-wasm/src/api.h`.
 *
 * Every job follows the same shape — reset the arena, reserve what it needs,
 * take the views *after* the last reservation (an arena growth detaches earlier
 * views), copy in, call, copy out. Nothing above this file sees a pointer, and
 * no wasm-backed view escapes it: callers always get their own copy, because a
 * view into linear memory would silently rot the next time a job grows it.
 */

const statusMessage = (job: string, status: number): string =>
  `gpu-chores: ${job} failed in wasm (status ${status})`;

/** BT.709 luma histogram, bit-identical to `lumaHistogramCpu`. */
export function lumaHistogramWasm(wasm: ChoresWasm, source: ChoreImageSource): HistogramResult {
  const image = toRgba8(source);
  const total = image.width * image.height;
  if (total === 0) return { bins: new Uint32Array(HISTOGRAM_BINS), total: 0, meanLuma: 0 };

  wasm.reset();
  const pixelsPtr = wasm.alloc(total * 4);
  const binsPtr = wasm.alloc(HISTOGRAM_BINS * 4);

  wasm.bytes(pixelsPtr, total * 4).set(new Uint8Array(image.data.buffer, image.data.byteOffset, total * 4));
  const status = wasm.exports.chores_luma_histogram_bt709(pixelsPtr, total, binsPtr);
  if (status !== CHORES_OK) throw new Error(statusMessage('luma_histogram_bt709', status));

  const bins = new Uint32Array(wasm.u32(binsPtr, HISTOGRAM_BINS));
  return { bins, total, meanLuma: meanLumaFromBins(bins, total) };
}

/** Area-average downsample, bit-identical to `downsample2dCpu`. */
export function downsample2dWasm(
  wasm: ChoresWasm,
  source: ChoreImageSource,
  width: number,
  height: number,
): Rgba8Image {
  const image = toRgba8(source);
  const srcBytes = image.width * image.height * 4;
  const dstBytes = width * height * 4;

  wasm.reset();
  const srcPtr = wasm.alloc(srcBytes);
  const dstPtr = wasm.alloc(dstBytes);

  wasm.bytes(srcPtr, srcBytes).set(new Uint8Array(image.data.buffer, image.data.byteOffset, srcBytes));
  const status = wasm.exports.chores_downsample_2d(
    srcPtr, image.width, image.height, dstPtr, width, height,
  );
  if (status !== CHORES_OK) throw new Error(statusMessage('downsample_2d', status));

  return { data: new Uint8ClampedArray(wasm.bytes(dstPtr, dstBytes)), width, height };
}

/** 256-entry u8 map over R/G/B, alpha untouched — same contract as `lutU8MapCpu`. */
export function lutU8MapWasm(
  wasm: ChoresWasm,
  source: ChoreImageSource,
  lut: Uint8Array,
): Rgba8Image {
  if (lut.length !== 256) {
    throw new Error(`gpu-chores: lut_u8_map needs a 256-entry LUT, got ${lut.length}.`);
  }
  const image = toRgba8(source);
  const pixels = image.width * image.height;
  const bytes = pixels * 4;

  wasm.reset();
  const srcPtr = wasm.alloc(bytes);
  const lutPtr = wasm.alloc(lut.length);
  const dstPtr = wasm.alloc(bytes);

  wasm.bytes(srcPtr, bytes).set(new Uint8Array(image.data.buffer, image.data.byteOffset, bytes));
  wasm.bytes(lutPtr, lut.length).set(lut);
  const status = wasm.exports.chores_lut_u8_map(srcPtr, pixels, lutPtr, dstPtr);
  if (status !== CHORES_OK) throw new Error(statusMessage('lut_u8_map', status));

  return { data: new Uint8ClampedArray(wasm.bytes(dstPtr, bytes)), width: image.width, height: image.height };
}
