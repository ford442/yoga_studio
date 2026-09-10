import { HISTOGRAM_BINS, type ChoreImageSource, type HistogramResult, type Rgba8Image } from './types';

/**
 * BT.709 luma weights, applied to the sRGB-encoded 8-bit channels (no linearize
 * step). Kept identical to the WGSL chore so goldens line up across backends.
 */
export const BT709_LUMA = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;

/** Luma of one sRGB-encoded pixel, in the same 0..255 domain as the channels. */
export function lumaBt709(r: number, g: number, b: number): number {
  return BT709_LUMA.r * r + BT709_LUMA.g * g + BT709_LUMA.b * b;
}

/** Bin index a luma value lands in; shared by the CPU and WebGPU paths. */
export function lumaBin(luma: number): number {
  const bin = Math.round(luma);
  if (bin < 0) return 0;
  return bin > HISTOGRAM_BINS - 1 ? HISTOGRAM_BINS - 1 : bin;
}

export function isRgba8Image(source: ChoreImageSource): source is Rgba8Image {
  return typeof (source as Rgba8Image).data !== 'undefined';
}

export function imageSize(source: ChoreImageSource): { width: number; height: number } {
  return { width: source.width, height: source.height };
}

/** True when this environment can back the Canvas2D chore tier. */
export function hasCanvas2d(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return Boolean(document.createElement('canvas').getContext('2d'));
  } catch {
    return false;
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** Read any chore source into packed RGBA8 bytes (Canvas2D round trip when needed). */
export function toRgba8(source: ChoreImageSource): Rgba8Image {
  if (isRgba8Image(source)) return source;
  const { width, height } = imageSize(source);
  const canvas = createCanvas(width, height);
  const context = canvas?.getContext('2d', { willReadFrequently: true });
  if (!canvas || !context) {
    throw new Error('gpu-chores: Canvas2D is unavailable, cannot read pixels.');
  }
  context.drawImage(source as CanvasImageSource, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}

/**
 * Mean luma (0..1) read back out of the bins rather than accumulated separately,
 * so the CPU and WebGPU paths report the same number for the same image.
 */
export function meanLumaFromBins(bins: Uint32Array, total: number): number {
  if (total <= 0) return 0;
  let sum = 0;
  for (let bin = 0; bin < bins.length; bin += 1) sum += bin * bins[bin];
  return sum / total / (HISTOGRAM_BINS - 1);
}

/** Scalar BT.709 luma histogram. Alpha is ignored; pixels are counted as-is. */
export function lumaHistogramCpu(source: ChoreImageSource): HistogramResult {
  const image = toRgba8(source);
  const bins = new Uint32Array(HISTOGRAM_BINS);
  const { data } = image;
  const total = image.width * image.height;
  for (let i = 0; i < total * 4; i += 4) {
    bins[lumaBin(lumaBt709(data[i], data[i + 1], data[i + 2]))] += 1;
  }
  return { bins, total, meanLuma: meanLumaFromBins(bins, total) };
}

/** Area-average (box filter) downsample over packed bytes. */
export function downsample2dCpu(source: ChoreImageSource, width: number, height: number): Rgba8Image {
  const image = toRgba8(source);
  const out = new Uint8ClampedArray(width * height * 4);
  const xRatio = image.width / width;
  const yRatio = image.height / height;

  for (let y = 0; y < height; y += 1) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.max(y0 + 1, Math.min(image.height, Math.ceil((y + 1) * yRatio)));
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.max(x0 + 1, Math.min(image.width, Math.ceil((x + 1) * xRatio)));
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = (sy * image.width + sx) * 4;
          r += image.data[i];
          g += image.data[i + 1];
          b += image.data[i + 2];
          a += image.data[i + 3];
          count += 1;
        }
      }
      const o = (y * width + x) * 4;
      out[o] = r / count;
      out[o + 1] = g / count;
      out[o + 2] = b / count;
      out[o + 3] = a / count;
    }
  }
  return { data: out, width, height };
}

/** Canvas2D downsample — the browser's own filtered `drawImage`, for thumbs. */
export function downsample2dCanvas(source: ChoreImageSource, width: number, height: number): Rgba8Image {
  if (isRgba8Image(source)) return downsample2dCpu(source, width, height);
  const canvas = createCanvas(width, height);
  const context = canvas?.getContext('2d', { willReadFrequently: true });
  if (!canvas || !context) return downsample2dCpu(source, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return { data: context.getImageData(0, 0, width, height).data, width, height };
}

/** Apply a 256-entry u8 map to R, G and B. Alpha passes through untouched. */
export function lutU8MapCpu(source: ChoreImageSource, lut: Uint8Array): Rgba8Image {
  if (lut.length !== 256) {
    throw new Error(`gpu-chores: lut_u8_map needs a 256-entry LUT, got ${lut.length}.`);
  }
  const image = toRgba8(source);
  const out = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 4) {
    out[i] = lut[image.data[i]];
    out[i + 1] = lut[image.data[i + 1]];
    out[i + 2] = lut[image.data[i + 2]];
    out[i + 3] = image.data[i + 3];
  }
  return { data: out, width: image.width, height: image.height };
}
