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

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => { if (res.ok || res.type === 'opaque') cache.put(request, res.clone()); return res; }).catch(() => cached);
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
      event.respondWith(fetch(request).then(res => { caches.open(SHELL).then(c => c.put('/index.html', res.clone())); return res; }).catch(() => caches.match('/index.html')));
      return;
    }
    event.respondWith(staleWhileRevalidate(request, SHELL));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(staleWhileRevalidate(request, FONTS));
});
