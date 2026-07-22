import {
  UNIFORM_FIELDS,
  WEBGL_OVERLAY_UNIFORM_MAP,
  type UniformValues,
} from '../lib/shaderContract';
import { buildGLUniforms, createProgramFromSources, resizeCanvasForDpr, uploadUniform } from './canvasUtils';
import type { GLUniforms } from './types';

/** Fullscreen-triangle vertex shader shared by the WebGL2 fallback and the overlay. */
export const WEBGL_VERTEX_SHADER = `#version 300 es
precision highp float;

const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

void main() {
  gl_Position = vec4(POSITIONS[gl_VertexID], 0.0, 1.0);
}
`;

const WEBGL_OVERLAY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uBreathPhase;
uniform float uPhaseProgress;
uniform float uChakraPhase;
uniform float uIntensity;
uniform float uInterference;
uniform float uGeometryDensity;
uniform float uQualityPreset;
uniform float uTheme;
uniform vec2 uResolution;

out vec4 outColor;

#define PI 3.14159265359
#define TAU 6.28318530718

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float curve(float t, float d) {
  t /= d;
  return mix(floor(t), floor(t) + 1.0, pow(smoothstep(0.0, 1.0, fract(t)), 20.0));
}

float dHex(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.73))), p.x);
}

float dTri(vec2 p) {
  float a = atan(p.x, p.y) + PI;
  float r = TAU / 3.0;
  return cos(floor(0.5 + a / r) * r - a) * length(p);
}

float strokeRing(float dist, float thickness, float blur) {
  return 1.0 - smoothstep(0.0, thickness, abs(dist) - blur);
}

float hexRing(vec2 p, float radius, float thickness, float blur) {
  return strokeRing(dHex(p) - radius, thickness, blur);
}

float triRing(vec2 p, float radius, float thickness, float blur) {
  return strokeRing(dTri(p) - radius, thickness, blur);
}

float circleRing(vec2 p, float radius, float thickness, float blur) {
  return strokeRing(length(p) - radius, thickness, blur);
}

vec2 moda(vec2 p, float repetitions) {
  float angle = TAU / repetitions;
  float a = atan(p.y, p.x) + angle * 0.5;
  a = mod(a, angle) - angle * 0.5;
  return vec2(cos(a), sin(a)) * length(p);
}

vec3 overlayPalette(float theme, float phase) {
  vec3 cosmic = mix(vec3(0.35, 0.72, 1.0), vec3(0.82, 0.42, 1.0), phase);
  vec3 golden = mix(vec3(1.0, 0.62, 0.22), vec3(1.0, 0.88, 0.42), phase);
  vec3 ocean = mix(vec3(0.22, 0.92, 0.82), vec3(0.28, 0.58, 1.0), phase);
  vec3 color = cosmic;
  color = mix(color, golden, smoothstep(0.35, 1.0, 1.0 - abs(theme - 1.0)));
  color = mix(color, ocean, smoothstep(0.35, 1.0, 1.0 - abs(theme - 2.0)));
  return color;
}

float floatingShape(vec2 p, float sides, float size, float rot) {
  float r = length(p);
  float a = atan(p.y, p.x) + rot;
  float sector = TAU / sides;
  float sa = mod(a + sector * 0.5, sector) - sector * 0.5;
  float d = abs(r - size * 0.5) + abs(sa) * r * 1.4;
  return smoothstep(size * 0.18, 0.0, d);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / max(uResolution.y, 1.0);
  float breath = 0.5 + 0.5 * sin(uBreathPhase * TAU - PI * 0.5);
  float tt = 0.3 * uTime;
  float anim = curve(tt, 2.0);
  float phaseMix = clamp(uChakraPhase / 3.0, 0.0, 1.0);
  vec3 accent = overlayPalette(uTheme, phaseMix);

  vec2 uvr = uv * (1.15 + breath * 0.05);
  float lineWidth = mix(0.0022, 0.0015, step(0.5, uQualityPreset));
  float blur = 0.001;
  float glow = 0.35;

  float rings = 0.0;
  rings += hexRing(uvr, 0.62, lineWidth, blur);
  rings += glow * hexRing(uvr, 0.62, lineWidth * 5.0, blur);

  vec2 uv0 = rot(-PI * anim) * uvr;
  rings += hexRing(uv0, 0.31, lineWidth, blur);
  rings += glow * hexRing(uv0, 0.31, lineWidth * 5.0, blur);

  vec2 uv1 = rot(PI * anim) * uvr;
  rings += triRing(uv1, 0.34, lineWidth, blur);
  rings += glow * triRing(uv1, 0.34, lineWidth * 5.0, blur);

  vec2 uv2 = rot(PI - anim * PI) * uvr;
  rings += triRing(uv2, 0.22, lineWidth, blur);

  if (uQualityPreset >= 0.5) {
    vec2 uv3 = rot(PI * 0.5) * uvr;
    uv3 = rot(PI * anim) * uv3;
    uv3 = moda(uv3, 6.0);
    uv3.x -= mix(0.22, 0.48, abs(mod(anim, 2.0) - 1.0));
    rings += circleRing(uv3, 0.12, lineWidth, blur);
    rings += glow * circleRing(uv3, 0.12, lineWidth * 5.0, blur);
  }

  float ringPulse = mix(0.0, 0.55, sin(tt * PI) * 0.5 + 0.5);
  vec3 ringCol = mix(vec3(0.76, 0.85, 1.0), accent, 0.35) * rings * ringPulse;

  vec3 shapes = vec3(0.0);
  float shapeAlpha = 0.0;
  int layerCount = uQualityPreset >= 0.5 ? 6 : 3;

  for (int i = 0; i < 6; i++) {
    if (i >= layerCount) break;
    float fi = float(i);
    float sides = mix(3.0, 8.0, fract(fi * 0.37));
    vec2 anchor = vec2(
      sin(uTime * (0.11 + fi * 0.013) + fi * 1.9),
      cos(uTime * (0.09 + fi * 0.017) + fi * 2.4)
    ) * (0.55 + fi * 0.08);
    vec2 local = rot(uTime * (0.04 + fi * 0.01) + anim * 0.35) * (uv - anchor);
    float shape = floatingShape(local, sides, 0.14 + fi * 0.015, fi * 0.8);
    float layerAlpha = shape * (0.08 + uIntensity * 0.06) * (1.0 - fi * 0.08);
    shapes += accent * layerAlpha;
    shapeAlpha = max(shapeAlpha, layerAlpha);
  }

  float orbit = circleRing(rot(uTime * 0.08 + anim) * uvr, 0.88 + breath * 0.04, lineWidth * 0.8, blur);
  ringCol += accent * orbit * 0.22;

  vec3 color = ringCol + shapes;
  float alpha = clamp(max(rings * 0.28, shapeAlpha) * (0.42 + uIntensity * 0.18), 0.0, 0.72);
  alpha *= smoothstep(1.35, 0.15, length(uv));
  outColor = vec4(color, alpha);
}
`;

/**
 * The transparent WebGL2 geometry overlay drawn on top of either the WebGPU
 * or WebGL2 main renderer. Owns its own GL context, program, and canvas sizing.
 */
export class GeometryOverlay {
  private readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexArray: WebGLVertexArrayObject | null = null;
  private uniforms: GLUniforms = {};

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /** Returns true if the overlay GL context + program initialized successfully. */
  init(): boolean {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) {
      console.warn('[GeometryOverlay] WebGL2 overlay is unavailable.');
      return false;
    }

    try {
      this.gl = gl;
      this.program = createProgramFromSources(gl, WEBGL_VERTEX_SHADER, WEBGL_OVERLAY_FRAGMENT_SHADER);
      this.vertexArray = gl.createVertexArray();
      this.uniforms = buildGLUniforms(gl, this.program, WEBGL_OVERLAY_UNIFORM_MAP);
      return true;
    } catch (error) {
      console.warn('[GeometryOverlay] WebGL2 overlay setup failed:', error);
      this.gl = null;
      this.program = null;
      return false;
    }
  }

  resize(maxDpr: number): void {
    const gl = this.gl;
    resizeCanvasForDpr(this.canvas, maxDpr, () => gl?.viewport(0, 0, this.canvas.width, this.canvas.height));
  }

  render(time: number, values: Partial<UniformValues>): void {
    const { gl, program, vertexArray, uniforms } = this;
    if (!gl || !program || this.canvas.width === 0 || this.canvas.height === 0) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vertexArray);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const overlayValues: Partial<UniformValues> = {
      ...values,
      time,
      resolution: { x: this.canvas.width, y: this.canvas.height },
    };
    for (const field of UNIFORM_FIELDS) {
      if (!(field.name in WEBGL_OVERLAY_UNIFORM_MAP)) continue;
      const value = overlayValues[field.name];
      if (value === undefined) continue;
      uploadUniform(gl, uniforms[field.name], field, value);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  destroy(): void {
    if (this.vertexArray) this.gl?.deleteVertexArray(this.vertexArray);
    if (this.program) this.gl?.deleteProgram(this.program);
    this.gl = null;
    this.program = null;
    this.vertexArray = null;
  }
}
