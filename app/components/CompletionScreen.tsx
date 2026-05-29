'use client';

import React, { useEffect } from 'react';

interface CompletionScreenProps {
  minutes: number;
  breaths: number;
  streak: number;
  onClose: () => void;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({ minutes, breaths, streak, onClose }) => {
  useEffect(() => {
    // Gentle confetti burst
    for (let i = 0; i < 80; i++) {
      setTimeout(() => {
        const confetti = document.createElement('div');
        confetti.className = 'fixed text-2xl pointer-events-none z-50';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-20px';
        confetti.textContent = ['✨', '🪷', '🌟', '🙏'][Math.floor(Math.random() * 4)];
        document.body.appendChild(confetti);

        confetti.animate([
          { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
          { transform: `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 800 - 400}deg)`, opacity: 0 }
        ], {
          duration: 2800 + Math.random() * 1200,
          easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)'
        });

        setTimeout(() => confetti.remove(), 5000);
      }, i * 18);
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-8xl mb-6">🪷</div>
        <h2 className="text-5xl font-light tracking-widest mb-3">Session Complete</h2>
        <p className="text-white/60 mb-10">Beautiful work. You are peace.</p>

        <div className="space-y-8 mb-12">
          <div>
            <div className="text-6xl font-light text-cyan-300">{minutes}</div>
            <div className="text-sm tracking-widest text-white/40">MINUTES OF PRESENCE</div>
          </div>
          <div>
            <div className="text-6xl font-light text-purple-300">{breaths}</div>
            <div className="text-sm tracking-widest text-white/40">CONSCIOUS BREATHS</div>
          </div>
          <div>
            <div className="text-6xl font-light text-orange-300 flex items-center justify-center gap-3">
              {streak} <span>🔥</span>
            </div>
            <div className="text-sm tracking-widest text-white/40">DAY STREAK</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-5 text-xl tracking-widest bg-gradient-to-r from-purple-500 to-cyan-500 rounded-3xl hover:brightness-110 transition-all"
        >
          RETURN TO PRACTICE
        </button>
      </div>
    </div>
  );
};

export default CompletionScreen;
