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
  chakraFocus?: number; // -1=none, 0..6=root..crown
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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Mutable refs for animated values so WebGPU only initializes once
  const propsRef = useRef({ breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel, chakraFocus });
  useEffect(() => {
    propsRef.current = { breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel, chakraFocus };
  }, [breathPhase, intensity, chakraPhase, phaseProgress, theme, mandalaStyle, mouse, mouseStrength, timeScale, strengthLevel, chakraFocus]);

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
      // Robust resize + reconfigure. We measure after layout and reconfigure the
      // swapchain whenever the canvas backing store size changes. This is essential
      // for reliable startup (async init + large shader fetch can race layout) and
      // for window resizes / DPR changes / container resizes.
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
      // Create the pipeline layout and module
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

      } catch (err) {
        console.error('[WebGPUShader] WebGPU pipeline setup failed:', err);
        // Leave canvas black; the rest of the UI still works.
        return;
      }

      // Force a final size measurement + reconfigure now that the (potentially
      // slow) shader fetch + pipeline creation is complete. This guarantees the
      // canvas has its real layout size even if the early measurement was 0.
      resize();

      const loop = () => {
        if (cancelled || !device || !pipeline || !uniformBuffer || !context || !bindGroup) return;

        // Skip render if canvas is 0px (not yet visible)
        if (canvas.width === 0 || canvas.height === 0) {
          animationRef.current = requestAnimationFrame(loop);
          return;
        }

        const { breathPhase: bp, intensity: int, chakraPhase: cp, phaseProgress: pp, theme: th, mandalaStyle: ms, mouse: m, mouseStrength: msr, timeScale: ts, strengthLevel: sl, chakraFocus: cf } = propsRef.current;
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
