import type { UNIFORM_FIELDS } from '../lib/shaderContract';
import type { GLUniforms } from './types';

/** Resize a canvas's backing store to its CSS size × a capped DPR. Returns false if not yet visible. */
export const resizeCanvasForDpr = (
  canvas: HTMLCanvasElement,
  maxDpr: number,
  onResize?: () => void
): boolean => {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);

  if (w === 0 || h === 0) return false;

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    onResize?.();
  }
  return true;
};

/** Upload one shader-contract field to a WebGL2 uniform location. */
export const uploadUniform = (
  gl: WebGL2RenderingContext,
  location: WebGLUniformLocation | null,
  field: (typeof UNIFORM_FIELDS)[number],
  value: number | { x: number; y: number }
): void => {
  if (location === null) return;
  if (field.type === 'vec2<f32>') {
    const vec = typeof value === 'number' ? { x: value, y: value } : value;
    gl.uniform2f(location, vec.x, vec.y);
  } else {
    gl.uniform1f(location, value as number);
  }
};

/** Look up WebGL2 uniform locations from a contract → GLSL name map. */
export const buildGLUniforms = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  map: Record<string, string>
): GLUniforms => {
  const uniforms: GLUniforms = {};
  for (const [fieldName, glslName] of Object.entries(map)) {
    uniforms[fieldName] = gl.getUniformLocation(program, glslName);
  }
  return uniforms;
};

export const createShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL2 shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'Unknown WebGL2 shader compile error';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
};

export const createProgramFromSources = (
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL2 program.');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown WebGL2 program link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
};
