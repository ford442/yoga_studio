'use client';

import { useEffect, useRef, useState } from 'react';

interface BreathState {
  phase: string;
  progress: number;
  isRunning: boolean;
  activeChakra: string;
}

interface WebGPUShaderProps {
  breathState?: BreathState;
  width?: number;
  height?: number;
}

// Map phase strings to shader values
const PHASE_VALUES: Record<string, number> = {
  'inhale': 0.0,
  'hold': 1.0,
  'hold-in': 1.0,
  'hold1': 1.0,
  'exhale': 2.0,
  'hold-empty': 3.0,
  'hold-out': 3.0,
  'hold2': 3.0,
};

const CHAKRA_VALUES: Record<string, number> = {
  'Muladhara': 0.0, 'Svadhisthana': 1.0, 'Manipura': 2.0,
  'Anahata': 3.0, 'Vishuddha': 4.0, 'Ajna': 5.0, 'Sahasrara': 6.0,
};

export default function WebGPUShader({
  breathState,
  width = 800,
  height = 600,
}: WebGPUShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let animationId: number;
    let device: GPUDevice | null = null;
    let uniformBuffer: GPUBuffer | null = null;
    let pipeline: GPURenderPipeline | null = null;
    let context: GPUCanvasContext | null = null;

    const initWebGPU = async () => {
      if (!canvasRef.current || !navigator.gpu) {
        setError('WebGPU not supported in this browser');
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
        device = await adapter!.requestDevice();

        context = canvasRef.current.getContext('webgpu')!;
        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format, alphaMode: 'premultiplied' });

        const shaderCode = `
struct Uniforms {
  resolution: vec2f,
  time: f32,
  breathProgress: f32,
  breathPhase: f32,
  activeChakra: f32,
  isRunning: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4f {
  let pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(1.0, -1.0), vec2f(1.0, 1.0), vec2f(-1.0, 1.0)
  );
  return vec4f(pos[vid], 0.0, 1.0);
}

const TAU = 6.28318530718;

fn hash11(p: f32) -> f32 {
  var x = p * 0.011; x = fract(x) * 314.159; return fract(x * x * (x + 1.0));
}

fn sdCircle(p: vec2f, r: f32) -> f32 { return length(p) - r; }

// Breathing Lotus (8 petals that bloom beautifully)
fn lotusPetals(uv: vec2f, t: f32, phase: f32, prog: f32) -> f32 {
  let petalCount = 8.0;
  let angle = atan2(uv.y, uv.x);
  let dist = length(uv);
  var breathe = 0.85;
  if (phase < 0.5) { breathe = 0.75 + 0.75 * prog; }           // inhale → bloom
  else if (phase < 1.5) { breathe = 1.5; }                      // hold → full open
  else if (phase < 2.5) { breathe = 1.5 - 0.75 * prog; }        // exhale → close
  let petal = sin(angle * petalCount + t * 0.7) * 0.13 + 0.36 * breathe;
  return dist - petal;
}

// Rotating Mandala Layers
fn mandala(uv: vec2f, radius: f32, spokes: f32, speed: f32, t: f32) -> f32 {
  var p = uv;
  let angle = atan2(p.y, p.x) + t * speed;
  let sector = floor(angle * spokes / TAU);
  let sectorAngle = (sector + 0.5) * TAU / spokes;
  let rot = mat2x2(cos(sectorAngle), sin(sectorAngle), -sin(sectorAngle), cos(sectorAngle));
  p = rot * p;
  return abs(length(p) - radius) - 0.018;
}

// Flowing Prana Particles (42 glowing orbs)
fn pranaFlow(uv: vec2f, t: f32, phase: f32, prog: f32) -> vec3f {
  var col = vec3f(0.0);
  let outward = phase < 1.5; // inhale & hold-in = outward flow
  for (var i = 0.0; i < 42.0; i += 1.0) {
    let seed = i * 13.37;
    let a = i * TAU / 42.0 + t * 0.35 + hash11(seed) * 1.2;
    let r = 0.12 + fract(seed + t * 0.45) * 0.78;
    let flow = outward ? prog : (1.0 - prog);
    let pos = vec2f(cos(a), sin(a)) * (r + flow * 0.15 * (outward ? 1.0 : -1.0));
    let d = length(uv - pos);
    let intensity = exp(-d * 38.0);
    let hue = fract(i * 0.11 + t * 0.2);
    var pcol = 0.7 + 0.3 * cos(vec3f(0.0, 2.0, 4.0) + hue * 6.0);
    col += intensity * pcol * 1.6;
  }
  return col;
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4f) -> @location(0) vec4f {
  let uv = (fragCoord.xy - 0.5 * u.resolution) / min(u.resolution.x, u.resolution.y);
  let t = u.time * 1.15;
  let phase = u.breathPhase;
  let prog = u.breathProgress;
  let chakra = u.activeChakra;

  var color = vec3f(0.015, 0.005, 0.045); // deep cosmic void

  // Outer mandala
  let outer = mandala(uv, 0.95, 28.0, 0.12, t);
  color = mix(color, vec3f(0.35, 0.25, 0.75), smoothstep(0.04, 0.0, outer) * 0.6);

  // Mid mandala
  let mid = mandala(uv * 1.45, 0.58, 18.0, -0.31, t);
  color = mix(color, vec3f(0.15, 0.65, 0.85), smoothstep(0.03, 0.0, mid) * 0.8);

  // Prana particles (flowing life-force)
  color += pranaFlow(uv, t, phase, prog);

  // Sacred Lotus
  let lotusD = lotusPetals(uv * 1.08, t * 0.65, phase, prog);
  let lotusGlow = 1.0 - smoothstep(0.0, 0.13, lotusD);
  let lotusEdge = exp(-abs(lotusD) * 22.0);

  var lotusColor = vec3f(0.95, 0.45, 1.0);
  if (chakra < 1.5) { lotusColor = vec3f(1.0, 0.25, 0.15); }
  else if (chakra < 3.5) { lotusColor = vec3f(1.0, 0.85, 0.1); }
  else if (chakra < 4.5) { lotusColor = vec3f(0.1, 1.0, 0.55); }

  color = mix(color, lotusColor, lotusGlow * 2.2);
  color += lotusEdge * lotusColor * 3.0;

  // Core orb (extra bright on holds)
  let core = exp(-length(uv) * (14.0 - 8.0 * sin(t * 5.0))) * (phase == 1.0 || phase == 3.0 ? 1.0 : 0.4);
  color += core * vec3f(1.0, 0.98, 0.75);

  // Soft vignette
  color *= 1.0 - length(uv) * 0.4;

  let alpha = 0.9 + 0.1 * lotusGlow;
  return vec4f(pow(color, vec3f(0.85)), alpha);
}
        `;

        const shaderModule = device.createShaderModule({ code: shaderCode });

        pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: shaderModule, entryPoint: 'vs_main' },
          fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
          primitive: { topology: 'triangle-list' },
        });

        uniformBuffer = device.createBuffer({
          size: 8 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const render = () => {
          if (!device || !pipeline || !context || !uniformBuffer) {
            animationId = requestAnimationFrame(render);
            return;
          }

          const phaseVal = breathState ? (PHASE_VALUES[breathState.phase] ?? 0.0) : 0.0;
          const chakraVal = breathState ? (CHAKRA_VALUES[breathState.activeChakra] ?? 3.0) : 3.0;

          const uniforms = new Float32Array([
            width, height,
            Date.now() / 1000,
            breathState?.progress ?? 0.5,
            phaseVal,
            chakraVal,
            breathState?.isRunning ? 1.0 : 0.0,
          ]);

          device.queue.writeBuffer(uniformBuffer, 0, uniforms);

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view: context.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: [0.0, 0.0, 0.02, 1.0],
              storeOp: 'store',
            }]
          });

          pass.setPipeline(pipeline);
          pass.setBindGroup(0, device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: uniformBuffer } }]
          }));
          pass.draw(6);
          pass.end();

          device.queue.submit([encoder.finish()]);
          animationId = requestAnimationFrame(render);
        };

        render();
      } catch (e) {
        setError('WebGPU init failed: ' + (e as Error).message);
      }
    };

    initWebGPU();

    return () => cancelAnimationFrame(animationId);
  }, [breathState, width, height]);

  if (error) return <div className="text-red-400 p-8 text-center">{error}</div>;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full rounded-xl"
    />
  );
}
