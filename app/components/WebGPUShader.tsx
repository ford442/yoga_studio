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

      if (!navigator.gpu) {
        setSupported(false);
        setError('WebGPU is not supported. Please use Chrome/Edge.');
        return;
      }

      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('No GPU adapter found');

        device = await adapter.requestDevice();
        const context = canvasRef.current.getContext('webgpu');
        if (!context) throw new Error('No WebGPU context');

        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        context.configure({
          device,
          format: presentationFormat,
          alphaMode: 'premultiplied',
        });

        const shaderCode = `
          struct Uniforms {
            resolution: vec2<f32>,
            time: f32,
            padding: f32,
          };

          @group(0) @binding(0) var<uniform> uniforms: Uniforms;

          struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>,
          };

          @vertex
          fn vertex_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
            var output: VertexOutput;
            var pos = array<vec2<f32>, 4>(
              vec2<f32>(-1.0, -1.0),
              vec2<f32>( 1.0, -1.0),
              vec2<f32>(-1.0,  1.0),
              vec2<f32>( 1.0,  1.0)
            );
            output.position = vec4<f32>(pos[vertex_index], 0.0, 1.0);
            output.uv = pos[vertex_index] * 0.5 + 0.5;
            return output;
          }

          const PI: f32 = 3.141592;

          fn mod_vec3(x: vec3<f32>, y: vec3<f32>) -> vec3<f32> {
            return x - y * floor(x / y);
          }

          fn rot2(a: f32) -> mat2x2<f32> {
            let c = cos(a);
            let s = sin(a);
            return mat2x2<f32>(c, s, -s, c);
          }

          fn hue(v: f32) -> vec3<f32> {
            return 0.6 + 0.6 * cos(6.3 * v + vec3<f32>(0.0, 23.0, 21.0));
          }

          fn kalei(p_in: vec3<f32>, tt: f32) -> vec3<f32> {
            var p = p_in;
            p.x = abs(p.x) - 2.5;
            var q = p;
            q.y -= 0.5;
            q.y += 0.4 * sin(tt);
            p.y += 0.3 * sin(p.z * 3.0 + 0.5 * tt);

            let at = length(q) - 0.01;

            for(var i: f32 = 0.0; i < 6.0; i = i + 1.0) {
              p.x = abs(p.x) - 1.5;

              let angle1 = 1.0 - exp(-p.z * 0.14 * i) + 0.2 * tt + 0.1 * at;
              let r1 = rot2(angle1);
              var xz = vec2<f32>(p.x, p.z) * r1;
              p.x = xz.x;
              p.z = xz.y;

              let angle2 = sin(2.0 * i) + 0.2 * tt;
              let r2 = rot2(angle2);
              var xy = vec2<f32>(p.x, p.y) * r2;
              p.x = xy.x;
              p.y = xy.y;

              p.y += 1.0 - exp(-p.z * 0.1 * i);
            }
            p.x = abs(p.x) + 2.5;
            return p;
          }

          struct MapResult {
            dist: f32,
            mat: f32,
          };

          fn map(p_in: vec3<f32>, tt: f32) -> MapResult {
             var p = p_in;
             let bp = p;

             let r_yz = rot2(-PI * 0.25);
             var yz = vec2<f32>(p.y, p.z) * r_yz;
             p.y = yz.x;
             p.z = yz.y;

             p = kalei(p, tt);

             let r = length(p);
             p = vec3<f32>(log(r), acos(p.z / r), atan2(p.y, p.x));

             let shrink = 1.0/abs(p.y - PI) + 1.0/abs(p.y) - 1.0/PI;
             let scale = floor(90.0)/PI;
             p = p * scale;

             p.x -= tt;
             p.y -= 0.7;

             let size_vec = vec3<f32>(6.5, 0.5, 0.5);
             let id = floor((p + size_vec * 0.5) / size_vec);
             p = mod_vec3(p + size_vec * 0.5, size_vec) - size_vec * 0.5;

             let r_yz2 = rot2(0.25 * PI);
             yz = vec2<f32>(p.y, p.z) * r_yz2;
             p.y = yz.x;
             p.z = yz.y;

             p.x *= shrink;

             let mat_val = bp.y * 0.6 + id.x + abs(bp.x * 0.2);

             let w = 0.0001;
             var d = length(vec2<f32>(p.x, p.z)) - w;
             d = min(d, length(vec2<f32>(p.x, p.y)) - w);
             d *= r / (scale * shrink);

             return MapResult(d * 0.5, mat_val);
          }

          @fragment
          fn fragment_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            // FIX: Flip Y coordinate to match ShaderToy (0,0 at bottom-left)
            let correctedY = uniforms.resolution.y - fragCoord.y;

            // Normalize UVs based on corrected Y
            let uv = (vec2<f32>(fragCoord.x, correctedY) - 0.5 * uniforms.resolution) / uniforms.resolution.y;

            let tt = uniforms.time * 0.3;

            // Camera Setup
            let rd = normalize(vec3<f32>(uv.x, uv.y, 0.7));
            var p = vec3<f32>(0.0, 0.0, -4.0);

            var col = vec3<f32>(0.0);
            var t: f32 = 0.0;

            // Raymarching Loop
            for(var i: i32 = 0; i < 80; i++) {
              let res = map(p, tt);
              let d = res.dist;
              let mat = res.mat;

              if (t > 7.0) { break; }
              t += max(0.01, abs(d));
              p += rd * d;

              if (d < 0.006) {
                 let al = hue(mat * 0.4) * 0.9;
                 col += al / exp(t * 0.6);
              }
            }

            // Background
            let bg = vec3<f32>(0.016, 0.086, 0.125);
            if (dot(col, col) < 0.001) {
               col += bg * mix(0.3, 1.1, (1.0 - pow(dot(uv, uv), 0.5)));
            }

            col = pow(col, vec3<f32>(0.6));
            return vec4<f32>(col, 1.0);
          }
        `;

        const shaderModule = device.createShaderModule({ code: shaderCode });

        const uniformBufferSize = 16;
        const uniformBuffer = device.createBuffer({
          size: uniformBufferSize,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroupLayout = device.createBindGroupLayout({
          entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, buffer: { type: 'uniform' }}],
        });

        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: uniformBuffer }}],
        });

        const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

        const pipeline = device.createRenderPipeline({
          layout: pipelineLayout,
          vertex: { module: shaderModule, entryPoint: 'vertex_main' },
          fragment: {
            module: shaderModule,
            entryPoint: 'fragment_main',
            targets: [{ format: presentationFormat }],
          },
          primitive: { topology: 'triangle-strip' },
        });

        const render = () => {
          if (!device || !canvasRef.current) return;

          const time = (Date.now() % 1000000) / 1000;
          const width = canvasRef.current.width;
          const height = canvasRef.current.height;

          device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([width, height, time, 0]));

          const commandEncoder = device.createCommandEncoder();
          const textureView = context.getCurrentTexture().createView();

          const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
              view: textureView,
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store',
            }],
          });

          renderPass.setPipeline(pipeline);
          renderPass.setBindGroup(0, bindGroup);
          renderPass.draw(4);
          renderPass.end();

          device.queue.submit([commandEncoder.finish()]);
          animationId = requestAnimationFrame(render);
        };

        render();
      } catch (err) {
        setError(`Error: ${err}`);
        console.error(err);
      }
    };

    init();

    return () => {
      cancelAnimationFrame(animationId);
      device?.destroy();
    };
  }, []);

  if (!supported || error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white p-8">
        <p>{error || 'WebGPU not supported'}</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={800}
      className="w-full h-full object-contain bg-black"
    />
  );
}
