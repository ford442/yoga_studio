'use client';

import React from 'react';

interface ExportStatsProps {
  todayMinutes: number;
  todayBreaths: number;
  currentStreak: number;
}

const ExportStats: React.FC<ExportStatsProps> = ({ todayMinutes, todayBreaths, currentStreak }) => {
  const handleExport = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d')!;

    // Deep cosmic background
    const grad = ctx.createRadialGradient(540, 540, 200, 540, 540, 700);
    grad.addColorStop(0, '#0a0520');
    grad.addColorStop(1, '#05010a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1080);

    // Subtle mandala rings
    ctx.strokeStyle = 'rgba(180, 120, 255, 0.15)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(540, 540, 180 + i * 45, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lotus / mandala center glow
    ctx.fillStyle = 'rgba(255, 200, 100, 0.08)';
    ctx.beginPath();
    ctx.arc(540, 540, 160, 0, Math.PI * 2);
    ctx.fill();

    // Title
    ctx.fillStyle = '#e0d4ff';
    ctx.font = '600 52px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('SACRED BREATH', 540, 220);

    ctx.font = '300 28px system-ui';
    ctx.fillStyle = '#a090c0';
    ctx.fillText(new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    }), 540, 270);

    // Big stats
    ctx.fillStyle = '#fff';
    ctx.font = '700 120px system-ui';
    ctx.fillText(`${todayMinutes}`, 540, 480);
    ctx.font = '400 36px system-ui';
    ctx.fillStyle = '#b8a0ff';
    ctx.fillText('MINUTES TODAY', 540, 530);

    ctx.fillStyle = '#fff';
    ctx.font = '700 96px system-ui';
    ctx.fillText(`${todayBreaths}`, 540, 680);
    ctx.font = '400 32px system-ui';
    ctx.fillStyle = '#b8a0ff';
    ctx.fillText('BREATHS', 540, 720);

    // Streak with fire
    ctx.fillStyle = '#fff';
    ctx.font = '700 110px system-ui';
    ctx.fillText(`${currentStreak}`, 540, 880);
    ctx.font = '600 42px system-ui';
    ctx.fillStyle = '#ff8a4d';
    ctx.fillText('🔥 DAY STREAK', 540, 930);

    // Bottom tagline
    ctx.font = '300 26px system-ui';
    ctx.fillStyle = '#6a5a90';
    ctx.fillText('breathe • align • flow', 540, 1020);

    // Download
    const link = document.createElement('a');
    link.download = `sacred-breath-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <button
      onClick={handleExport}
      className="px-8 py-3.5 text-sm font-light tracking-[3px] border border-white/30 hover:bg-white/10 rounded-3xl transition-all active:scale-95 flex items-center gap-2"
    >
      📤 SHARE PRACTICE
    </button>
  );
};

export default ExportStats;
