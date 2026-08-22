'use client';

import React, { useEffect, useRef, useState } from 'react';

type Phase = 'inhale' | 'hold1' | 'exhale' | 'hold2';
type BurstKind = 'peak' | 'settle';

interface Particle {
  dx: number;
  dy: number;
  size: number;
}

interface Burst {
  id: number;
  kind: BurstKind;
  color: string;
  particles: Particle[];
}

interface ParticleBurstProps {
  phase: Phase;
  isRunning: boolean;
  color: string;
}

const PEAK_DURATION_MS = 650;
const SETTLE_DURATION_MS = 1250;

const buildParticles = (kind: BurstKind): Particle[] => {
  if (kind === 'peak') {
    const count = 14;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const distance = 95 + Math.random() * 55;
      return {
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        size: 4 + Math.random() * 5,
      };
    });
  }

  const count = 10;
  return Array.from({ length: count }, () => ({
    dx: (Math.random() - 0.5) * 70,
    dy: 80 + Math.random() * 80,
    size: 8 + Math.random() * 6,
  }));
};

const ParticleBurst: React.FC<ParticleBurstProps> = ({ phase, isRunning, color }) => {
  const prevPhaseRef = useRef<Phase>(phase);
  const timersRef = useRef<number[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const from = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (!isRunning) return;

    let kind: BurstKind | null = null;
    if (from === 'inhale' && phase === 'hold1') kind = 'peak';
    if (from === 'exhale' && phase === 'hold2') kind = 'settle';
    if (!kind) return;

    const id = Date.now() + Math.floor(Math.random() * 1000);
    const burst: Burst = {
      id,
      kind,
      color,
      particles: buildParticles(kind),
    };
     
    setBursts((prev) => [...prev, burst]);

    const timeout = window.setTimeout(() => {
      setBursts((prev) => prev.filter((item) => item.id !== id));
      timersRef.current = timersRef.current.filter((value) => value !== timeout);
    }, kind === 'peak' ? PEAK_DURATION_MS : SETTLE_DURATION_MS);
    timersRef.current.push(timeout);
  }, [phase, isRunning, color]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {bursts.map((burst) => (
        <div key={burst.id} className="absolute inset-0">
          {burst.particles.map((particle, index) => (
            <span
              key={`${burst.id}-${index}`}
              className={burst.kind === 'peak' ? 'phase-burst-spark' : 'phase-burst-settle'}
              style={{
                ['--dx' as string]: `${particle.dx}px`,
                ['--dy' as string]: `${particle.dy}px`,
                ['--particle-size' as string]: `${particle.size}px`,
                color: burst.color,
              } as React.CSSProperties}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default ParticleBurst;
