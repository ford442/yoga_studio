// Service worker template. Generated at build time by scripts/generate-sw.mjs.
// CACHE_VERSION is replaced with a versioned timestamp on every build.
const CACHE_VERSION = '{{CACHE_VERSION}}';
const APP_CACHE = `sacred-breath-app-${CACHE_VERSION}`;
const BG_CACHE = `sacred-breath-backgrounds-${CACHE_VERSION}`;
const MEDIA_CACHE = `sacred-breath-media-${CACHE_VERSION}`;
const CHUNK_CACHE = `sacred-breath-chunks-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './sacred-monk.wgsl',
  './sacred-lotus-final.wgsl',
  './sacred-ultra.wgsl',
  './yoga-regular.wgsl',
  './backgrounds/void-nearblack-16x9.webp',
  './instructor/raise_arms.mp4',
];

const optionalPrecacheAssets = new Set([
  './backgrounds/void-nearblack-16x9.webp',
  './instructor/raise_arms.mp4',
]);

const isOptional = (url) => {
  const pathname = new URL(url).pathname;
  return optionalPrecacheAssets.has('.' + pathname) || optionalPrecacheAssets.has(pathname);
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              if (isOptional(url)) {
                console.warn('[SW] Optional precache asset skipped:', url, err.message);
              } else {
                console.error('[SW] Required precache asset failed:', url, err.message);
              }
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('[SW] Install failed:', err);
        throw err;
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('sacred-breath-') && key !== APP_CACHE && key !== BG_CACHE && key !== MEDIA_CACHE && key !== CHUNK_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isNavigationRequest = (request) => request.mode === 'navigate';

const isStaticChunk = (url) => url.pathname.startsWith('/_next/static/');

const isShader = (url) => url.pathname.endsWith('.wgsl');

const isBackground = (url) => url.pathname.startsWith('/backgrounds/');

const isInstructor = (url) => url.pathname.startsWith('/instructor/');

const cacheFirst = async (request, cacheName, options = {}) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    if (options.optional) {
      console.warn('[SW] Optional fetch failed:', request.url, err.message);
    }
    throw err;
  }
};

const staleWhileRevalidate = async (request, cacheName, options = {}) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((err) => {
      if (options.optional) {
        console.warn('[SW] Optional revalidate failed:', request.url, err.message);
      }
      return undefined;
    });

  if (cached) {
    networkPromise.catch(() => {});
    return cached;
  }

  const response = await networkPromise;
  if (response) return response;
  throw new Error(`[SW] Network error and nothing cached for ${request.url}`);
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Bypass non-same-origin requests.
  if (url.origin !== self.location.origin) return;

  if (isNavigationRequest(request)) {
    event.respondWith(staleWhileRevalidate(request, APP_CACHE));
    return;
  }

  if (isShader(url)) {
    event.respondWith(cacheFirst(request, APP_CACHE));
    return;
  }

  if (isStaticChunk(url)) {
    event.respondWith(cacheFirst(request, CHUNK_CACHE));
    return;
  }

  if (isBackground(url)) {
    event.respondWith(cacheFirst(request, BG_CACHE, { optional: true }));
    return;
  }

  if (isInstructor(url)) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE, { optional: true }));
    return;
  }

  // Manifest, favicon, and any other same-origin static assets.
  event.respondWith(networkFirst(request, APP_CACHE));
});
