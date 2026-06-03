'use client';

import React from 'react';

interface BreathingAvatarProps {
  currentPhase: string;
  phaseProgress: number;
  totalBreaths: number;
}

const BreathingAvatar: React.FC<BreathingAvatarProps> = ({
  currentPhase,
  phaseProgress,
  totalBreaths,
}) => {
  const isAlternatingCycle = totalBreaths % 2 !== 0;

  // Resting angle = 35° (arms slightly out from sides), raised = 180° (overhead)
  let leftArmAngle = 35;
  let rightArmAngle = 35;

  if (!isAlternatingCycle) {
    // Both arms move together
    switch (currentPhase) {
      case 'inhale':
        leftArmAngle = 35 + phaseProgress * 145;
        rightArmAngle = 35 + phaseProgress * 145;
        break;
      case 'hold1':
        leftArmAngle = 180;
        rightArmAngle = 180;
        break;
      case 'exhale':
        leftArmAngle = 180 - phaseProgress * 145;
        rightArmAngle = 180 - phaseProgress * 145;
        break;
      default: // hold2
        leftArmAngle = 35;
        rightArmAngle = 35;
    }
  } else {
    // Staggered: left sweeps up first half of inhale, right follows second half
    switch (currentPhase) {
      case 'inhale':
        if (phaseProgress < 0.5) {
          leftArmAngle = 35 + phaseProgress * 2 * 145;
          rightArmAngle = 35;
        } else {
          leftArmAngle = 180;
          rightArmAngle = 35 + (phaseProgress - 0.5) * 2 * 145;
        }
        break;
      case 'hold1':
        leftArmAngle = 180;
        rightArmAngle = 180;
        break;
      case 'exhale':
        if (phaseProgress < 0.5) {
          leftArmAngle = 180 - phaseProgress * 2 * 145;
          rightArmAngle = 180;
        } else {
          leftArmAngle = 35;
          rightArmAngle = 180 - (phaseProgress - 0.5) * 2 * 145;
        }
        break;
      default: // hold2
        leftArmAngle = 35;
        rightArmAngle = 35;
    }
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full text-white/90 drop-shadow-[0_0_12px_rgba(147,51,234,0.3)]"
    >
      {/* Lotus seat base */}
      <path
        d="M 25 72 C 35 82, 65 82, 75 72 C 65 66, 35 66, 25 72 Z"
        fill="currentColor"
        className="opacity-20"
      />
      <path
        d="M 30 72 C 40 76, 60 76, 70 72"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Torso */}
      <line x1="50" y1="42" x2="50" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />

      {/* Head */}
      <circle cx="50" cy="27" r="7" fill="currentColor" />

      {/* Left arm — rotates counter-clockwise from shoulder at (44, 44) */}
      <g transform={`rotate(${-leftArmAngle}, 44, 44)`}>
        <line x1="44" y1="44" x2="44" y2="64" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      </g>

      {/* Right arm — rotates clockwise from shoulder at (56, 44) */}
      <g transform={`rotate(${rightArmAngle}, 56, 44)`}>
        <line x1="56" y1="44" x2="56" y2="64" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
};

export default BreathingAvatar;
