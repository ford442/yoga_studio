'use client';

import { useEffect, useRef, useState } from 'react';

export default function WebGPUShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);

  useEffect(() => {
    let animationId: number;
    let device: GPUDevice | null = null;

    const init = async () => {
      if (!canvasRef.current) return;

      // Check WebGPU support
      if (!navigator.gpu) {
        setSupported(false);
        setError('WebGPU is not supported in this browser. Please use Chrome or Edge with WebGPU enabled.');
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setError('Failed to get GPU adapter');
          return;
        }

        device = await adapter.requestDevice();
        const canvas = canvasRef.current;
        const context = canvas.getContext('webgpu');

        if (!context) {
          setError('Failed to get WebGPU context');
          return;
        }

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format: presentationFormat,
        });

        // WGSL Shader Code - Breathing Visualization
        const shaderCode = `
          struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>,
          }

          @vertex
          fn vertex_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
            var output: VertexOutput;
            let x = f32((vertex_index & 1u) * 2u) - 1.0;
            let y = f32((vertex_index & 2u)) - 1.0;
            output.position = vec4<f32>(x, y, 0.0, 1.0);
            output.uv = vec2<f32>((x + 1.0) * 0.5, 1.0 - (y + 1.0) * 0.5);
            return output;
          }

          @group(0) @binding(0) var<uniform> time: f32;

          @fragment
          fn fragment_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let uv = input.uv * 2.0 - 1.0;
            let aspect = 1.0;
            let coord = vec2<f32>(uv.x * aspect, uv.y);
            
            // Create breathing effect with radial gradient
            let dist = length(coord);
            let breathPhase = sin(time * 0.5) * 0.5 + 0.5; // Breathing cycle (0-1)
            let radius = 0.3 + breathPhase * 0.3;
            
            // Smooth circle with breathing
            let circle = smoothstep(radius + 0.1, radius, dist);
            
            // Color gradient based on breathing phase
            let hue = time * 0.1;
            let color1 = vec3<f32>(
              0.5 + 0.5 * sin(hue),
              0.5 + 0.5 * sin(hue + 2.094),
              0.5 + 0.5 * sin(hue + 4.189)
            );
            
            let color2 = vec3<f32>(
              0.3 + 0.3 * sin(hue + 1.0),
              0.3 + 0.3 * sin(hue + 3.094),
              0.3 + 0.3 * sin(hue + 5.189)
            );
            
            // Mix colors based on distance and breathing
            let finalColor = mix(color1, color2, dist * breathPhase);
            
            // Add glow effect
            let glow = exp(-dist * 2.0) * breathPhase * 0.5;
            
            return vec4<f32>(finalColor * circle + glow, circle);
          }
        `;

        const shaderModule = device.createShaderModule({
          code: shaderCode,
        });

        // Create uniform buffer for time
        const uniformBuffer = device.createBuffer({
          size: 4, // One f32
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroupLayout = device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' },
            },
          ],
        });

        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: { buffer: uniformBuffer },
            },
          ],
        });

        const pipelineLayout = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout],
        });

        const pipeline = device.createRenderPipeline({
          layout: pipelineLayout,
          vertex: {
            module: shaderModule,
            entryPoint: 'vertex_main',
          },
          fragment: {
            module: shaderModule,
            entryPoint: 'fragment_main',
            targets: [
              {
                format: presentationFormat,
                blend: {
                  color: {
                    srcFactor: 'src-alpha',
                    dstFactor: 'one-minus-src-alpha',
                  },
                  alpha: {
                    srcFactor: 'one',
                    dstFactor: 'one-minus-src-alpha',
                  },
                },
              },
            ],
          },
          primitive: {
            topology: 'triangle-strip',
          },
        });

        // Render loop
        const startTime = Date.now();
        const render = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          
          // Update time uniform
          device!.queue.writeBuffer(
            uniformBuffer,
            0,
            new Float32Array([elapsed])
          );

          const commandEncoder = device!.createCommandEncoder();
          const textureView = context.getCurrentTexture().createView();

          const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
              {
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.15, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
              },
            ],
          });

          renderPass.setPipeline(pipeline);
          renderPass.setBindGroup(0, bindGroup);
          renderPass.draw(4);
          renderPass.end();

          device!.queue.submit([commandEncoder.finish()]);
          animationId = requestAnimationFrame(render);
        };

        render();
      } catch (err) {
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
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="rounded-lg shadow-2xl border-4 border-purple-500"
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
}
