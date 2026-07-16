import { describe, it, expect } from 'vitest';
import {
  UNIFORM_FIELDS,
  UNIFORM_BUFFER_SIZE,
  DEFAULT_UNIFORM_VALUES,
  buildUniformBuffer,
} from '../shaderContract';

describe('shaderContract', () => {
  it('has a buffer size matching the final field offset + size', () => {
    const lastField = UNIFORM_FIELDS[UNIFORM_FIELDS.length - 1];
    expect(UNIFORM_BUFFER_SIZE).toBe(lastField.offset + lastField.size);
  });

  it('produces a 72-byte Float32Array from default values', () => {
    const buffer = buildUniformBuffer(DEFAULT_UNIFORM_VALUES);

    expect(buffer).toBeInstanceOf(Float32Array);
    expect(buffer.byteLength).toBe(UNIFORM_BUFFER_SIZE);
    expect(buffer.length).toBe(UNIFORM_BUFFER_SIZE / 4);
  });

  it('fills defaults for missing values', () => {
    const buffer = buildUniformBuffer({ time: 12.5 });

    expect(buffer[0]).toBe(12.5); // time
    expect(buffer[1]).toBe(0); // breathPhase default
    expect(buffer[UNIFORM_FIELDS.find((f) => f.name === 'mouse')!.offset / 4]).toBe(-2);
    expect(buffer[UNIFORM_FIELDS.find((f) => f.name === 'mouse')!.offset / 4 + 1]).toBe(-2);
  });

  it('packs vec2 fields in contiguous slots', () => {
    const buffer = buildUniformBuffer({ mouse: { x: 0.5, y: -0.25 } });

    const mouseField = UNIFORM_FIELDS.find((f) => f.name === 'mouse')!;
    const index = mouseField.offset / 4;

    expect(buffer[index]).toBe(0.5);
    expect(buffer[index + 1]).toBe(-0.25);
  });
});
