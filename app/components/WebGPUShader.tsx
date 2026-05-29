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
  strengthLevel = 1.0,
  className = '',
  shaderPath = 'sacred-lotus-final.wgsl',
  vertexEntry = 'vs',
  fragmentEntry = 'main',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Mutable refs for animated values so WebGPU only initializes once
  const propsRef = useRef({ breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel });
  useEffect(() => {
    propsRef.current = { breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel };
  }, [breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel]);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const init = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (!startTimeRef.current) startTimeRef.current = Date.now();

      const adapter = await navigator.gpu?.requestAdapter();
      if (!adapter) {
        console.warn('WebGPU not supported on this browser.');
        return;
      }

      const device = await adapter.requestDevice();
      if (cancelled) {
        device.destroy();
        return;
      }
      deviceRef.current = device;

      const context = canvas.getContext('webgpu');
      if (!context) return;

      const format = navigator.gpu.getPreferredCanvasFormat();

      // Robust resize + reconfigure
      const resize = () => {
        if (!canvas || cancelled) return;
        const dpr = window.devicePixelRatio || 1;
        const w = Math.floor(canvas.clientWidth * dpr);
        const h = Math.floor(canvas.clientHeight * dpr);

        // Prevent WebGPU crash if canvas is invisible/0px during React mount
        if (w === 0 || h === 0) return;

        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          try {
            context.configure({ device, format, alphaMode: 'premultiplied' });
          } catch (e) {
            console.error('Failed to configure WebGPU context:', e);
          }
        }
      };

      // Initial measurement
      resize();

      // ResizeObserver catches real dimensions if CSS hasn't painted yet
      ro = new ResizeObserver(() => resize());
      ro.observe(canvas);

      let pipeline: GPURenderPipeline | null = null;
      let uniformBuffer: GPUBuffer | null = null;
      let bindGroup: GPUBindGroup | null = null;

      try {
        const getShaderUrl = (path: string): string => {
          const loc = window.location;
          let dir = loc.pathname;
          if (!dir.endsWith('/')) {
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

        // Uniforms struct layout (64 bytes / 16 floats):
        //   [0]  time           [1]  breathPhase   [2]  intensity     [3]  chakraPhase
        //   [4]  theme          [5]  mandalaStyle   [6]  phaseProgress [7]  strengthLevel
        //   [8]  mouse.x        [9]  mouse.y        [10] mouseStrength [11] padding
        //   [12] resolution.x   [13] resolution.y   [14] padding       [15] padding
        uniformBuffer = device.createBuffer({
          size: 64,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        });
      } catch (err) {
        console.error('[WebGPUShader] Setup failed:', err);
        return;
      }

      // Force a final size measurement in case CSS shifted during async shader load
      resize();

      const loop = () => {
        if (cancelled || !device || !pipeline || !uniformBuffer || !context || !bindGroup) return;

        // Skip render if canvas is 0px (not yet visible)
        if (canvas.width === 0 || canvas.height === 0) {
          animationRef.current = requestAnimationFrame(loop);
          return;
        }

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
          sl,            //  [7] strengthLevel
          m.x,           //  [8] mouse.x
          m.y,           //  [9] mouse.y
          msr,           // [10] mouseStrength
          0,             // [11] padding
          w,             // [12] resolution.x
          h,             // [13] resolution.y
          0,             // [14] padding
          0,             // [15] padding
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
        } catch (e) {
          console.error('Render loop error:', e);
        }

        animationRef.current = requestAnimationFrame(loop);
      };

      loop();
    };

    init();

    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (ro) ro.disconnect();
      if (deviceRef.current) {
        try { deviceRef.current.destroy(); } catch (e) { /* ignore */ }
        deviceRef.current = null;
      }
    };
  }, [shaderPath, vertexEntry, fragmentEntry]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ display: 'block' }}
    />
  );
};

export default WebGPUShader;
