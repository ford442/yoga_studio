'use client';

import React, { useEffect, useRef } from 'react';

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
  className?: string;
  shaderPath?: string;
  vertexEntry?: string;
  fragmentEntry?: string;
}

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
  strengthLevel = 1.0, // 0=light, 1=regular, 2=strong
  className = '',
  shaderPath = 'sacred-lotus-final.wgsl',
  vertexEntry = 'vs',
  fragmentEntry = 'main',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const pipelineRef = useRef<GPURenderPipeline | null>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const bindGroupRef = useRef<GPUBindGroup | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Mutable refs for animated values so WebGPU only initializes once
  const propsRef = useRef({ breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel });
  useEffect(() => { propsRef.current = { breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel }; }, [breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (!startTimeRef.current) startTimeRef.current = Date.now();

      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        console.error('WebGPU not supported');
        return;
      }

      const device = await adapter.requestDevice();
      if (cancelled) { device.destroy(); return; }
      deviceRef.current = device;

      const context = canvas.getContext('webgpu')!;
      const format = navigator.gpu.getPreferredCanvasFormat();

      const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(canvas.clientWidth * dpr);
        canvas.height = Math.floor(canvas.clientHeight * dpr);
      };
      resize();

      context.configure({ device, format, alphaMode: 'premultiplied' });

      const shaderCode = await fetch(shaderPath).then(r => r.text());
      const shaderModule = device.createShaderModule({ code: shaderCode });

      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module: shaderModule, entryPoint: vertexEntry },
        fragment: { module: shaderModule, entryPoint: fragmentEntry, targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
      pipelineRef.current = pipeline;

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
      //   [11] padding        @byte 44   // 16-byte alignment padding
      //   [12] resolution.x   @byte 48  (vec2<f32>, align 8)
      //   [13] resolution.y   @byte 52
      //   [14] padding        @byte 56
      //   [15] padding        @byte 60
      //   Total struct size: 64 bytes (WebGPU uniform buffer alignment)
      const uniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      uniformBufferRef.current = uniformBuffer;

      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });
      bindGroupRef.current = bindGroup;

      const loop = () => {
        if (!device || !pipeline || !uniformBuffer || !context || !bindGroup) return;

        const { breathPhase: bp, intensity: int, chakraPhase: cp, phaseProgress: pp, theme: th, mandalaStyle: ms, mouse: m, mouseStrength: msr, timeScale: ts, strengthLevel: sl } = propsRef.current;
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
          sl,            //  [7] strengthLevel  (0=light, 1=regular, 2=strong)
          m.x,           //  [8] mouse.x
          m.y,           //  [9] mouse.y
          msr,           // [10] mouseStrength
          0,             // [11] padding (16-byte alignment)
          w,             // [12] resolution.x
          h,             // [13] resolution.y
          0,             // [14] padding
          0,             // [15] padding
        ]);
        device.queue.writeBuffer(uniformBuffer, 0, uniforms);

        const encoder = device.createCommandEncoder();
        const view = context.getCurrentTexture().createView();

        const pass = encoder.beginRenderPass({
          colorAttachments: [{ view, clearValue: [0,0,0,1], loadOp: 'clear', storeOp: 'store' }],
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(6);
        pass.end();

        device.queue.submit([encoder.finish()]);
        animationRef.current = requestAnimationFrame(loop);
      };

      loop();

      const onResize = () => { resize(); };
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    };

    init();

    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      deviceRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
};

export default WebGPUShader;

