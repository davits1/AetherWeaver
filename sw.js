// AetherWeaver service worker
// - Network-first for same-origin app files (fresh code whenever online, cache as offline fallback)
// - Never touches /proxy/ requests (API traffic must not be cached or intercepted)
// - Bump CACHE_NAME whenever this file's caching behavior changes
const CACHE_NAME = 'aetherweaver-shell-v13';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './avatars/korsakov.png',
  './avatars/maren.png',
  './avatars/vesper.png',
  './avatars/kazimir.png',
  './avatars/soren.png',
  './avatars/architect.png',
  './avatars/tamsin.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only same-origin requests; let the browser handle everything else untouched.
  if (url.origin !== self.location.origin) return;
  // Never intercept or cache API proxy traffic or generated images.
  if (
    url.pathname === '/proxy' ||
    url.pathname.startsWith('/proxy/') ||
    url.pathname.startsWith('/generated_images/')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});