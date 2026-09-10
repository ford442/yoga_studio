/**
 * The single point where the renderer lends its `GPUDevice` to gpu-chores.
 *
 * Chores never call `requestAdapter` themselves: they borrow whatever the
 * WebGPU backend currently holds, which keeps adapter selection and the
 * one-shot device-loss recovery in the renderer as the only owner. When the
 * device is lost the backend lends `null` until recovery publishes the new one.
 */

let lentDevice: GPUDevice | null = null;
let lentReason = 'renderer has not booted a WebGPU device';
const listeners = new Set<(device: GPUDevice | null) => void>();

/** Publish (or revoke, with `null`) the renderer's device. */
export function lendChoreDevice(device: GPUDevice | null, reason: string): void {
  if (lentDevice === device && lentReason === reason) return;
  lentDevice = device;
  lentReason = reason;
  for (const listener of listeners) listener(device);
}

export function getChoreDevice(): GPUDevice | null {
  return lentDevice;
}

export function getChoreDeviceReason(): string {
  return lentDevice ? 'adopted renderer GPUDevice' : lentReason;
}

export function subscribeChoreDevice(listener: (device: GPUDevice | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
