'use client';

import { useEffect } from 'react';

const ManifestLink = () => {
  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (existing) {
      existing.href = './manifest.webmanifest';
      return;
    }

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = './manifest.webmanifest';
    document.head.appendChild(link);
  }, []);

  return null;
};

export default ManifestLink;
