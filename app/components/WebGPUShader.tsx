'use client';

import { useEffect, useRef, useState } from 'react';
import { BreathState, BreathPhase, ChakraName } from '../hooks/useBreathTimer';

interface WebGPUShaderProps {
  /** Breathing state from useBreathTimer hook */
  breathState?: BreathState;
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
}

// Phase mapping to numeric values for shader
const PHASE_VALUES: Record<BreathPhase, number> = {
  'inhale': 0.0,
  'hold-in': 1.0,
  'exhale': 2.0,
  'hold-out': 3.0,
};

// Chakra mapping to numeric values for shader (0-6)
const CHAKRA_VALUES: Record<ChakraName, number> = {
  'Muladhara': 0.0,      // Root
  'Svadhisthana': 1.0,   // Sacral
  'Manipura': 2.0,       // Solar Plexus
  'Anahata': 3.0,        // Heart
  'Vishuddha': 4.0,      // Throat
  'Ajna': 5.0,           // Third Eye
  'Sahasrara': 6.0,      // Crown
};

export default function WebGPUShader({ 
  breathState,
  width = 800,
  height = 600 
}: WebGPUShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);

  useEffect(() => {
    let animationId: number;
    let device: GPUDevice | null = null;
    let uniformBuffer: GPUBuffer | null = null;
    let render: (() => void) | null = null;

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

        // WGSL shader with breath timing uniforms
        const shaderCode = `
          struct Uniforms {
            resolution: vec2<f32>,
            time: f32,
            breathProgress: f32,      // 0.0 to 1.0 within current breath cycle
            breathPhase: f32,         // 0=inhale, 1=hold-in, 2=exhale, 3=hold-out
            cycleNumber: f32,         // Current breath cycle
            isRunning: f32,           // 1.0 if running, 0.0 if paused
            activeChakra: f32,        // 0-6 representing the 7 chakras
            secondaryChakra: f32,     // -1 if none, otherwise 0-6
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

          const PI: f32 = 3.14159265359;
          const TAU: f32 = 6.28318530718;

          // Rotation matrix
          fn rot2(a: f32) -> mat2x2<f32> {
            let c = cos(a);
            let s = sin(a);
            return mat2x2<f32>(c, s, -s, c);
          }

          // Hue color function
          fn hue(v: f32) -> vec3<f32> {
            return 0.6 + 0.6 * cos(6.3 * v + vec3<f32>(0.0, 23.0, 21.0));
          }

          // Smoothstep
          fn smoothstep_(edge0: f32, edge1: f32, x: f32) -> f32 {
            let t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
            return t * t * (3.0 - 2.0 * t);
          }

          // Kaleidoscope effect
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

          // Distance field result
          struct MapResult {
            dist: f32,
            mat: f32,
          };

          // 3D map function with breath synchronization
          fn map(p_in: vec3<f32>, tt: f32, breathP: f32, phase: f32) -> MapResult {
            var p = p_in;
            let bp = p;

            // Apply breath synchronization to the pattern
            let breathScale = 1.0 + 0.15 * sin(breathP * TAU - PI * 0.5);
            let breathOffset = 0.1 * sin(breathP * TAU);
            
            // Add phase-specific pulsing
            var phasePulse: f32 = 0.0;
            if (phase < 1.0) {
              // Inhale - expanding
              phasePulse = breathP * 4.0 * 0.1;
            } else if (phase < 2.0) {
              // Hold-in - steady glow
              phasePulse = 0.1;
            } else if (phase < 3.0) {
              // Exhale - contracting
              phasePulse = (1.0 - (breathP - 0.5) * 4.0) * 0.1;
            } else {
              // Hold-out - dim
              phasePulse = 0.0;
            }

            let r_yz = rot2(-PI * 0.25 + breathOffset * 0.5);
            var yz = vec2<f32>(p.y, p.z) * r_yz;
            p.y = yz.x;
            p.z = yz.y;

            p = kalei(p, tt);

            let r = length(p);
            p = vec3<f32>(log(r), acos(p.z / r), atan2(p.y, p.x));

            let shrink = 1.0 / abs(p.y - PI) + 1.0 / abs(p.y) - 1.0 / PI;
            let scale = floor(90.0) / PI;
            p = p * scale;

            p.x -= tt + breathOffset * 2.0;
            p.y -= 0.7;

            let size_vec = vec3<f32>(6.5, 0.5, 0.5);
            let id = floor((p + size_vec * 0.5) / size_vec);
            p = mod_vec3(p + size_vec * 0.5, size_vec) - size_vec * 0.5;

            let r_yz2 = rot2(0.25 * PI);
            yz = vec2<f32>(p.y, p.z) * r_yz2;
            p.y = yz.x;
            p.z = yz.y;

            p.x *= shrink * breathScale;

            let mat_val = bp.y * 0.6 + id.x + abs(bp.x * 0.2) + phasePulse * 5.0;

            let w = 0.0001;
            var d = length(vec2<f32>(p.x, p.z)) - w;
            d = min(d, length(vec2<f32>(p.x, p.y)) - w);
            d *= r / (scale * shrink);

            return MapResult(d * 0.5, mat_val);
          }

          // Vector mod function
          fn mod_vec3(x: vec3<f32>, y: vec3<f32>) -> vec3<f32> {
            return x - y * floor(x / y);
          }

          // Chakra colors (RGB)
          fn getChakraColor(chakraIndex: f32) -> vec3<f32> {
            // 0=Root(red), 1=Sacral(orange), 2=Solar(yellow), 3=Heart(green)
            // 4=Throat(cyan), 5=ThirdEye(indigo), 6=Crown(violet)
            if (chakraIndex < 0.5) { return vec3<f32>(0.93, 0.27, 0.27); }      // Muladhara - Red
            if (chakraIndex < 1.5) { return vec3<f32>(0.98, 0.45, 0.09); }      // Svadhisthana - Orange
            if (chakraIndex < 2.5) { return vec3<f32>(0.92, 0.72, 0.03); }      // Manipura - Yellow
            if (chakraIndex < 3.5) { return vec3<f32>(0.13, 0.77, 0.37); }      // Anahata - Green
            if (chakraIndex < 4.5) { return vec3<f32>(0.02, 0.71, 0.83); }      // Vishuddha - Cyan
            if (chakraIndex < 5.5) { return vec3<f32>(0.39, 0.40, 0.95); }      // Ajna - Indigo
            return vec3<f32>(0.66, 0.33, 0.97);                                 // Sahasrara - Violet
          }

          // Get chakra Y position (from root to crown)
          fn getChakraY(chakraIndex: f32) -> f32 {
            // Map chakra 0-6 to vertical positions
            return -0.6 + chakraIndex * 0.2;
          }

          // Chakra visualization on the body
          fn chakraGlow(uv: vec2<f32>, chakraIndex: f32, intensity: f32) -> vec3<f32> {
            if (chakraIndex < 0.0 || chakraIndex > 6.0) { return vec3<f32>(0.0); }
            
            let chakraY = getChakraY(chakraIndex);
            let chakraPos = vec2<f32>(0.0, chakraY);
            let dist = length(uv - chakraPos);
            
            let chakraCol = getChakraColor(chakraIndex);
            let glow = smoothstep_(0.25, 0.0, dist) * intensity;
            
            return chakraCol * glow;
          }

          // All chakras visualization
          fn allChakras(uv: vec2<f32>, activeChakra: f32, secondaryChakra: f32, phasePulse: f32) -> vec3<f32> {
            var col = vec3<f32>(0.0);
            
            // Draw all chakras at low intensity
            for(var i: i32 = 0; i < 7; i = i + 1) {
              let fi = f32(i);
              let isActive = abs(fi - activeChakra) < 0.1;
              let isSecondary = abs(fi - secondaryChakra) < 0.1 && secondaryChakra >= 0.0;
              
              var intensity: f32 = 0.15; // Base glow for all chakras
              if (isActive) { intensity = 0.8 + 0.2 * phasePulse; }
              if (isSecondary) { intensity = 0.4; }
              
              col += chakraGlow(uv, fi, intensity);
            }
            
            return col;
          }

          // Breath ring visualization
          fn breathRing(uv: vec2<f32>, progress: f32, phase: f32) -> vec3<f32> {
            let d = length(uv);
            var col = vec3<f32>(0.0);
            
            // Breathing circle that expands/contracts with breath
            let breathRadius = 0.3 + 0.2 * sin(progress * TAU - PI * 0.5);
            let ringWidth = 0.02;
            
            // Phase-specific colors
            var phaseColor: vec3<f32>;
            if (phase < 1.0) {
              phaseColor = vec3<f32>(0.2, 0.8, 1.0); // Cyan for inhale
            } else if (phase < 2.0) {
              phaseColor = vec3<f32>(1.0, 0.9, 0.2); // Yellow for hold
            } else if (phase < 3.0) {
              phaseColor = vec3<f32>(0.8, 0.2, 1.0); // Purple for exhale
            } else {
              phaseColor = vec3<f32>(0.2, 0.8, 0.5); // Green for hold-out
            }
            
            // Outer glow ring
            let glow = smoothstep_(breathRadius + ringWidth * 3.0, breathRadius, d) * 
                       smoothstep_(breathRadius - ringWidth, breathRadius, d);
            col += phaseColor * glow * 0.5;
            
            // Inner bright ring
            let ring = smoothstep_(breathRadius + ringWidth, breathRadius, d) * 
                       smoothstep_(breathRadius - ringWidth, breathRadius - ringWidth * 0.5, d);
            col += phaseColor * ring;
            
            // Center pulse
            let centerGlow = smoothstep_(breathRadius * 0.5, 0.0, d) * 0.3;
            col += phaseColor * centerGlow;
            
            return col;
          }

          @fragment
          fn fragment_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
            let correctedY = uniforms.resolution.y - fragCoord.y;
            let uv = (vec2<f32>(fragCoord.x, correctedY) - 0.5 * uniforms.resolution) / uniforms.resolution.y;

            let tt = uniforms.time * 0.3;
            let breathP = uniforms.breathProgress;
            let phase = uniforms.breathPhase;
            let cycle = uniforms.cycleNumber;
            let activeChakra = uniforms.activeChakra;
            let secondaryChakra = uniforms.secondaryChakra;

            // Camera Setup
            let rd = normalize(vec3<f32>(uv.x, uv.y, 0.7));
            var p = vec3<f32>(0.0, 0.0, -4.0);

            var col = vec3<f32>(0.0);
            var t: f32 = 0.0;

            // Raymarching Loop
            for(var i: i32 = 0; i < 80; i = i + 1) {
              let res = map(p, tt, breathP, phase);
              let d = res.dist;
              let mat = res.mat;

              if (t > 7.0) { break; }
              t += max(0.01, abs(d));
              p += rd * d;

              if (d < 0.006) {
                // Add cycle-based color variation
                let cycleHue = (mat * 0.4 + cycle * 0.1) % 1.0;
                let al = hue(cycleHue) * 0.9;
                col += al / exp(t * 0.6);
              }
            }

            // Background with breath-synchronized gradient
            var bg = vec3<f32>(0.016, 0.086, 0.125);
            
            // Subtle background pulse with breathing
            let bgPulse = 1.0 + 0.1 * sin(breathP * TAU - PI * 0.5);
            bg *= bgPulse;
            
            if (dot(col, col) < 0.001) {
              col += bg * mix(0.3, 1.1, (1.0 - pow(dot(uv, uv), 0.5)));
            }

            // Add breath ring overlay
            let ringCol = breathRing(uv, breathP, phase);
            col = mix(col, ringCol, 0.3);

            // Add chakra visualization along the central channel (sushumna)
            let phasePulse = sin(breathP * TAU) * 0.5 + 0.5;
            let chakraCol = allChakras(uv, activeChakra, secondaryChakra, phasePulse);
            col += chakraCol * 0.4;

            // Vignette
            col *= mix(0.1, 1.0, (1.5 - pow(dot(uv, uv), 0.2)));
            
            // Gamma correction
            col = pow(col, vec3<f32>(0.6));
            
            return vec4<f32>(col, 1.0);
          }
        `;

        const shaderModule = device.createShaderModule({ code: shaderCode });

        // Create uniform buffer (2 vec2 + 6 f32 = 32 bytes)
        // resolution(2), time(1), breathProgress(1), breathPhase(1), cycleNumber(1), isRunning(1), activeChakra(1), secondaryChakra(1)
        const uniformBufferSize = 32;
        uniformBuffer = device.createBuffer({
          size: uniformBufferSize,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const bindGroupLayout = device.createBindGroupLayout({
          entries: [{ 
            binding: 0, 
            visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, 
            buffer: { type: 'uniform' }
          }],
        });

        const bindGroup = device.createBindGroup({
          layout: bindGroupLayout,
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
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

        // Get initial breath state values
        const getBreathUniforms = () => {
          if (!breathState) {
            return {
              breathProgress: 0.5,
              breathPhase: 0.0,
              cycleNumber: 0.0,
              isRunning: 1.0,
              activeChakra: 3.0,      // Default to Heart
              secondaryChakra: -1.0,   // No secondary
            };
          }
          return {
            breathProgress: breathState.progress,
            breathPhase: PHASE_VALUES[breathState.phase],
            cycleNumber: breathState.cycle % 100.0, // Keep it reasonable for shader
            isRunning: breathState.isRunning ? 1.0 : 0.0,
            activeChakra: CHAKRA_VALUES[breathState.activeChakra],
            secondaryChakra: breathState.secondaryChakra ? CHAKRA_VALUES[breathState.secondaryChakra] : -1.0,
          };
        };

        const doRender = () => {
          if (!device || !canvasRef.current || !uniformBuffer) return;

          const time = (Date.now() % 1000000) / 1000;
          const w = canvasRef.current.width;
          const h = canvasRef.current.height;
          
          const breath = getBreathUniforms();

          // Update uniforms: resolution(2f), time(1f), breathProgress(1f), breathPhase(1f), 
          // cycleNumber(1f), isRunning(1f), activeChakra(1f), secondaryChakra(1f)
          device.queue.writeBuffer(
            uniformBuffer, 
            0, 
            new Float32Array([
              w, h,                    // resolution
              time,                    // time
              breath.breathProgress,   // breathProgress
              breath.breathPhase,      // breathPhase
              breath.cycleNumber,      // cycleNumber
              breath.isRunning,        // isRunning
              breath.activeChakra,     // activeChakra
              breath.secondaryChakra,  // secondaryChakra
            ])
          );

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
          animationId = requestAnimationFrame(doRender);
        };
        
        render = doRender;

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
  }, [breathState]); // Re-initialize when breathState reference changes

  if (!supported || error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white p-8 rounded-lg">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">WebGPU Error</p>
          <p className="text-sm text-gray-400">{error || 'WebGPU not supported'}</p>
          <p className="text-xs text-gray-500 mt-2">
            Please use Chrome 113+ or Edge 113+
          </p>
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full object-contain bg-black rounded-lg"
    />
  );
}
