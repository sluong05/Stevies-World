import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { watchAppUpdates } from '../src/updates.js';

// Run the actual worker with a stale cached catalog, just like a previously
// installed copy. No browser state or personal library is changed by these tests.
async function worker() {
  const origin = 'https://stevies.test';
  const listeners = new Map(), stores = new Map();
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(request) { return store.get(key(request))?.clone(); },
        async put(request, response) { store.set(key(request), response.clone()); },
        async addAll(paths) { for (const path of paths) store.set(key(path), new Response('precached')); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  let network = async () => new Response('new catalog');
  const requests = [];
  class Request {
    constructor(input, options = {}) {
      Object.assign(this, typeof input === 'string' ? { url: new URL(input, origin).href, method: 'GET', mode: 'cors', destination: '' } : input, options);
    }
  }
  const self = { addEventListener: (name, handler) => listeners.set(name, handler), skipWaiting: async () => {}, clients: { claim: async () => {} } };
  const code = (await readFile(new URL('../sw.js', import.meta.url), 'utf8')).replace('__VERSION__', 'test');
  vm.runInNewContext(code, { self, caches, location: { origin }, Request, Response, URL, fetch: async request => { requests.push(request); return network(request); } });
  return {
    caches, requests,
    setNetwork(fn) { network = fn; },
    async seed(name, path, body) { await (await caches.open(name)).put(path, new Response(body)); },
    async dispatch(name, request) {
      let response;
      const pending = [];
      listeners.get(name)({ request: request && new Request(request.url || request, request), respondWith(p) { response = p; }, waitUntil(p) { pending.push(p); } });
      const result = response ? await response : undefined;
      await Promise.all(pending);
      return result;
    },
  };
}

test('an installed app gets the new recipe catalog on the first online load, then uses it offline', async () => {
  const sw = await worker();
  await sw.seed('sw-shell-test', '/data/cookbook.js', 'old catalog without shu mai');
  const request = { url: 'https://stevies.test/data/cookbook.js', method: 'GET', destination: 'script' };
  assert.equal(await (await sw.dispatch('fetch', request)).text(), 'new catalog');
  assert.equal(sw.requests[0].cache, 'no-cache');
  sw.setNetwork(async () => { throw new Error('offline'); });
  assert.equal(await (await sw.dispatch('fetch', request)).text(), 'new catalog');
});

test('an unavailable server falls back to the cached app and does not overwrite it with an error', async () => {
  const sw = await worker();
  await sw.seed('sw-shell-test', '/src/app.js', 'working app');
  await sw.seed('sw-shell-test', '/index.html', 'working home');
  sw.setNetwork(async () => new Response('temporary error', { status: 503 }));
  assert.equal(await (await sw.dispatch('fetch', { url: 'https://stevies.test/src/app.js', method: 'GET', destination: 'script' })).text(), 'working app');
  assert.equal(await (await sw.dispatch('fetch', { url: 'https://stevies.test/', method: 'GET', mode: 'navigate' })).text(), 'working home');
  assert.equal(await (await (await sw.caches.open('sw-shell-test')).match('/src/app.js')).text(), 'working app');
});

test('updating removes only obsolete app shells, preserving offline photos and unrelated caches', async () => {
  const sw = await worker();
  await sw.seed('sw-shell-old', '/', 'old');
  await sw.seed('sw-shell-test', '/', 'new');
  await sw.seed('sw-photos-v1', '/api/photo?k=personalphoto', 'saved photo');
  await sw.seed('unrelated-cache', '/', 'other');
  await sw.dispatch('activate');
  assert.deepEqual((await sw.caches.keys()).sort(), ['sw-photos-v1', 'sw-shell-test', 'unrelated-cache'].sort());
  assert.equal(await sw.dispatch('fetch', { url: 'https://stevies.test/api/library', method: 'GET' }), undefined);
  assert.equal(sw.requests.length, 0, 'private API requests remain outside the app-shell cache');
});

function updater({ initialController = {}, safe = true } = {}) {
  const sw = new EventTarget(), win = new EventTarget(), doc = new EventTarget();
  sw.controller = initialController;
  doc.visibilityState = 'visible';
  let reloads = 0, updates = 0, clock = 1_000;
  let registered;
  sw.register = async (...args) => { registered = args; return { async update() { updates++; } }; };
  const watch = watchAppUpdates({ serviceWorker: sw, windowTarget: win, documentTarget: doc, canReload: () => safe, reload: () => reloads++, now: () => clock });
  return { sw, win, doc, watch, safe(value) { safe = value; }, tick(ms) { clock += ms; }, state: () => ({ reloads, updates, registered }) };
}

test('a new controller reloads a browsing page once, with no reload loop on first installation', async () => {
  const u = updater();
  await u.watch.check();
  assert.deepEqual(u.state().registered, ['/sw.js', { updateViaCache: 'none' }]);
  u.sw.controller = {};
  u.sw.dispatchEvent(new Event('controllerchange'));
  u.win.dispatchEvent(new Event('hashchange'));
  assert.equal(u.state().reloads, 1);
  const first = updater({ initialController: null });
  await first.watch.check();
  first.sw.controller = {};
  first.sw.dispatchEvent(new Event('controllerchange'));
  assert.equal(first.state().reloads, 0);
});

test('updates wait until editing or cooking ends and recheck when the app returns to the foreground', async () => {
  const u = updater({ safe: false });
  await u.watch.check();
  u.sw.controller = {};
  u.sw.dispatchEvent(new Event('controllerchange'));
  assert.equal(u.state().reloads, 0);
  u.safe(true);
  u.win.dispatchEvent(new Event('hashchange'));
  assert.equal(u.state().reloads, 1);

  const foreground = updater();
  await foreground.watch.check();
  const before = foreground.state().updates;
  foreground.tick(61_000);
  foreground.doc.dispatchEvent(new Event('visibilitychange'));
  await foreground.watch.check();
  assert.equal(foreground.state().updates, before + 1);
});
