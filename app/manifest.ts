import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sacred Breath',
    short_name: 'SacredBreath',
    description: 'A sacred breath timer for deep meditation and pranayama practice',
    start_url: '/',
    display: 'standalone',
    background_color: '#05010a',
    theme_color: '#05010a',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    categories: ['health', 'lifestyle', 'meditation'],
    lang: 'en',
    orientation: 'any',
  };
}
