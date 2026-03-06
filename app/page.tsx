'use client';

import { useRef, useEffect } from 'react';
import WebGPUShader, { WebGPUShaderRef } from './components/WebGPUShader';
import { useSacredBreathTimer } from './hooks/useSacredBreathTimer';
import PostureGuide from './components/PostureGuide';

export default function Home() {
  const breath = useSacredBreathTimer(0); // start with light level
  const shaderRef = useRef<WebGPUShaderRef>(null);

  useEffect(() => {
    if (!shaderRef.current) return;
    const update = () => {
      shaderRef.current?.updateUniforms(breath.getUniforms());
      requestAnimationFrame(update);
    };
    const raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [breath.phase, breath.phaseProgress, breath.cycle, breath.strengthLevel]);

  return (
    <main className="relative w-screen h-screen bg-black overflow-hidden">
      <WebGPUShader ref={shaderRef} strengthLevel={breath.strengthLevel} />

      {/* Sacred Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none">
        <div className="text-[20vw] font-light tracking-[-0.08em] tabular-nums leading-none">
          {breath.countdown}
        </div>

        <div className="text-6xl font-medium tracking-widest uppercase mt-[-4rem] text-indigo-300">
          {breath.phase.toUpperCase()}
        </div>

        <div className="mt-16 text-2xl font-mono text-white/60">
          Cycle <span className="text-white">{breath.cycle}</span>
        </div>

        <PostureGuide phase={breath.phase} />

        {/* Breathing progress ring (SVG) */}
        <svg className="absolute w-[500px] h-[500px] opacity-40" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="90" fill="none" stroke="#a5b4fc" strokeWidth="4" strokeDasharray="565" strokeDashoffset={565 * (1 - breath.phaseProgress)} />
        </svg>
      </div>

      {/* Controls */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-6 pointer-events-auto">
        <button
          onClick={breath.isRunning ? breath.pause : breath.start}
          className="px-8 py-4 bg-indigo-600/80 hover:bg-indigo-500 rounded-full text-xl font-medium backdrop-blur-sm"
        >
          {breath.isRunning ? 'Pause' : 'Begin Sacred Breath'}
        </button>

        <select
          value={breath.strengthLevel}
          onChange={e => breath.setStrengthLevel(Number(e.target.value))}
          className="px-6 py-4 bg-gray-900/80 border border-indigo-500/50 rounded-full text-white"
        >
          <option value={0}>Light</option>
          <option value={1}>Medium</option>
          <option value={2}>Strong</option>
        </select>

        <button onClick={breath.reset} className="px-6 py-4 bg-gray-700/60 hover:bg-gray-600 rounded-full">
          Reset
        </button>
      </div>
    </main>
  );
}
