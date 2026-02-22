'use client';

import { useEffect, useRef } from 'react';

// WGSL Shader code - pulsing circle breathing diagram
const WGSL_SHADER = `
struct Uniforms {
  time: f32,
  globalProgress: f32,
  phaseProgress: f32,
  phase: f32, // 0 inhale, 1 hold1, 2 exhale, 3 hold2
}

@group(0) @binding(0) var<uniform> u: Uniforms;

@vertex
fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let pos = array<vec2f, 6>(
    vec2f(-1, -1), vec2f(1, -1), vec2f(-1, 1),
    vec2f(1, -1), vec2f(1, 1), vec2f(-1, 1)
  );
  return vec4f(pos[i], 0.0, 1.0);
}

fn sdfCircle(p: vec2f, r: f32) -> f32 { return length(p) - r; }

fn smoothstep_(edge0: f32, edge1: f32, x: f32) -> f32 {
  let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

@fragment
fn fs_main(@builtin(position) pos: vec4f) -> @location(0) vec4f {
  let uv = (pos.xy / vec2f(800.0, 800.0) - 0.5) * 2.0;
  
  // Breathing radius (expand on inhale, contract on exhale)
  var radius = 0.35;
  if (u.phase == 0.0) { 
    radius += 0.25 * u.phaseProgress;
  } else if (u.phase == 2.0) { 
    radius -= 0.25 * u.phaseProgress;
  } else { 
    radius += 0.05 * sin(u.time * 8.0);
  }
  
  let circle = sdfCircle(uv, radius);
  
  // Color by phase
  var color = vec3f(0.2, 0.6, 1.0);
  if (u.phase == 0.0) { 
    color = mix(vec3f(0.2, 0.6, 1.0), vec3f(0.0, 1.0, 0.8), u.phaseProgress);
  } else if (u.phase == 1.0) {
    color = mix(vec3f(0.0, 1.0, 0.8), vec3f(1.0, 0.9, 0.2), u.phaseProgress);
  } else if (u.phase == 2.0) { 
    color = mix(vec3f(1.0, 0.4, 0.2), vec3f(0.8, 0.2, 0.1), u.phaseProgress);
  } else {
    color = mix(vec3f(0.8, 0.2, 0.1), vec3f(0.2, 0.8, 0.5), u.phaseProgress);
  }
  
  // Glow + extra diagram rings
  let glow = 1.0 - smoothstep_(0.0, 0.15, abs(circle));
  let ring1 = 1.0 - smoothstep_(0.0, 0.03, abs(sdfCircle(uv, radius * 1.4 + sin(u.time * 3.0) * 0.02)));
  let ring2 = 1.0 - smoothstep_(0.0, 0.02, abs(sdfCircle(uv, radius * 0.7 + cos(u.time * 2.0) * 0.01)));
  
  // Pulsing center glow
  let centerPulse = 0.3 + 0.2 * sin(u.time * 4.0);
  let centerGlow = smoothstep_(0.0, radius * 0.5, -length(uv)) * centerPulse;
  
  let finalColor = color * (glow * 1.8 + ring1 * 0.6 + ring2 * 0.3 + centerGlow);
  let alpha = smoothstep_(0.0, 0.1, -circle) + 0.3;
  
  // Add background gradient
  let bgGradient = vec3f(0.05, 0.02, 0.1) * (1.0 - length(uv) * 0.5);
  let finalWithBg = bgGradient + finalColor;
  
  return vec4f(finalWithBg, 1.0);
}
`;

interface BreathingVisualizerProps {
  globalProgress: number;
  phaseProgress: number;
  currentPhase: string;
}

export default function BreathingVisualizer({ 
  globalProgress, 
  phaseProgress, 
  currentPhase 
}: BreathingVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const pipelineRef = useRef<GPURenderPipeline | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const uniformsRef = useRef({ globalProgress, phaseProgress, currentPhase });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const initWebGPU = async () => {
      if (!navigator.gpu) {
        console.warn("WebGPU not supported");
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('No GPU adapter found');
        
        const device = await adapter.requestDevice();
        deviceRef.current = device;

        const context = canvas.getContext('webgpu');
        if (!context) throw new Error('No WebGPU context');
        contextRef.current = context;

        const format = navigator.gpu.getPreferredCanvasFormat();
        context.configure({ device, format });

        const shaderModule = device.createShaderModule({ code: WGSL_SHADER });

        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: { module: shaderModule, entryPoint: 'vs_main' },
          fragment: { module: shaderModule, entryPoint: 'fs_main', targets: [{ format }] },
          primitive: { topology: 'triangle-list' },
        });
        pipelineRef.current = pipeline;

        // Uniform buffer: time, globalProgress, phaseProgress, phase
        const uniformBuffer = device.createBuffer({
          size: 4 * 4, // 4 floats
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        uniformBufferRef.current = uniformBuffer;

        const render = () => {
          if (!device || !pipelineRef.current || !contextRef.current || !uniformBufferRef.current) return;

          const now = Date.now() / 1000;
          const { globalProgress: gp, phaseProgress: pp, currentPhase: cp } = uniformsRef.current;
          const phaseIndex = ['inhale', 'hold1', 'exhale', 'hold2'].indexOf(cp);

          const uniforms = new Float32Array([now, gp, pp, phaseIndex]);
          device.queue.writeBuffer(uniformBufferRef.current, 0, uniforms);

          const encoder = device.createCommandEncoder();
          const pass = encoder.beginRenderPass({
            colorAttachments: [{
              view: contextRef.current.getCurrentTexture().createView(),
              loadOp: 'clear',
              clearValue: [0, 0, 0, 1],
              storeOp: 'store',
            }],
          });
          pass.setPipeline(pipelineRef.current);
          pass.setBindGroup(0, device.createBindGroup({
            layout: pipelineRef.current.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: { buffer: uniformBufferRef.current } }],
          }));
          pass.draw(6);
          pass.end();

          device.queue.submit([encoder.finish()]);
          animationRef.current = requestAnimationFrame(render);
        };

        render();
      } catch (err) {
        console.error('WebGPU initialization error:', err);
      }
    };

    initWebGPU();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      deviceRef.current?.destroy();
    };
  }, []);

  // Keep uniforms ref in sync with props
  useEffect(() => {
    uniformsRef.current = { globalProgress, phaseProgress, currentPhase };
  }, [globalProgress, phaseProgress, currentPhase]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full rounded-3xl" 
      width={800} 
      height={800} 
    />
  );
}
