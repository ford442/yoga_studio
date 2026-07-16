'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ServiceWorkerContextValue {
  isRegistered: boolean;
  isOnline: boolean;
  hasUpdate: boolean;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextValue>({
  isRegistered: false,
  isOnline: true,
  hasUpdate: false,
});

export const useServiceWorker = () => useContext(ServiceWorkerContext);

const ServiceWorkerRegistration: React.FC = () => {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize online state from browser on mount
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        setIsRegistered(true);

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              setHasUpdate(true);
            }
          });
        });
      })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <ServiceWorkerContext.Provider value={{ isRegistered, isOnline, hasUpdate }}>
      {null}
    </ServiceWorkerContext.Provider>
  );
};

export default ServiceWorkerRegistration;
