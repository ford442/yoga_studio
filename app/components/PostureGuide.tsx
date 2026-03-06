'use client';

import { useEffect, useRef } from 'react';

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

export default function PostureGuide({ phase }: { phase: Phase }) {
  const svgRef = useRef<SVGSVGElement>(null);

  const armAngleDeg =
    phase === 'inhale' ? 160 :
    phase === 'hold1'  ? 180 :
    phase === 'exhale' ? 30  : 0;

  useEffect(() => {
    if (!svgRef.current) return;
    const arms = svgRef.current.querySelectorAll<SVGLineElement>('.arm');
    arms.forEach((arm, i) => {
      const cx = i === 0 ? 100 : 140;
      arm.setAttribute('transform', `rotate(${i === 0 ? armAngleDeg : -armAngleDeg} ${cx} 100)`);
    });
  }, [phase, armAngleDeg]);

  return (
    <div className="mt-8 flex flex-col items-center pointer-events-none">
      <p className="text-sm text-indigo-300/70 tracking-wider mb-3">GUIDED POSTURE</p>
      <svg ref={svgRef} width="200" height="280" viewBox="0 0 240 320" className="drop-shadow-2xl">
        {/* Head */}
        <circle cx="120" cy="60" r="28" fill="none" stroke="#c4b5fd" strokeWidth="8" />
        {/* Torso */}
        <line x1="120" y1="88" x2="120" y2="180" stroke="#c4b5fd" strokeWidth="14" strokeLinecap="round" />
        {/* Left arm */}
        <line className="arm" x1="120" y1="100" x2="75" y2="155" stroke="#e0e7ff" strokeWidth="10" strokeLinecap="round" />
        {/* Right arm */}
        <line className="arm" x1="120" y1="100" x2="165" y2="155" stroke="#e0e7ff" strokeWidth="10" strokeLinecap="round" />
        {/* Legs */}
        <line x1="120" y1="180" x2="90" y2="260" stroke="#c4b5fd" strokeWidth="12" strokeLinecap="round" />
        <line x1="120" y1="180" x2="150" y2="260" stroke="#c4b5fd" strokeWidth="12" strokeLinecap="round" />
      </svg>
    </div>
  );
}
