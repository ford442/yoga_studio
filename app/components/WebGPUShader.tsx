'use client';

import { useEffect, useRef, useState } from 'react';

// Vertex shader for full-screen quad
const VERTEX_SHADER = `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
  var output: VertexOutput;
  // Full-screen triangle strip (2 triangles = 6 vertices)
  let x = f32(vertex_index % 2u) * 2.0 - 1.0; // 0 -> -1, 1 -> 1
  let y = f32(vertex_index / 2u) * 2.0 - 1.0; // 0,1 -> -1, 2,3 -> 1
  output.position = vec4<f32>(x, y, 0.0, 1.0);
  return output;
}
`;

export default function WebGPUShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let animationId: number;
    let device: GPUDevice | null = null;

    const init = async () => {
      if (!canvasRef.current) return;

      // Check WebGPU support
      if (!navigator.gpu) {
        setSupported(false);
        setLoading(false);
        setError('WebGPU is not supported in this browser. Please use Chrome or Edge with WebGPU enabled.');
        return;
      }

      try {
        // Load the fixed WGSL shader
        const response = await fetch('./yoga-fixed.wgsl');
        if (!response.ok) {
          throw new Error(`Failed to load shader: ${response.status} ${response.statusText}`);
        }
        const fragmentShaderCode = await response.text();

        // Combine vertex and fragment shaders
        const fullShaderCode = VERTEX_SHADER + '\n' + fragmentShaderCode;

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setError('Failed to get GPU adapter');
          setLoading(false);
          return;
        }

        device = await adapter.requestDevice();
        const canvas = canvasRef.current;
        const context = canvas.getContext('webgpu');

        if (!context) {
          setError('Failed to get WebGPU context');
          setLoading(false);
          return;
        }

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format: presentationFormat,
        });

        const shaderModule = device.createShaderModule({
          code: fullShaderCode,
        });

        // Uniform buffer layout:
        // binding(0): iTime (f32) - offset 0
        // binding(1): iResolution (vec3<f32>) - offset 16 (aligned to vec3)
        // binding(2): iFrame (f32) - offset 32 (aligned)
        const uniformBufferSize = 48;
        const uniformBuffer = device.createBuffer({
          size: uniformBufferSize,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' },
            },
            {
              binding: 1,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' },
            },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' },
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: uniformBuffer, offset: 0, size: 4 } },
            { binding: 1, resource: { buffer: uniformBuffer, offset: 16, size: 12 } },
            { binding: 2, resource: { buffer: uniformBuffer, offset: 32, size: 4 } },
          ],
        });

        const pipelineLayout = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        });

        const pipeline = device.createRenderPipeline({
          layout: pipelineLayout,
          vertex: {
            module: shaderModule,
            entryPoint: 'vs_main',
          },
          fragment: {
            module: shaderModule,
            entryPoint: 'main',
            targets: [
              {
                format: presentationFormat,
              },
            ],
          },
          primitive: {
            topology: 'triangle-list',
          },
        });

        // Render loop
        const startTime = Date.now();
        let frameCount = 0;
        
        const render = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          frameCount++;

          // Update uniforms
          device!.queue.writeBuffer(uniformBuffer, 0, new Float32Array([elapsed]));
          device!.queue.writeBuffer(
            uniformBuffer,
            16,
            new Float32Array([canvas.width, canvas.height, 1.0])
          );
          device!.queue.writeBuffer(uniformBuffer, 32, new Float32Array([frameCount]));

          const commandEncoder = device!.createCommandEncoder();
          const textureView = context.getCurrentTexture().createView();

          const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
              {
                view: textureView,
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          });

          renderPass.setPipeline(pipeline);
          renderPass.setBindGroup(0, bindGroup);
          renderPass.draw(6);  // Full-screen quad (2 triangles = 6 vertices)
          renderPass.end();

          device!.queue.submit([commandEncoder.finish()]);
          animationId = requestAnimationFrame(render);
        };

        setLoading(false);
        render();
      } catch (err) {
        setLoading(false);
        setError(`Error initializing WebGPU: ${err}`);
        console.error(err);
      }
    };

    init();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (device) {
        device.destroy();
      }
    };
  }, []);

  if (!supported) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] bg-gray-900 text-white rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4">WebGPU Not Supported</h2>
        <p className="text-center max-w-md">
          {error || 'Your browser does not support WebGPU. Please use Chrome or Edge with WebGPU enabled.'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[600px] bg-red-900 text-white rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p className="text-center max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
          <div className="text-white text-xl">Loading Yoga Studio...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="rounded-lg shadow-2xl border-4 border-purple-500"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
