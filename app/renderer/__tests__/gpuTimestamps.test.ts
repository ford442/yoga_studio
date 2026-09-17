import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  READBACK_INTERVAL_FRAMES,
  TIMESTAMP_QUERY_SLOTS,
  createGpuFrameTimer,
  supportsTimestampQuery,
} from '../gpuTimestamps';

const RESOLVE_BYTES = TIMESTAMP_QUERY_SLOTS * 8;

/** Backing store the fake staging buffer hands back from `getMappedRange`. */
function timestampBytes(values: bigint[]): ArrayBuffer {
  const buffer = new ArrayBuffer(RESOLVE_BYTES);
  const view = new BigUint64Array(buffer);
  values.forEach((value, index) => { view[index] = value; });
  return buffer;
}

function makeDevice(options: {
  features?: string[];
  createQuerySet?: unknown;
  mapped?: ArrayBuffer;
  mapRejects?: boolean;
} = {}) {
  const mapped = options.mapped ?? timestampBytes([0n, 0n, 0n, 0n]);
  const staging = {
    mapAsync: vi.fn(() => (options.mapRejects ? Promise.reject(new Error('device lost')) : Promise.resolve())),
    getMappedRange: vi.fn(() => mapped),
    unmap: vi.fn(),
    destroy: vi.fn(),
  };
  let bufferCount = 0;
  const device = {
    features: new Set(options.features ?? ['timestamp-query']),
    createQuerySet:
      'createQuerySet' in options
        ? (options.createQuerySet as () => unknown)
        : vi.fn(() => ({ destroy: vi.fn() })),
    createBuffer: vi.fn(() => {
      bufferCount += 1;
      // Second buffer is the MAP_READ staging target.
      return bufferCount === 2 ? staging : { destroy: vi.fn() };
    }),
  };
  return { device: device as unknown as GPUDevice, staging };
}

function makeEncoder() {
  return {
    resolveQuerySet: vi.fn(),
    copyBufferToBuffer: vi.fn(),
  } as unknown as GPUCommandEncoder;
}

/** Advance to the next sampled frame and return whether it sampled. */
function runToSampledFrame(timer: { beginFrame(): boolean }): boolean {
  let sampled = false;
  for (let i = 0; i < READBACK_INTERVAL_FRAMES; i += 1) sampled = timer.beginFrame();
  return sampled;
}

describe('supportsTimestampQuery', () => {
  it('reads the device feature set', () => {
    expect(supportsTimestampQuery({ features: new Set(['timestamp-query']) } as unknown as GPUDevice)).toBe(true);
    expect(supportsTimestampQuery({ features: new Set<string>() } as unknown as GPUDevice)).toBe(false);
  });
});

describe('createGpuFrameTimer', () => {
  beforeEach(() => {
    vi.stubGlobal('GPUBufferUsage', { QUERY_RESOLVE: 1, COPY_SRC: 2, COPY_DST: 4, MAP_READ: 8 });
    vi.stubGlobal('GPUMapMode', { READ: 1 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns null without the feature, so boot still succeeds', () => {
    const { device } = makeDevice({ features: [] });
    expect(createGpuFrameTimer(device)).toBeNull();
  });

  it('returns null when the query set cannot be created', () => {
    const { device } = makeDevice({
      createQuerySet: () => { throw new Error('OOM'); },
    });
    expect(createGpuFrameTimer(device)).toBeNull();
  });

  it('allocates a 4-slot timestamp query set', () => {
    const { device } = makeDevice();
    const timer = createGpuFrameTimer(device);
    expect(timer).not.toBeNull();
    expect(device.createQuerySet).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'timestamp', count: TIMESTAMP_QUERY_SLOTS }),
    );
    expect(timer?.status()).toBe('on');
  });

  it('samples one frame in N rather than every frame', () => {
    const { device } = makeDevice();
    const timer = createGpuFrameTimer(device)!;
    const sampled: boolean[] = [];
    for (let i = 0; i < READBACK_INTERVAL_FRAMES * 2; i += 1) sampled.push(timer.beginFrame());
    expect(sampled.filter(Boolean)).toHaveLength(2);
    // Unsampled frames must not attach timestampWrites or encode a resolve.
    expect(timer.beginFrame()).toBe(false);
    expect(timer.sceneWrites()).toBeUndefined();
    const encoder = makeEncoder();
    timer.resolve(encoder);
    expect(encoder.resolveQuerySet).not.toHaveBeenCalled();
  });

  it('writes begin/end indices around the scene pass and resolves once', async () => {
    const { device, staging } = makeDevice({ mapped: timestampBytes([1_000_000n, 9_000_000n, 0n, 0n]) });
    const timer = createGpuFrameTimer(device)!;
    expect(runToSampledFrame(timer)).toBe(true);
    expect(timer.sceneWrites()).toEqual(
      expect.objectContaining({ beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 }),
    );

    const encoder = makeEncoder();
    timer.resolve(encoder);
    expect(encoder.resolveQuerySet).toHaveBeenCalledWith(
      expect.anything(), 0, TIMESTAMP_QUERY_SLOTS, expect.anything(), 0,
    );
    expect(encoder.copyBufferToBuffer).toHaveBeenCalled();

    timer.readback();
    // The render loop never awaited anything — the value lands on a later task.
    expect(timer.lastGpuPassMs()).toBeNull();
    await vi.waitFor(() => expect(timer.lastGpuPassMs()).toBe(8));
    expect(staging.unmap).toHaveBeenCalled();
  });

  it('adds an auxiliary pass to the frame total when one is sampled', async () => {
    const { device } = makeDevice({
      mapped: timestampBytes([0n, 4_000_000n, 10_000_000n, 13_000_000n]),
    });
    const timer = createGpuFrameTimer(device)!;
    runToSampledFrame(timer);
    // Slot 0 is 0 here, so only the aux pair is plausible; a bad scene pair
    // discards the whole sample rather than reporting half a frame.
    timer.auxWrites();
    timer.resolve(makeEncoder());
    timer.readback();
    await vi.waitFor(() => expect(timer.lastGpuPassMs()).toBeNull());

    const good = makeDevice({ mapped: timestampBytes([1_000_000n, 5_000_000n, 6_000_000n, 9_000_000n]) });
    const timer2 = createGpuFrameTimer(good.device)!;
    runToSampledFrame(timer2);
    timer2.auxWrites();
    timer2.resolve(makeEncoder());
    timer2.readback();
    await vi.waitFor(() => expect(timer2.lastGpuPassMs()).toBe(7));
  });

  it('keeps at most one readback in flight so frames never queue up', () => {
    const { device, staging } = makeDevice();
    let release!: () => void;
    staging.mapAsync.mockImplementation(() => new Promise<void>((done) => { release = () => done(); }));
    const timer = createGpuFrameTimer(device)!;
    runToSampledFrame(timer);
    timer.resolve(makeEncoder());
    timer.readback();
    // Next interval must not start a second map while the first is pending.
    expect(runToSampledFrame(timer)).toBe(false);
    expect(staging.mapAsync).toHaveBeenCalledTimes(1);
    release();
  });

  it('stops sampling when the readback rejects (lost device)', async () => {
    const { device } = makeDevice({ mapRejects: true });
    const timer = createGpuFrameTimer(device)!;
    runToSampledFrame(timer);
    timer.resolve(makeEncoder());
    timer.readback();
    await vi.waitFor(() => expect(timer.status()).toBe('off'));
    expect(timer.lastGpuPassMs()).toBeNull();
    expect(timer.beginFrame()).toBe(false);
  });

  it('destroy releases the query set and reports nothing further', () => {
    const querySet = { destroy: vi.fn() };
    const { device } = makeDevice({ createQuerySet: () => querySet });
    const timer = createGpuFrameTimer(device)!;
    timer.destroy();
    expect(querySet.destroy).toHaveBeenCalled();
    expect(timer.beginFrame()).toBe(false);
    expect(timer.lastGpuPassMs()).toBeNull();
    expect(timer.status()).toBe('off');
  });
});
