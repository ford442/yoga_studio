'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WebGPUShaderProps {
  breathPhase: number;
  intensity?: number;
  chakraPhase?: number;
  phaseProgress?: number;
  theme?: number;
  mandalaStyle?: number;
  mouse?: { x: number; y: number };
  mouseStrength?: number;
  timeScale?: number;
  strengthLevel?: number; // 0.0=light, 1.0=regular, 2.0=strong
  chakraFocus?: number; // -1=none, 0..6=root..crown
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
  | 'mouse'
  | 'mouseStrength'
  | 'timeScale'
  | 'strengthLevel'
  | 'chakraFocus'
>>;

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
uniform float uPhaseProgress;
uniform float uStrengthLevel;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uChakraFocus;
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

  float angular = 0.5 + 0.5 * cos(a * petals + time * 0.35);
  float ring1 = smoothstep(0.018, 0.0, abs(r - (0.42 + breath * 0.05)));
  float ring2 = smoothstep(0.014, 0.0, abs(r - 0.68));
  float ring3 = smoothstep(0.010, 0.0, abs(r - 0.92));
  float lotus = smoothstep(0.35, 0.95, angular) * smoothstep(0.74, 0.20, abs(r - 0.58));
  float yantra = smoothstep(0.025, 0.0, abs(fract((a / TAU + 0.5) * 6.0 + r * 1.6) - 0.5));
  float flower = smoothstep(0.52, 1.0, angular) * smoothstep(0.34, 0.0, abs(r - (0.30 + 0.24 * angular)));

  float body = lotus;
  body = mix(body, yantra, step(0.5, style) * (1.0 - step(1.5, style)));
  body = mix(body, flower, step(1.5, style));
  return (ring1 + ring2 * 0.75 + ring3 * 0.55 + body * 0.45) * smoothstep(1.28, 0.14, r);
}

float monkSilhouette(vec2 p, float breath) {
  p.y += 0.05;
  float pulse = 1.0 + breath * 0.055;
  p /= pulse;

  float head = smoothstep(0.035, -0.01, circle(p - vec2(0.0, 0.30), 0.085));
  float torso = smoothstep(0.050, -0.01, lineSegment(p, vec2(0.0, 0.20), vec2(0.0, -0.13)));
  float shoulders = smoothstep(0.055, -0.01, lineSegment(p, vec2(-0.23, 0.06), vec2(0.23, 0.06)));
  float arms = smoothstep(0.050, -0.01, lineSegment(p, vec2(-0.23, 0.06), vec2(-0.44, -0.19)));
  arms += smoothstep(0.050, -0.01, lineSegment(p, vec2(0.23, 0.06), vec2(0.44, -0.19)));
  float legs = smoothstep(0.055, -0.01, lineSegment(p, vec2(-0.02, -0.12), vec2(-0.33, -0.36)));
  legs += smoothstep(0.055, -0.01, lineSegment(p, vec2(0.02, -0.12), vec2(0.33, -0.36)));
  float seat = smoothstep(0.035, -0.01, lineSegment(p, vec2(-0.38, -0.36), vec2(0.38, -0.36)));
  return clamp(head + torso + shoulders + arms + legs + seat, 0.0, 1.0);
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

const WebGPUShader: React.FC<WebGPUShaderProps> = ({
  breathPhase,
  intensity = 1.0,
  chakraPhase = 0,
  phaseProgress = 0,
  theme = 0,
  mandalaStyle = 0,
  mouse = { x: -2, y: -2 },
  mouseStrength = 0,
  timeScale = 1.0,
  strengthLevel = 1.0,
  chakraFocus = -1,
  className = '',
  shaderPath = 'sacred-lotus-final.wgsl',
  vertexEntry = 'vs',
  fragmentEntry = 'main',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const [rendererMode, setRendererMode] = useState<RendererMode>('webgpu');

  // Mutable refs for animated values so the graphics backend only initializes once.
  const propsRef = useRef<ShaderPropsRef>({
    breathPhase,
    intensity,
    chakraPhase,
    phaseProgress,
    theme,
    mandalaStyle,
    mouse,
    mouseStrength,
    timeScale,
    strengthLevel,
    chakraFocus,
  });

  useEffect(() => {
    propsRef.current = {
      breathPhase,
      intensity,
      chakraPhase,
      phaseProgress,
      theme,
      mandalaStyle,
      mouse,
      mouseStrength,
      timeScale,
      strengthLevel,
      chakraFocus,
    };
  }, [breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel, chakraFocus]);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let glContext: WebGL2RenderingContext | null = null;
    let glProgram: WebGLProgram | null = null;
    let glVertexArray: WebGLVertexArrayObject | null = null;

    const markWebGPUFailed = (message: string, error?: unknown) => {
      console.warn(`[WebGPUShader] ${message} Falling back to WebGL2.`, error);
      if (!cancelled) setRendererMode('webgl2');
    };

    const resizeCanvas = (canvas: HTMLCanvasElement, onResize?: () => void) => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);

      // Prevent GPU errors if canvas is invisible/0px during React mount.
      if (w === 0 || h === 0) return false;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        onResize?.();
      }
      return true;
    };

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
        phaseProgress: gl.getUniformLocation(glProgram, 'uPhaseProgress'),
        strengthLevel: gl.getUniformLocation(glProgram, 'uStrengthLevel'),
        mouse: gl.getUniformLocation(glProgram, 'uMouse'),
        mouseStrength: gl.getUniformLocation(glProgram, 'uMouseStrength'),
        chakraFocus: gl.getUniformLocation(glProgram, 'uChakraFocus'),
        resolution: gl.getUniformLocation(glProgram, 'uResolution'),
      };

      const resize = () => {
        resizeCanvas(canvas, () => gl.viewport(0, 0, canvas.width, canvas.height));
        gl.viewport(0, 0, canvas.width, canvas.height);
      };

      resize();
      ro = new ResizeObserver(resize);
      ro.observe(canvas);

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
          mouse: m,
          mouseStrength: msr,
          timeScale: ts,
          strengthLevel: sl,
          chakraFocus: cf,
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
        gl.uniform1f(uniforms.phaseProgress, pp);
        gl.uniform1f(uniforms.strengthLevel, sl);
        gl.uniform2f(uniforms.mouse, m.x, m.y);
        gl.uniform1f(uniforms.mouseStrength, msr);
        gl.uniform1f(uniforms.chakraFocus, cf);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);

        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

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
      };

      resize();
      ro = new ResizeObserver(resize);
      ro.observe(canvas);

      let pipeline: GPURenderPipeline | null = null;
      let uniformBuffer: GPUBuffer | null = null;
      let bindGroup: GPUBindGroup | null = null;

      try {
        // Resolve shader URL relative to the current page directory.
        // This is critical for sub-path deployments (e.g. /yoga/) behind a reverse proxy
        // that strips the prefix. A bare relative fetch('sacred-xxx.wgsl') resolves
        // incorrectly if the page URL lacks a trailing slash (pathname=/yoga vs /yoga/).
        // We derive the directory from window.location so the visible prefix is always used.
        const getShaderUrl = (path: string): string => {
          const loc = window.location;
          let dir = loc.pathname;
          if (!dir.endsWith('/')) {
            // Treat as directory (e.g. /yoga -> /yoga/)
            dir = dir.replace(/[^/]*$/, '') + '/';
          }
          return new URL(path, loc.origin + dir).href;
        };

        const shaderUrl = getShaderUrl(shaderPath);
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
        //   [14] padding        @byte 56
        //   [15] padding        @byte 60
        //   Total struct size: 64 bytes (WebGPU uniform buffer alignment)
        uniformBuffer = device.createBuffer({
          size: 64,
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
          mouse: m,
          mouseStrength: msr,
          timeScale: ts,
          strengthLevel: sl,
          chakraFocus: cf,
        } = propsRef.current;
        const start = startTimeRef.current ?? Date.now();
        const currentTime = ((Date.now() - start) / 1000) * ts;
        const w = canvas.width;
        const h = canvas.height;

        const uniforms = new Float32Array([
          currentTime, //  [0] time
          bp,          //  [1] breathPhase
          int,         //  [2] intensity
          cp,          //  [3] chakraPhase
          th,          //  [4] theme
          ms,          //  [5] mandalaStyle
          pp,          //  [6] phaseProgress
          sl,          //  [7] strengthLevel
          m.x,         //  [8] mouse.x
          m.y,         //  [9] mouse.y
          msr,         // [10] mouseStrength
          cf,          // [11] chakraFocus
          w,           // [12] resolution.x
          h,           // [13] resolution.y
          0,           // [14] padding
          0,           // [15] padding
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
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch { /* ignore */ }
        deviceRef.current = null;
      }
    };
  }, [shaderPath, vertexEntry, fragmentEntry, rendererMode]);

  return (
    <canvas
      key={rendererMode}
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      data-renderer={rendererMode}
      style={{ display: 'block' }}
    />
  );
};

export default WebGPUShader;
