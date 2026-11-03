// Offline support: the app shell and your photos are cached so the library opens without signal.
const VERSION = '__VERSION__';
const SHELL = `sw-shell-${VERSION}`;
const PHOTOS = 'sw-photos-v1';
const FONTS = 'sw-fonts-v1';
const CORE = ['/', '/index.html', '/styles.css', '/src/app.js', '/manifest.webmanifest', '/assets/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sw-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Recipe modules must be fresh when online: serving the cached catalog first
// leaves an installed app unable to resolve newly published recipe IDs.
const networkFirst = async request => {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(new Request(request, { cache: 'no-cache' }));
    if (response.status >= 500) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    if (response.ok) await cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
};

const staleWhileRevalidate = async (request, cacheName, event) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(async res => { if (res.ok || res.type === 'opaque') await cache.put(request, res.clone()).catch(() => {}); return res; }).catch(() => cached);
  event.waitUntil(network.then(() => {}));
  return cached || network;
};

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === location.origin) {
    if (url.pathname === '/api/photo') {
      event.respondWith(caches.open(PHOTOS).then(async c => (await c.match(request)) || fetch(request).then(res => { if (res.ok) c.put(request, res.clone()); return res; })));
      return;
    }
    if (url.pathname.startsWith('/api/')) return;
    if (request.mode === 'navigate') {
      event.respondWith((async () => {
        const cache = await caches.open(SHELL);
        try {
          const response = await fetch(new Request(request, { cache: 'no-cache' }));
          if (!response.ok) throw new Error('App shell unavailable');
          await cache.put('/index.html', response.clone()).catch(() => {});
          return response;
        } catch (error) {
          const cached = await cache.match('/index.html');
          if (cached) return cached;
          throw error;
        }
      })());
      return;
    }
    if (['script', 'style', 'worker'].includes(request.destination) || /\.(?:m?js|css|json|webmanifest)$/.test(url.pathname)) {
      event.respondWith(networkFirst(request));
      return;
    }
    event.respondWith(staleWhileRevalidate(request, SHELL, event));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(staleWhileRevalidate(request, FONTS, event));
});
