'use client';

import React, { useEffect, useRef, useState } from 'react';
import { resolveAssetUrl } from '../lib/resolveAssetUrl';

interface WebGPUShaderProps {
  breathPhase: number;
  intensity?: number;
  chakraPhase?: number;
  phaseProgress?: number;
  theme?: number;
  mandalaStyle?: number;
  figurePose?: number; // 0=lotus, 1=tadasana, 2=tai-chi, 3=heart-open, 4=chinmudra, 5=warrior, 6=tree
  mouse?: { x: number; y: number };
  mouseStrength?: number;
  timeScale?: number;
  strengthLevel?: number; // 0.0=light, 1.0=regular, 2.0=strong
  chakraFocus?: number; // -1=none, 0..6=root..crown
  geometryDensity?: number; // 0.0=sparse, 1.0=default, 3.0=rich
  interference?: number;    // 0.0=still, 1.0=strong moire/interference
  qualityPreset?: number;   // 0=mobile, 1=high, undefined=auto-detect
  overlayEnabled?: boolean; // WebGL2 transparent geometry layer on top of WebGPU
  className?: string;
  shaderPath?: string;
  vertexEntry?: string;
  fragmentEntry?: string;
}

type RendererMode = 'webgpu' | 'webgl2';

type ShaderPropsRef = Required<Pick<
  WebGPUShaderProps,
  | 'breathPhase'
  | 'intensity'
  | 'chakraPhase'
  | 'phaseProgress'
  | 'theme'
  | 'mandalaStyle'
  | 'figurePose'
  | 'mouse'
  | 'mouseStrength'
  | 'timeScale'
  | 'strengthLevel'
  | 'chakraFocus'
  | 'geometryDensity'
  | 'interference'
  | 'qualityPreset'
>>;

const resolveQualityPreset = (explicit?: number): number => {
  if (explicit !== undefined) return explicit >= 0.5 ? 1 : 0;
  if (typeof window === 'undefined') return 1;
  return window.innerWidth < 768 ? 0 : 1;
};

const WEBGL_VERTEX_SHADER = `#version 300 es
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

const createShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
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

const createProgram = (gl: WebGL2RenderingContext): WebGLProgram => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, WEBGL_VERTEX_SHADER);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, WEBGL_FRAGMENT_SHADER);
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

const createOverlayProgram = (gl: WebGL2RenderingContext): WebGLProgram => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, WEBGL_VERTEX_SHADER);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, WEBGL_OVERLAY_FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL2 overlay program.');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'Unknown WebGL2 overlay program link error';
    gl.deleteProgram(program);
    throw new Error(log);
  }

  return program;
};

type OverlayUniforms = {
  time: WebGLUniformLocation | null;
  breathPhase: WebGLUniformLocation | null;
  phaseProgress: WebGLUniformLocation | null;
  chakraPhase: WebGLUniformLocation | null;
  intensity: WebGLUniformLocation | null;
  interference: WebGLUniformLocation | null;
  geometryDensity: WebGLUniformLocation | null;
  qualityPreset: WebGLUniformLocation | null;
  theme: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
};

const WebGPUShader: React.FC<WebGPUShaderProps> = ({
  breathPhase,
  intensity = 1.0,
  chakraPhase = 0,
  phaseProgress = 0,
  theme = 0,
  mandalaStyle = 0,
  figurePose = 0,
  mouse = { x: -2, y: -2 },
  mouseStrength = 0,
  timeScale = 1.0,
  strengthLevel = 1.0,
  chakraFocus = -1,
  geometryDensity = 1.0,
  interference = 0.5,
  qualityPreset,
  overlayEnabled = true,
  className = '',
  shaderPath = 'sacred-lotus-final.wgsl',
  vertexEntry = 'vs',
  fragmentEntry = 'main',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>('webgpu');

  const resolvedQuality = resolveQualityPreset(qualityPreset);

  // Mutable refs for animated values so the graphics backend only initializes once.
  const propsRef = useRef<ShaderPropsRef>({
    breathPhase,
    intensity,
    chakraPhase,
    phaseProgress,
    theme,
    mandalaStyle,
    figurePose,
    mouse,
    mouseStrength,
    timeScale,
    strengthLevel,
    chakraFocus,
    geometryDensity,
    interference,
    qualityPreset: resolvedQuality,
  });

  useEffect(() => {
    propsRef.current = {
      breathPhase,
      intensity,
      chakraPhase,
      phaseProgress,
      theme,
      mandalaStyle,
      figurePose,
      mouse,
      mouseStrength,
      timeScale,
      strengthLevel,
      chakraFocus,
      geometryDensity,
      interference,
      qualityPreset: resolveQualityPreset(qualityPreset),
    };
  }, [breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, figurePose, mouse, mouseStrength, timeScale, strengthLevel, chakraFocus, geometryDensity, interference, qualityPreset]);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let glContext: WebGL2RenderingContext | null = null;
    let glProgram: WebGLProgram | null = null;
    let glVertexArray: WebGLVertexArrayObject | null = null;
    let overlayGl: WebGL2RenderingContext | null = null;
    let overlayProgram: WebGLProgram | null = null;
    let overlayVertexArray: WebGLVertexArrayObject | null = null;
    let overlayUniforms: OverlayUniforms | null = null;

    const markWebGPUFailed = (message: string, error?: unknown) => {
      console.warn(`[WebGPUShader] ${message} Falling back to WebGL2.`, error);
      if (!cancelled) setRendererMode('webgl2');
    };

    const resizeCanvas = (canvas: HTMLCanvasElement, onResize?: () => void) => {
      const dpr = window.devicePixelRatio || 1;
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

    const renderOverlayFrame = (currentTime: number) => {
      if (!overlayEnabled || !overlayGl || !overlayProgram || !overlayUniforms) return;

      const overlayCanvas = overlayCanvasRef.current;
      if (!overlayCanvas || overlayCanvas.width === 0 || overlayCanvas.height === 0) return;

      const {
        breathPhase: bp,
        intensity: int,
        chakraPhase: cp,
        phaseProgress: pp,
        theme: th,
        geometryDensity: gd,
        interference: ir,
        qualityPreset: qp,
      } = propsRef.current;

      const gl = overlayGl;
      gl.viewport(0, 0, overlayCanvas.width, overlayCanvas.height);
      gl.useProgram(overlayProgram);
      gl.bindVertexArray(overlayVertexArray);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(overlayUniforms.time, currentTime);
      gl.uniform1f(overlayUniforms.breathPhase, bp);
      gl.uniform1f(overlayUniforms.phaseProgress, pp);
      gl.uniform1f(overlayUniforms.chakraPhase, cp);
      gl.uniform1f(overlayUniforms.intensity, int);
      gl.uniform1f(overlayUniforms.interference, ir);
      gl.uniform1f(overlayUniforms.geometryDensity, gd);
      gl.uniform1f(overlayUniforms.qualityPreset, qp);
      gl.uniform1f(overlayUniforms.theme, th);
      gl.uniform2f(overlayUniforms.resolution, overlayCanvas.width, overlayCanvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const initOverlay = () => {
      if (!overlayEnabled) return;

      const overlayCanvas = overlayCanvasRef.current;
      if (!overlayCanvas) return;

      const gl = overlayCanvas.getContext('webgl2', {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
      });
      if (!gl) {
        console.warn('[WebGPUShader] WebGL2 overlay is unavailable.');
        return;
      }

      overlayGl = gl;
      try {
        overlayProgram = createOverlayProgram(gl);
        overlayVertexArray = gl.createVertexArray();
        overlayUniforms = {
          time: gl.getUniformLocation(overlayProgram, 'uTime'),
          breathPhase: gl.getUniformLocation(overlayProgram, 'uBreathPhase'),
          phaseProgress: gl.getUniformLocation(overlayProgram, 'uPhaseProgress'),
          chakraPhase: gl.getUniformLocation(overlayProgram, 'uChakraPhase'),
          intensity: gl.getUniformLocation(overlayProgram, 'uIntensity'),
          interference: gl.getUniformLocation(overlayProgram, 'uInterference'),
          geometryDensity: gl.getUniformLocation(overlayProgram, 'uGeometryDensity'),
          qualityPreset: gl.getUniformLocation(overlayProgram, 'uQualityPreset'),
          theme: gl.getUniformLocation(overlayProgram, 'uTheme'),
          resolution: gl.getUniformLocation(overlayProgram, 'uResolution'),
        };
      } catch (error) {
        console.warn('[WebGPUShader] WebGL2 overlay setup failed:', error);
        overlayGl = null;
        overlayProgram = null;
      }
    };

    initOverlay();

    const initWebGL2 = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!startTimeRef.current) startTimeRef.current = Date.now();

      const gl = canvas.getContext('webgl2', { alpha: true, antialias: true });
      if (!gl) {
        console.error('[WebGPUShader] WebGL2 fallback is unavailable on this browser.');
        return;
      }
      glContext = gl;

      try {
        glProgram = createProgram(gl);
        glVertexArray = gl.createVertexArray();
      } catch (error) {
        console.error('[WebGPUShader] WebGL2 fallback setup failed:', error);
        return;
      }

      const uniforms = {
        time: gl.getUniformLocation(glProgram, 'uTime'),
        breathPhase: gl.getUniformLocation(glProgram, 'uBreathPhase'),
        intensity: gl.getUniformLocation(glProgram, 'uIntensity'),
        chakraPhase: gl.getUniformLocation(glProgram, 'uChakraPhase'),
        theme: gl.getUniformLocation(glProgram, 'uTheme'),
        mandalaStyle: gl.getUniformLocation(glProgram, 'uMandalaStyle'),
        figurePose: gl.getUniformLocation(glProgram, 'uFigurePose'),
        phaseProgress: gl.getUniformLocation(glProgram, 'uPhaseProgress'),
        strengthLevel: gl.getUniformLocation(glProgram, 'uStrengthLevel'),
        mouse: gl.getUniformLocation(glProgram, 'uMouse'),
        mouseStrength: gl.getUniformLocation(glProgram, 'uMouseStrength'),
        chakraFocus: gl.getUniformLocation(glProgram, 'uChakraFocus'),
        geometryDensity: gl.getUniformLocation(glProgram, 'uGeometryDensity'),
        interference: gl.getUniformLocation(glProgram, 'uInterference'),
        resolution: gl.getUniformLocation(glProgram, 'uResolution'),
      };

      const resize = () => {
        resizeCanvas(canvas, () => gl.viewport(0, 0, canvas.width, canvas.height));
        gl.viewport(0, 0, canvas.width, canvas.height);
        const overlayCanvas = overlayCanvasRef.current;
        if (overlayCanvas) {
          resizeCanvas(overlayCanvas, () => overlayGl?.viewport(0, 0, overlayCanvas.width, overlayCanvas.height));
        }
      };

      resize();
      const observeTarget = containerRef.current ?? canvas;
      ro = new ResizeObserver(resize);
      ro.observe(observeTarget);

      const loop = () => {
        if (cancelled || !glProgram) return;

        if (canvas.width === 0 || canvas.height === 0) {
          animationRef.current = requestAnimationFrame(loop);
          return;
        }

        const {
          breathPhase: bp,
          intensity: int,
          chakraPhase: cp,
          phaseProgress: pp,
          theme: th,
          mandalaStyle: ms,
          figurePose: fp,
          mouse: m,
          mouseStrength: msr,
          timeScale: ts,
          strengthLevel: sl,
          chakraFocus: cf,
          geometryDensity: gd,
          interference: ir,
        } = propsRef.current;
        const start = startTimeRef.current ?? Date.now();
        const currentTime = ((Date.now() - start) / 1000) * ts;

        gl.useProgram(glProgram);
        gl.bindVertexArray(glVertexArray);
        gl.uniform1f(uniforms.time, currentTime);
        gl.uniform1f(uniforms.breathPhase, bp);
        gl.uniform1f(uniforms.intensity, int);
        gl.uniform1f(uniforms.chakraPhase, cp);
        gl.uniform1f(uniforms.theme, th);
        gl.uniform1f(uniforms.mandalaStyle, ms);
        gl.uniform1f(uniforms.figurePose, fp);
        gl.uniform1f(uniforms.phaseProgress, pp);
        gl.uniform1f(uniforms.strengthLevel, sl);
        gl.uniform2f(uniforms.mouse, m.x, m.y);
        gl.uniform1f(uniforms.mouseStrength, msr);
        gl.uniform1f(uniforms.chakraFocus, cf);
        gl.uniform1f(uniforms.geometryDensity, gd);
        gl.uniform1f(uniforms.interference, ir);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        renderOverlayFrame(currentTime);

        animationRef.current = requestAnimationFrame(loop);
      };

      loop();
    };

    const initWebGPU = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!startTimeRef.current) startTimeRef.current = Date.now();

      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        markWebGPUFailed('WebGPU is unavailable.');
        return;
      }

      let device: GPUDevice;
      try {
        device = await adapter.requestDevice();
      } catch (error) {
        markWebGPUFailed('Unable to request a WebGPU device.', error);
        return;
      }

      if (cancelled) {
        device.destroy();
        return;
      }
      deviceRef.current = device;
      device.lost.then((info) => {
        if (!cancelled) markWebGPUFailed(`WebGPU device was lost (${info.reason}).`, info.message);
      });

      const context = canvas.getContext('webgpu');
      if (!context) {
        markWebGPUFailed('Unable to create a WebGPU canvas context.');
        return;
      }

      const format = navigator.gpu.getPreferredCanvasFormat();
      const configure = () => {
        try {
          context.configure({ device, format, alphaMode: 'premultiplied' });
        } catch (error) {
          markWebGPUFailed('Failed to configure the WebGPU context.', error);
        }
      };

      const resize = () => {
        resizeCanvas(canvas, configure);
        const overlayCanvas = overlayCanvasRef.current;
        if (overlayCanvas) {
          resizeCanvas(overlayCanvas, () => overlayGl?.viewport(0, 0, overlayCanvas.width, overlayCanvas.height));
        }
      };

      resize();
      const observeTarget = containerRef.current ?? canvas;
      ro = new ResizeObserver(resize);
      ro.observe(observeTarget);

      let pipeline: GPURenderPipeline | null = null;
      let uniformBuffer: GPUBuffer | null = null;
      let bindGroup: GPUBindGroup | null = null;

      try {
        const shaderUrl = resolveAssetUrl(shaderPath);
        const shaderResponse = await fetch(shaderUrl);
        if (!shaderResponse.ok) {
          throw new Error(`Shader load failed: ${shaderResponse.status} ${shaderUrl}`);
        }

        const shaderCode = await shaderResponse.text();
        const shaderModule = device.createShaderModule({ code: shaderCode });
        pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: shaderModule, entryPoint: vertexEntry },
          fragment: { module: shaderModule, entryPoint: fragmentEntry, targets: [{ format }] },
          primitive: { topology: 'triangle-list' },
        });
        // Uniforms struct layout (WGSL std140 alignment, 4 bytes per float):
        //   [0]  time           @byte  0
        //   [1]  breathPhase    @byte  4
        //   [2]  intensity      @byte  8
        //   [3]  chakraPhase    @byte 12
        //   [4]  theme          @byte 16
        //   [5]  mandalaStyle   @byte 20
        //   [6]  phaseProgress  @byte 24
        //   [7]  strengthLevel  @byte 28   // 0.0=light, 1.0=regular, 2.0=strong
        //   [8]  mouse.x        @byte 32  (vec2<f32>, align 8)
        //   [9]  mouse.y        @byte 36
        //   [10] mouseStrength  @byte 40
        //   [11] chakraFocus    @byte 44   // -1=none, 0..6=root..crown
        //   [12] resolution.x   @byte 48  (vec2<f32>, align 8)
        //   [13] resolution.y   @byte 52
        //   [14] geometryDensity @byte 56  // 0.0=sparse, 1.0=default, 3.0=rich
        //   [15] interference    @byte 60  // 0.0=still, 1.0=strong moire/interference
        //   [16] figurePose      @byte 64  // 0=lotus, 1=tadasana, 2=tai-chi, 3=heart-open, 4=chinmudra, 5=warrior, 6=tree
        //   [17] qualityPreset   @byte 68  // 0.0=mobile, 1.0=high
        //   Total struct size: 72 bytes (WebGPU uniform buffer alignment)
        uniformBuffer = device.createBuffer({
          size: 72,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });
      } catch (error) {
        markWebGPUFailed('WebGPU pipeline setup failed.', error);
        return;
      }

      // Force a final size measurement + reconfigure now that the (potentially
      // slow) shader fetch + pipeline creation is complete. This guarantees the
      // canvas has its real layout size even if the early measurement was 0.
      resize();

      const loop = () => {
        if (cancelled || !device || !pipeline || !uniformBuffer || !context || !bindGroup) return;

        // Skip render if canvas is 0px (not yet visible).
        if (canvas.width === 0 || canvas.height === 0) {
          animationRef.current = requestAnimationFrame(loop);
          return;
        }

        const {
          breathPhase: bp,
          intensity: int,
          chakraPhase: cp,
          phaseProgress: pp,
          theme: th,
          mandalaStyle: ms,
          figurePose: fp,
          mouse: m,
          mouseStrength: msr,
          timeScale: ts,
          strengthLevel: sl,
          chakraFocus: cf,
          geometryDensity: gd,
          interference: ir,
          qualityPreset: qp,
        } = propsRef.current;
        const start = startTimeRef.current ?? Date.now();
        const now = (Date.now() - start) / 1000;
        const currentTime = now * ts;
        const w = canvas.width;
        const h = canvas.height;

        const uniforms = new Float32Array([
          currentTime,   //  [0] time
          bp,            //  [1] breathPhase
          int,           //  [2] intensity
          cp,            //  [3] chakraPhase
          th,            //  [4] theme
          ms,            //  [5] mandalaStyle
          pp,            //  [6] phaseProgress
          sl,            //  [7] strengthLevel
          m.x,           //  [8] mouse.x
          m.y,           //  [9] mouse.y
          msr,           // [10] mouseStrength
          cf,            // [11] chakraFocus
          w,             // [12] resolution.x
          h,             // [13] resolution.y
          gd,            // [14] geometryDensity
          ir,            // [15] interference
          fp,            // [16] figurePose
          qp,            // [17] qualityPreset
        ]);

        try {
          device.queue.writeBuffer(uniformBuffer, 0, uniforms);

          const encoder = device.createCommandEncoder();
          const view = context.getCurrentTexture().createView();

          const pass = encoder.beginRenderPass({
            colorAttachments: [{ view, clearValue: [0, 0, 0, 1], loadOp: 'clear', storeOp: 'store' }],
          });

          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.draw(6);
          pass.end();

          device.queue.submit([encoder.finish()]);
          renderOverlayFrame(currentTime);
        } catch (error) {
          markWebGPUFailed('WebGPU render loop failed.', error);
          return;
        }

        animationRef.current = requestAnimationFrame(loop);
      };

      loop();
    };

    if (rendererMode === 'webgl2') {
      initWebGL2();
    } else {
      initWebGPU();
    }

    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (ro) ro.disconnect();
      if (glVertexArray) {
        glContext?.deleteVertexArray(glVertexArray);
      }
      if (glProgram) {
        glContext?.deleteProgram(glProgram);
      }
      if (overlayVertexArray) {
        overlayGl?.deleteVertexArray(overlayVertexArray);
      }
      if (overlayProgram) {
        overlayGl?.deleteProgram(overlayProgram);
      }
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch { /* ignore */ }
        deviceRef.current = null;
      }
    };
  }, [shaderPath, vertexEntry, fragmentEntry, rendererMode, overlayEnabled]);

  return (
    <div ref={containerRef} className={`absolute inset-0 w-full h-full ${className}`}>
      <canvas
        key={rendererMode}
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        data-renderer={rendererMode}
        style={{ display: 'block' }}
      />
      {overlayEnabled && (
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          data-layer="webgl2-overlay"
          style={{ display: 'block', mixBlendMode: 'screen' }}
        />
      )}
    </div>
  );
};

export default WebGPUShader;
