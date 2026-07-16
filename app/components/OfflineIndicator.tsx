'use client';

import React from 'react';
import { useServiceWorker } from './ServiceWorkerRegistration';

const OfflineIndicator: React.FC = () => {
  const { isOnline } = useServiceWorker();

  if (isOnline) return null;

  return (
    <div className="fixed top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[60]">
      <div className="rounded-full bg-black/60 backdrop-blur-md border border-white/15 px-4 py-1.5 text-[10px] tracking-[0.2em] text-cyan-200/90 shadow-lg">
        OFFLINE · PRACTICE CACHED
      </div>
    </div>
  );
};

export default OfflineIndicator;
