'use client';

import React, { useCallback, useEffect, useState } from 'react';

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

const burstKindFor = (from: Phase, to: Phase): BurstKind | null => {
  if (from === 'inhale' && to === 'hold1') return 'peak';
  if (from === 'exhale' && to === 'hold2') return 'settle';
  return null;
};

/** One burst: owns its particles and removes itself when its animation ends. */
const BurstLayer: React.FC<{ burst: Burst; onDone: (id: number) => void }> = ({ burst, onDone }) => {
  const [particles] = useState(() => buildParticles(burst.kind));
  const { id, kind } = burst;

  useEffect(() => {
    const timeout = window.setTimeout(
      () => onDone(id),
      kind === 'peak' ? PEAK_DURATION_MS : SETTLE_DURATION_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [id, kind, onDone]);

  return (
    <div className="absolute inset-0">
      {particles.map((particle, index) => (
        <span
          key={`${id}-${index}`}
          className={kind === 'peak' ? 'phase-burst-spark' : 'phase-burst-settle'}
          style={{
            ['--dx' as string]: `${particle.dx}px`,
            ['--dy' as string]: `${particle.dy}px`,
            ['--particle-size' as string]: `${particle.size}px`,
            color: burst.color,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

const ParticleBurst: React.FC<ParticleBurstProps> = ({ phase, isRunning, color }) => {
  // Phase transitions are detected while rendering (state derived from props),
  // so no effect has to call setState synchronously.
  const [tracked, setTracked] = useState({ phase, seq: 0 });
  const [bursts, setBursts] = useState<Burst[]>([]);

  if (tracked.phase !== phase) {
    const kind = isRunning ? burstKindFor(tracked.phase, phase) : null;
    const seq = kind ? tracked.seq + 1 : tracked.seq;
    setTracked({ phase, seq });
    if (kind) setBursts((prev) => [...prev, { id: seq, kind, color }]);
  }

  const removeBurst = useCallback(
    (id: number) => setBursts((prev) => prev.filter((item) => item.id !== id)),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {bursts.map((burst) => (
        <BurstLayer key={burst.id} burst={burst} onDone={removeBurst} />
      ))}
    </div>
  );
};

export default ParticleBurst;
