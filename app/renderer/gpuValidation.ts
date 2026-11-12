import type { GpuFailureStage } from '../types/renderer';

/** A WebGPU failure tagged with the boot stage that produced it. */
export class GpuStageError extends Error {
  readonly stage: GpuFailureStage;

  constructor(stage: GpuFailureStage, message: string) {
    super(message);
    this.name = 'GpuStageError';
    this.stage = stage;
  }
}

/**
 * Run `create` inside a validation error scope. The scope stays open until
 * `create` settles (including `getCompilationInfo()` / `createRenderPipelineAsync`),
 * so Chrome/Edge async WGSL and pipeline validation surface as JS instead of
 * a silent uncaptured GPU error.
 */
export async function createWithValidationScope<T>(
  device: GPUDevice,
  stage: 'module' | 'pipeline',
  create: () => T | Promise<T>,
): Promise<T> {
  device.pushErrorScope('validation');
  let result: T | undefined;
  let createError: unknown;
  try {
    result = await create();
  } catch (error) {
    createError = error;
  }
  const scopeError = await device.popErrorScope();
  if (scopeError) {
    console.error(`[WebGPU] ${stage} validation:`, scopeError.message);
    throw new GpuStageError(stage, scopeError.message);
  }
  if (createError) {
    if (createError instanceof GpuStageError) throw createError;
    const message = createError instanceof Error ? createError.message : String(createError);
    console.error(`[WebGPU] ${stage} validation:`, message);
    throw new GpuStageError(stage, message);
  }
  return result as T;
}
