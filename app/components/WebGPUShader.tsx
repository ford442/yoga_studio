'use client';

import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback, useState } from 'react';

interface WebGPUShaderProps {
  strengthLevel: number;
}

export interface WebGPUShaderRef {
  updateUniforms: (data: {
    time: number;
    phase: number;
    phaseProgress: number;
    cycle: number;
    strengthLevel: number;
    intensity: number;
  }) => void;
}

// Uniform buffer layout (40 bytes = 10 × f32):
//   [0] time  [1] phase  [2] phaseProgress  [3] cycle
//   [4] strengthLevel  [5] intensity
//   [6] sin_time  [7] cos_time  [8] sin_fast  [9] cos_fast
const UNIFORM_FLOATS = 10;

const WebGPUShader = forwardRef<WebGPUShaderRef, WebGPUShaderProps>(({ strengthLevel }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const pipelineRef = useRef<GPURenderPipeline | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const bindGroupRef = useRef<GPUBindGroup | null>(null);
  const resolutionBufferRef = useRef<GPUBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load shader from file
  const loadShader = async (): Promise<string> => {
    try {
      const response = await fetch('./yoga-breath.wgsl');
      if (!response.ok) throw new Error('Failed to load shader');
      return await response.text();
    } catch (e) {
      console.warn('Could not load yoga-breath.wgsl, using fallback');
      return fallbackShader;
    }
  };

  // Initialize WebGPU
  const initWebGPU = useCallback(async () => {
    if (!canvasRef.current) return;

    if (!navigator.gpu) {
      setError('WebGPU not supported. Please use Chrome 113+ or Edge 113+');
      return;
    }

    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        setError('No WebGPU adapter found');
        return;
      }

      const device = await adapter.requestDevice();
      deviceRef.current = device;

      const context = canvasRef.current.getContext('webgpu');
      if (!context) {
        setError('Failed to get WebGPU context');
        return;
      }
      contextRef.current = context;

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format,
        alphaMode: 'premultiplied',
      });

      // Load and compile shader
      const shaderCode = await loadShader();
      const shaderModule = device.createShaderModule({
        code: shaderCode,
        label: 'yoga-fixed'
      });

      // Check for compilation errors
      const compilationInfo = await shaderModule.getCompilationInfo();
      if (compilationInfo.messages.length > 0) {
        for (const msg of compilationInfo.messages) {
          if (msg.type === 'error') {
            console.error('Shader compilation error:', msg.message, 'at line', msg.lineNum);
          }
        }
      }

      // Create pipeline
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main'
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{ format }]
        },
        primitive: {
          topology: 'triangle-list',
        },
      });
      pipelineRef.current = pipeline;

      // Create uniform buffer (10 floats = 40 bytes)
      const uniformBuffer = device.createBuffer({
        size: UNIFORM_FLOATS * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      uniformBufferRef.current = uniformBuffer;

      // Create resolution buffer (vec4<f32> = 16 bytes)
      const resolutionBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      resolutionBufferRef.current = resolutionBuffer;

      // Create bind group (binding 0 = uniforms, binding 1 = resolution)
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: resolutionBuffer } },
        ],
      });
      bindGroupRef.current = bindGroup;

      // Set initial resolution
      const rect = canvasRef.current.getBoundingClientRect();
      device.queue.writeBuffer(resolutionBuffer, 0, new Float32Array([rect.width, rect.height, 1.0, 0.0]));

    } catch (e) {
      console.error('WebGPU initialization failed:', e);
      setError('WebGPU initialization failed: ' + (e as Error).message);
    }
  }, []);

  // Update uniforms — writes 10 floats including precomputed trig
  const updateUniforms = useCallback((data: {
    time: number;
    phase: number;
    phaseProgress: number;
    cycle: number;
    strengthLevel: number;
    intensity: number;
  }) => {
    if (!uniformBufferRef.current || !deviceRef.current) return;
    const t = data.time;
    const array = new Float32Array([
      t,
      data.phase,
      data.phaseProgress,
      data.cycle,
      data.strengthLevel,
      data.intensity,
      Math.sin(t),
      Math.cos(t),
      Math.sin(t * 4.0),
      Math.cos(t * 4.0),
    ]);
    deviceRef.current.queue.writeBuffer(uniformBufferRef.current, 0, array);
  }, []);

  useImperativeHandle(ref, () => ({ updateUniforms }), [updateUniforms]);

  // Render loop
  const render = useCallback(() => {
    const device = deviceRef.current;
    const context = contextRef.current;
    const pipeline = pipelineRef.current;
    const bindGroup = bindGroupRef.current;

    if (!device || !context || !pipeline || !bindGroup) {
      animationRef.current = requestAnimationFrame(render);
      return;
    }

    try {
      const encoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();

      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          loadOp: 'clear',
          clearValue: [0.0, 0.0, 0.02, 1.0],
          storeOp: 'store',
        }]
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6);
      pass.end();

      device.queue.submit([encoder.finish()]);
    } catch (e) {
      console.error('Render error:', e);
    }

    animationRef.current = requestAnimationFrame(render);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initWebGPU();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      uniformBufferRef.current?.destroy();
      resolutionBufferRef.current?.destroy();
      deviceRef.current?.destroy();
    };
  }, [initWebGPU]);

  // Start render loop when initialized
  useEffect(() => {
    if (pipelineRef.current) {
      animationRef.current = requestAnimationFrame(render);
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [render]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && resolutionBufferRef.current && deviceRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        canvasRef.current.width = Math.max(1, Math.floor(rect.width));
        canvasRef.current.height = Math.max(1, Math.floor(rect.height));
        deviceRef.current.queue.writeBuffer(
          resolutionBufferRef.current,
          0,
          new Float32Array([rect.width, rect.height, 1.0, 0.0])
        );
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-900 text-red-400 p-8 text-center">
        <div>
          <p className="text-lg font-semibold mb-2">WebGPU Error</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
});

WebGPUShader.displayName = 'WebGPUShader';

// Fallback inline shader
const fallbackShader = `
struct BreathUniforms {
  time:          f32,
  phase:         u32,
  phaseProgress: f32,
  cycle:         u32,
  strengthLevel: u32,
  intensity:     f32,
  sin_time:      f32,
  cos_time:      f32,
  sin_fast:      f32,
  cos_fast:      f32,
};

@group(0) @binding(0) var<uniform> u_breath: BreathUniforms;
@group(0) @binding(1) var<uniform> iResolution: vec4<f32>;

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> @builtin(position) vec4<f32> {
  let pos = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0), vec2<f32>(-1.0, 1.0)
  );
  return vec4<f32>(pos[vid], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
  let uv = (fragCoord.xy - 0.5 * iResolution.xy) / min(iResolution.x, iResolution.y);
  
  var color = vec3<f32>(0.01, 0.005, 0.04);
  
  var radius = 0.5;
  if (u_breath.phase == 0u) {
    radius = 0.3 + u_breath.phaseProgress * 0.4;
  } else if (u_breath.phase == 1u) {
    radius = 0.7;
  } else if (u_breath.phase == 2u) {
    radius = 0.7 - u_breath.phaseProgress * 0.4;
  } else {
    radius = 0.3;
  }
  
  let d = length(uv) - radius;
  let colors = array<vec3<f32>, 4>(
    vec3<f32>(0.2, 0.9, 1.0),
    vec3<f32>(1.0, 0.9, 0.2),
    vec3<f32>(1.0, 0.4, 0.2),
    vec3<f32>(0.2, 0.9, 0.6)
  );
  
  color += exp(-abs(d) * 10.0) * colors[u_breath.phase] * 0.5;
  color *= 1.0 - length(uv) * 0.3;
  
  return vec4<f32>(color, 1.0);
}
`;

export default WebGPUShader;
