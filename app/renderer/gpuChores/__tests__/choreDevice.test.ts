import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getChoreDevice,
  getChoreDeviceReason,
  lendChoreDevice,
  subscribeChoreDevice,
} from '../choreDevice';
import { createWebGpuChoreExecutor } from '../webgpuJobs';

const fakeDevice = (label: string) => ({ label }) as unknown as GPUDevice;

afterEach(() => {
  lendChoreDevice(null, 'renderer has not booted a WebGPU device');
});

describe('choreDevice', () => {
  it('starts with nothing on loan', () => {
    expect(getChoreDevice()).toBeNull();
    expect(getChoreDeviceReason()).toBe('renderer has not booted a WebGPU device');
  });

  it('hands out the device the renderer lends', () => {
    const device = fakeDevice('a');
    lendChoreDevice(device, 'adopted renderer GPUDevice');

    expect(getChoreDevice()).toBe(device);
    expect(getChoreDeviceReason()).toBe('adopted renderer GPUDevice');
  });

  it('notifies subscribers on lend and revoke, and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeChoreDevice(listener);
    const device = fakeDevice('b');

    lendChoreDevice(device, 'adopted renderer GPUDevice');
    lendChoreDevice(null, 'renderer device lost');
    unsubscribe();
    lendChoreDevice(fakeDevice('c'), 'adopted renderer GPUDevice');

    expect(listener.mock.calls).toEqual([[device], [null]]);
  });

  it('ignores a repeated lend of the same device and reason', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeChoreDevice(listener);
    const device = fakeDevice('d');

    lendChoreDevice(device, 'adopted renderer GPUDevice');
    lendChoreDevice(device, 'adopted renderer GPUDevice');
    unsubscribe();

    expect(listener).toHaveBeenCalledOnce();
  });

  it('reports the revoke reason once the device is gone', () => {
    lendChoreDevice(fakeDevice('e'), 'adopted renderer GPUDevice');
    lendChoreDevice(null, 'renderer device lost');

    expect(getChoreDevice()).toBeNull();
    expect(getChoreDeviceReason()).toBe('renderer device lost');
  });
});

describe('createWebGpuChoreExecutor', () => {
  it('is unavailable while no device is lent, and never requests its own', async () => {
    const executor = createWebGpuChoreExecutor();

    expect(executor.isAvailable()).toBe(false);
    await expect(executor.lumaHistogram({ width: 2, height: 2, data: new Uint8ClampedArray(16) }))
      .rejects.toThrow(/not lending a GPUDevice/);
  });

  it('follows the broker once the renderer lends a device', () => {
    const executor = createWebGpuChoreExecutor();
    lendChoreDevice(fakeDevice('f'), 'adopted renderer GPUDevice');

    expect(executor.isAvailable()).toBe(true);
  });

  it('reads through an injected device source', () => {
    const device = fakeDevice('g');
    const executor = createWebGpuChoreExecutor(() => device);

    expect(executor.isAvailable()).toBe(true);
  });
});
