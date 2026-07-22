import { UNIFORM_FIELDS, WEBGL_MAIN_UNIFORM_MAP, type UniformValues } from '../lib/shaderContract';
import { buildGLUniforms, createProgramFromSources, resizeCanvasForDpr, uploadUniform } from './canvasUtils';
import { WEBGL_VERTEX_SHADER } from './overlay';
import type { GLUniforms, RendererBackend, RendererBackendContext } from './types';

const WEBGL_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uBreathPhase;
uniform float uIntensity;
uniform float uChakraPhase;
uniform float uTheme;
uniform float uMandalaStyle;
uniform float uFigurePose;
uniform float uPhaseProgress;
uniform float uStrengthLevel;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uChakraFocus;
uniform float uGeometryDensity;
uniform float uInterference;
uniform vec2 uResolution;

out vec4 outColor;

#define PI 3.14159265359
#define TAU 6.28318530718

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

mat2 rot(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

float circle(vec2 p, float r) {
  return length(p) - r;
}

float lineSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 palette(float theme, float phase) {
  vec3 cosmic = mix(vec3(0.05, 0.75, 1.0), vec3(0.88, 0.28, 1.0), phase);
  vec3 golden = mix(vec3(1.0, 0.48, 0.12), vec3(1.0, 0.86, 0.25), phase);
  vec3 ocean = mix(vec3(0.04, 0.95, 0.78), vec3(0.10, 0.42, 1.0), phase);

  vec3 color = cosmic;
  color = mix(color, golden, smoothstep(0.35, 1.0, 1.0 - abs(theme - 1.0)));
  color = mix(color, ocean, smoothstep(0.35, 1.0, 1.0 - abs(theme - 2.0)));
  return color;
}

float starField(vec2 uv, float time) {
  vec2 grid = floor(uv * 90.0);
  vec2 cell = fract(uv * 90.0) - 0.5;
  float n = hash(grid);
  float star = smoothstep(0.045, 0.0, length(cell)) * step(0.965, n);
  return star * (0.45 + 0.55 * sin(time * 1.7 + n * TAU));
}

float mandala(vec2 p, float style, float breath, float time) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float petals = mix(8.0, 12.0, step(0.5, style));
  petals = mix(petals, 16.0, step(1.5, style));
  petals *= 0.7 + uGeometryDensity * 0.55;

  float angular = 0.5 + 0.5 * cos(a * petals + time * 0.35 + uInterference * a * 2.0);
  float ring1 = smoothstep(0.018, 0.0, abs(r - (0.42 + breath * 0.05)));
  float ring2 = smoothstep(0.014, 0.0, abs(r - 0.68));
  float ring3 = smoothstep(0.010, 0.0, abs(r - 0.92));
  float ring4 = smoothstep(0.008, 0.0, abs(r - (0.28 + breath * 0.04))) * step(0.6, uGeometryDensity);
  float lotus = smoothstep(0.35, 0.95, angular) * smoothstep(0.74, 0.20, abs(r - 0.58));
  float yantra = smoothstep(0.025, 0.0, abs(fract((a / TAU + 0.5) * 6.0 + r * 1.6) - 0.5));
  float flower = smoothstep(0.52, 1.0, angular) * smoothstep(0.34, 0.0, abs(r - (0.30 + 0.24 * angular)));

  float body = lotus;
  body = mix(body, yantra, step(0.5, style) * (1.0 - step(1.5, style)));
  body = mix(body, flower, step(1.5, style));
  return (ring1 + ring2 * 0.75 + ring3 * 0.55 + ring4 * 0.45 + body * 0.45) * smoothstep(1.28, 0.14, r);
}

float monkSilhouette(vec2 p, float breath) {
  p.y += 0.05;
  float pulse = 1.0 + breath * 0.055;
  p /= pulse;

  float shoulderY = 0.06 + breath * 0.008;
  float ribReach = breath * 0.006;

  float head = smoothstep(0.035, -0.01, circle(p - vec2(0.0, 0.30), 0.085));
  float chin = smoothstep(0.022, -0.01, circle(p - vec2(0.0, 0.245), 0.028));
  float torso = smoothstep(0.050, -0.01, lineSegment(p, vec2(0.0, 0.20), vec2(0.0, -0.13)));
  float ribL = smoothstep(0.035, -0.01, lineSegment(p, vec2(-0.055 - ribReach, 0.05), vec2(-0.10 - ribReach, -0.06)));
  float ribR = smoothstep(0.035, -0.01, lineSegment(p, vec2( 0.055 + ribReach, 0.05), vec2( 0.10 + ribReach, -0.06)));
  float shoulders = smoothstep(0.055, -0.01, lineSegment(p, vec2(-0.23, shoulderY), vec2(0.23, shoulderY)));
  float arms = smoothstep(0.050, -0.01, lineSegment(p, vec2(-0.23, shoulderY), vec2(-0.44, -0.19)));
  arms += smoothstep(0.050, -0.01, lineSegment(p, vec2(0.23, shoulderY), vec2(0.44, -0.19)));
  float legs = smoothstep(0.055, -0.01, lineSegment(p, vec2(-0.02, -0.12), vec2(-0.33, -0.36)));
  legs += smoothstep(0.055, -0.01, lineSegment(p, vec2(0.02, -0.12), vec2(0.33, -0.36)));
  float seat = smoothstep(0.035, -0.01, lineSegment(p, vec2(-0.38, -0.36), vec2(0.38, -0.36)));
  return clamp(head + chin + torso + ribL + ribR + shoulders + arms + legs + seat, 0.0, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = (fragCoord - 0.5 * uResolution.xy) / max(uResolution.y, 1.0);
  vec2 screenUv = fragCoord / max(uResolution.xy, vec2(1.0));

  float mouseDistance = length(uv - uMouse);
  float ripple = sin(mouseDistance * 42.0 - uTime * 7.0) * exp(-mouseDistance * 5.0) * uMouseStrength;
  uv += normalize(uv - uMouse + vec2(0.0001)) * ripple * 0.018;

  float breath = 0.5 + 0.5 * sin(uBreathPhase * TAU - PI * 0.5);
  float phaseMix = clamp(uChakraPhase / 3.0, 0.0, 1.0);
  vec3 accent = palette(uTheme, phaseMix);
  vec3 secondary = palette(uTheme, fract(phaseMix + 0.33));

  float vignette = smoothstep(1.15, 0.10, length(uv));
  vec3 color = vec3(0.012, 0.004, 0.035);
  color += accent * (0.05 + 0.10 * breath) * vignette;
  color += starField(screenUv + vec2(0.0, uTime * 0.006), uTime) * vec3(0.65, 0.9, 1.0);

  vec2 mandalaUv = uv * rot(uTime * 0.035);
  float mandalaGlow = mandala(mandalaUv, uMandalaStyle, breath, uTime);
  color += accent * mandalaGlow * (0.34 + 0.22 * uIntensity);
  color += secondary * pow(max(mandalaGlow, 0.0), 2.0) * 0.24;

  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 center = vec2(sin(uTime * (0.18 + fi * 0.017) + fi * 2.1), cos(uTime * (0.13 + fi * 0.021) + fi * 1.7));
    center *= 0.22 + 0.10 * fi;
    float particle = exp(-length(uv - center) * (18.0 + fi * 1.2));
    color += mix(accent, secondary, fract(fi * 0.37)) * particle * 0.045 * (0.75 + uStrengthLevel * 0.35);
  }

  float halo = exp(-length(uv) * (3.1 - breath * 0.35));
  color += accent * halo * (0.16 + 0.18 * uIntensity);

  float monk = monkSilhouette(uv, breath);
  float monkAura = exp(-abs(circle(uv + vec2(0.0, 0.04), 0.36 + breath * 0.04)) * 8.0);
  color += accent * monkAura * 0.16;
  color = mix(color, vec3(0.0, 0.0, 0.018), monk * 0.88);
  color += monk * accent * 0.07;

  color *= 0.78 + 0.32 * vignette;
  color = pow(color, vec3(0.92));
  outColor = vec4(color, 1.0);
}
`;

/** WebGL2 fallback renderer, used when WebGPU is unavailable or fails. */
export class WebGL2Backend implements RendererBackend {
  readonly mode = 'webgl2' as const;

  private cancelled = false;
  private ro: ResizeObserver | null = null;
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private vertexArray: WebGLVertexArrayObject | null = null;
  private uniforms: GLUniforms = {};
  private animationFrame: number | null = null;
  private startTime: number | null = null;
  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.ctx?.onFatalError('WebGL2 context was lost.');
  };
  private ctx: RendererBackendContext | null = null;

  start(ctx: RendererBackendContext): void {
    this.ctx = ctx;
    this.cancelled = false;
    const { canvas } = ctx;
    this.startTime = Date.now();

    const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
    if (!gl) {
      ctx.onFatalError('WebGL2 is unavailable on this browser.');
      return;
    }
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', this.onContextLost);

    try {
      this.program = createProgramFromSources(gl, WEBGL_VERTEX_SHADER, WEBGL_FRAGMENT_SHADER);
      this.vertexArray = gl.createVertexArray();
    } catch (error) {
      ctx.onFatalError('WebGL2 fallback setup failed.', error);
      return;
    }

    this.uniforms = buildGLUniforms(gl, this.program, WEBGL_MAIN_UNIFORM_MAP);

    const resize = () => {
      resizeCanvasForDpr(canvas, ctx.getMaxDevicePixelRatio(), () => gl.viewport(0, 0, canvas.width, canvas.height));
      gl.viewport(0, 0, canvas.width, canvas.height);
      ctx.overlay?.resize(ctx.getMaxDevicePixelRatio());
    };

    resize();
    this.ro = new ResizeObserver(resize);
    this.ro.observe(ctx.container);

    this.loop();
  }

  private loop = (): void => {
    const ctx = this.ctx;
    const gl = this.gl;
    if (this.cancelled || !ctx || !gl || !this.program) return;

    const canvas = ctx.canvas;
    if (canvas.width === 0 || canvas.height === 0) {
      this.animationFrame = requestAnimationFrame(this.loop);
      return;
    }

    const values = ctx.getUniformSnapshot();
    const start = this.startTime ?? Date.now();
    const currentTime = ((Date.now() - start) / 1000) * ctx.getTimeScale();

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);

    const mainValues: Partial<UniformValues> = {
      ...values,
      time: currentTime,
      resolution: { x: canvas.width, y: canvas.height },
    };
    for (const field of UNIFORM_FIELDS) {
      if (!(field.name in WEBGL_MAIN_UNIFORM_MAP)) continue;
      const value = mainValues[field.name];
      if (value === undefined) continue;
      uploadUniform(gl, this.uniforms[field.name], field, value);
    }

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    ctx.overlay?.render(currentTime, values);

    this.animationFrame = requestAnimationFrame(this.loop);
  };

  stop(): void {
    this.cancelled = true;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.ro?.disconnect();
    this.ro = null;
    this.ctx?.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    if (this.vertexArray) this.gl?.deleteVertexArray(this.vertexArray);
    if (this.program) this.gl?.deleteProgram(this.program);
    this.gl = null;
    this.program = null;
    this.vertexArray = null;
    this.ctx = null;
  }
}
