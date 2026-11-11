// Service worker template. Generated at build time by scripts/generate-sw.mjs.
// CACHE_VERSION is replaced with a versioned timestamp on every build.
const CACHE_VERSION = '{{CACHE_VERSION}}';
const APP_CACHE = `sacred-breath-app-${CACHE_VERSION}`;
const BG_CACHE = `sacred-breath-backgrounds-${CACHE_VERSION}`;
const MEDIA_CACHE = `sacred-breath-media-${CACHE_VERSION}`;
const CHUNK_CACHE = `sacred-breath-chunks-${CACHE_VERSION}`;

// The app is served under a sub-path (e.g. /yoga/), so routes are matched against
// the path relative to the registration scope rather than the domain root.
const SCOPE_PATH = new URL(self.registration.scope).pathname;

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './sacred-monk.wgsl',
  './sacred-lotus-final.wgsl',
  './sacred-lotus-final/core.wgsl',
  './sacred-lotus-final/background-atmosphere.wgsl',
  './sacred-lotus-final/lotus-symbol.wgsl',
  './sacred-lotus-final/energy-ribbons.wgsl',
  './sacred-lotus-final/post-figure-composition.wgsl',
  './sacred-ultra.wgsl',
  './sacred-ultra/core.wgsl',
  './sacred-ultra/background-geometry.wgsl',
  './sacred-ultra/figure-energy.wgsl',
  './sacred-ultra/lotus-ribbons.wgsl',
  './sacred-ultra/post-composition.wgsl',
  './yoga-regular.wgsl',
  './backgrounds/void-nearblack-16x9.webp',
  './instructor/raise_arms.mp4',
];

const optionalPrecacheAssets = new Set([
  './backgrounds/void-nearblack-16x9.webp',
  './instructor/raise_arms.mp4',
]);

const isOptional = (url) => optionalPrecacheAssets.has(url);

const isDocumentAsset = (url) => url === './' || url === './index.html';

// Fetch and verify each precache entry, so a host that answers with an HTML page
// (SPA fallback or error page) cannot get that page stored under a shader's URL.
const precacheAsset = async (cache, url) => {
  const response = await fetch(url);
  if (!isCacheable(response, isDocumentAsset(url))) {
    throw new Error(`unexpected response ${response.status} (${response.headers.get('content-type')})`);
  }
  await cache.put(url, response);
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_ASSETS.map((url) =>
            precacheAsset(cache, url).catch((err) => {
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

// '/yoga/_next/static/x.js' -> '/_next/static/x.js' when the scope is '/yoga/'.
const scopedPath = (url) =>
  url.pathname.startsWith(SCOPE_PATH) ? `/${url.pathname.slice(SCOPE_PATH.length)}` : url.pathname;

const isStaticChunk = (url) => scopedPath(url).startsWith('/_next/static/');

const isShader = (url) => url.pathname.endsWith('.wgsl');

const isBackground = (url) => scopedPath(url).startsWith('/backgrounds/');

const isInstructor = (url) => scopedPath(url).startsWith('/instructor/');

// Only full, same-origin 200 responses are stored. A 206 cannot be put into a Cache,
// and HTML is only expected for documents; anywhere else it is a fallback page.
const isCacheable = (response, allowHtml = false) => {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  if (allowHtml) return true;
  return !(response.headers.get('content-type') || '').includes('text/html');
};

// Cache writes are best-effort; a failed write must not fail the response.
const cachePut = (cache, request, response) => {
  cache.put(request, response).catch((err) => {
    console.warn('[SW] Cache write failed:', request.url, err.message);
  });
};

const cacheFirst = async (request, cacheName, options = {}) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (isCacheable(response)) cachePut(cache, request, response.clone());
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
      if (isCacheable(response, isNavigationRequest(request))) cachePut(cache, request, response.clone());
      return response;
    })
    .catch((err) => {
      if (options.optional) {
        console.warn('[SW] Optional revalidate failed:', request.url, err.message);
      }
      return undefined;
    });

  if (cached) return cached;

  const response = await networkPromise;
  if (response) return response;
  throw new Error(`[SW] Network error and nothing cached for ${request.url}`);
};

const networkFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cachePut(cache, request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
};

// respondWith must always resolve: a rejected promise surfaces as a browser network error.
// Navigations get the cached app shell; anything else gets an empty 503.
const fallbackResponse = async (request) => {
  if (isNavigationRequest(request)) {
    const shell = await caches.match('./index.html').catch(() => undefined);
    if (shell) return shell;
  }
  return new Response('', { status: 503, statusText: 'Offline' });
};

const routeRequest = (request, url) => {
  if (isNavigationRequest(request)) return staleWhileRevalidate(request, APP_CACHE);
  if (isShader(url)) return cacheFirst(request, APP_CACHE);
  if (isStaticChunk(url)) return cacheFirst(request, CHUNK_CACHE);
  if (isBackground(url)) return cacheFirst(request, BG_CACHE, { optional: true });
  if (isInstructor(url)) return staleWhileRevalidate(request, MEDIA_CACHE, { optional: true });

  // Manifest, favicon, and any other same-origin static assets.
  return networkFirst(request, APP_CACHE);
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Bypass non-same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Range requests (video seeking) go straight to the network. A cached full file
  // would answer a partial request with the wrong bytes.
  if (request.headers.has('range')) return;

  event.respondWith(
    routeRequest(request, url).catch((err) => {
      console.warn('[SW] Fetch failed, serving fallback:', request.url, err.message);
      return fallbackResponse(request);
    }),
  );
});
