'use client';

import { useEffect, useRef } from 'react';

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

interface PostureGuideProps {
  phase: Phase;
}

export default function PostureGuide({ phase }: PostureGuideProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const armAngle = 
    phase === 'inhale' ? 145 :
    phase === 'hold1'  ? 175 :
    phase === 'exhale' ? 35  : 0;   // hold2 = relaxed at sides

  useEffect(() => {
    if (!svgRef.current) return;
    const arms = svgRef.current.querySelectorAll<SVGLineElement>('.arm');
    arms.forEach((arm, i) => {
      const angle = i === 0 ? armAngle : -armAngle;
      arm.setAttribute('transform', `rotate(${angle} ${i === 0 ? 105 : 135} 105)`);
    });
  }, [phase, armAngle]);

  return (
    <div className="mt-6 flex flex-col items-center">
      <p className="text-xs tracking-[4px] text-white/40 mb-2">YOUR POSTURE</p>
      <svg
        ref={svgRef}
        width="160"
        height="220"
        viewBox="0 0 240 260"
        className="drop-shadow-[0_0_30px_rgba(165,180,252,0.6)]"
      >
        {/* Head */}
        <circle cx="120" cy="65" r="23" fill="none" stroke="#a5b4fc" strokeWidth="7" />
        {/* Body */}
        <line x1="120" y1="88" x2="120" y2="168" stroke="#a5b4fc" strokeWidth="12" strokeLinecap="round" />
        {/* Left Arm */}
        <line className="arm" x1="120" y1="105" x2="68" y2="148" stroke="#c4d0ff" strokeWidth="9" strokeLinecap="round" />
        {/* Right Arm */}
        <line className="arm" x1="120" y1="105" x2="172" y2="148" stroke="#c4d0ff" strokeWidth="9" strokeLinecap="round" />
        {/* Legs */}
        <line x1="120" y1="168" x2="95" y2="230" stroke="#a5b4fc" strokeWidth="10" strokeLinecap="round" />
        <line x1="120" y1="168" x2="145" y2="230" stroke="#a5b4fc" strokeWidth="10" strokeLinecap="round" />
      </svg>
    </div>
  );
}
