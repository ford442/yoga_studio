'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { SCIENCE_BENEFITS } from '../data/onboarding';

interface WhyThisWorksProps {
  className?: string;
}

const WhyThisWorks: React.FC<WhyThisWorksProps> = ({ className = '' }) => {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 bg-white/10 text-sm text-white/80 hover:bg-white/16 active:scale-95 transition-all"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Why this works — science-backed benefits"
        title="Why this works"
      >
        ℹ️
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="Why structured breathing works"
          className="onboarding-panel-enter absolute right-0 bottom-full z-50 mb-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-white/18 bg-[#0c0818]/96 backdrop-blur-xl p-4 shadow-2xl"
        >
          <p className="text-[10px] tracking-[0.22em] text-cyan-300/85 uppercase mb-2">Why this works</p>
          <ul className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {SCIENCE_BENEFITS.map((item) => (
              <li key={item.title}>
                <p className="text-sm font-light text-white">{item.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/65">{item.body}</p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 w-full min-h-[40px] rounded-xl bg-white/10 text-[11px] tracking-wider hover:bg-white/16 transition-colors"
          >
            GOT IT
          </button>
        </div>
      )}
    </div>
  );
};

export default WhyThisWorks;
