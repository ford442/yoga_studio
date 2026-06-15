'use client';

import React from 'react';

interface BreathingAvatarProps {
  currentPhase: string;
  phaseProgress: number;
  totalBreaths: number;
  figurePose?: number; // 0=lotus, 1=tadasana, 2=tai-chi, 3=heart-open, 4=chinmudra, 5=warrior, 6=tree
}

const BreathingAvatar: React.FC<BreathingAvatarProps> = ({
  currentPhase,
  phaseProgress,
  totalBreaths,
  figurePose = 0,
}) => {
  const isAlternatingCycle = totalBreaths % 2 !== 0;

  // Pose-specific resting/peak arm angles (degrees)
  // left/right arms rotate from their respective shoulders; 0 = straight down,
  // 90 = horizontal, 180 = overhead.
  const poseRest = [
    [35, 35],     // 0 lotus
    [45, 45],     // 1 tadasana
    [40, 40],     // 2 tai-chi
    [55, 55],     // 3 heart-open
    [30, 30],     // 4 chinmudra
    [70, 70],     // 5 warrior
    [55, 55],     // 6 tree
  ];
  const posePeak = [
    [180, 180],   // 0 lotus
    [185, 185],   // 1 tadasana
    [175, 110],   // 2 tai-chi (asymmetric)
    [95, 95],     // 3 heart-open
    [55, 55],     // 4 chinmudra
    [95, 95],     // 5 warrior
    [95, 95],     // 6 tree
  ];

  const [leftRest, rightRest] = poseRest[figurePose] ?? poseRest[0];
  const [leftPeak, rightPeak] = posePeak[figurePose] ?? posePeak[0];

  let leftArmAngle = leftRest;
  let rightArmAngle = rightRest;

  const leftRange = leftPeak - leftRest;
  const rightRange = rightPeak - rightRest;

  if (!isAlternatingCycle) {
    // Both arms move together
    switch (currentPhase) {
      case 'inhale':
        leftArmAngle = leftRest + phaseProgress * leftRange;
        rightArmAngle = rightRest + phaseProgress * rightRange;
        break;
      case 'hold1':
        leftArmAngle = leftPeak;
        rightArmAngle = rightPeak;
        break;
      case 'exhale':
        leftArmAngle = leftPeak - phaseProgress * leftRange;
        rightArmAngle = rightPeak - phaseProgress * rightRange;
        break;
      default: // hold2
        leftArmAngle = leftRest;
        rightArmAngle = rightRest;
    }
  } else {
    // Staggered: left sweeps up first half of inhale, right follows second half
    switch (currentPhase) {
      case 'inhale':
        if (phaseProgress < 0.5) {
          leftArmAngle = leftRest + phaseProgress * 2 * leftRange;
          rightArmAngle = rightRest;
        } else {
          leftArmAngle = leftPeak;
          rightArmAngle = rightRest + (phaseProgress - 0.5) * 2 * rightRange;
        }
        break;
      case 'hold1':
        leftArmAngle = leftPeak;
        rightArmAngle = rightPeak;
        break;
      case 'exhale':
        if (phaseProgress < 0.5) {
          leftArmAngle = leftPeak - phaseProgress * 2 * leftRange;
          rightArmAngle = rightPeak;
        } else {
          leftArmAngle = leftRest;
          rightArmAngle = rightPeak - (phaseProgress - 0.5) * 2 * rightRange;
        }
        break;
      default: // hold2
        leftArmAngle = leftRest;
        rightArmAngle = rightRest;
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
