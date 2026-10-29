import test from 'node:test';
import assert from 'node:assert/strict';
import { memoryRedis } from '../lib/redis.js';
import { readLibrary, applyOps, readPhoto } from '../lib/library.js';
import { normalizeItem, safePhotoSrc, ItemError } from '../shared/schema.js';
import libraryHandler from '../api/library.js';

const jpeg = `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 224, 1, 2, 3, 4]).toString('base64')}`;
const workout = { id: 'workout-abc123', type: 'workout', title: 'Push day', focus: 'Push', blocks: [{ name: '', exercises: [{ name: 'Bench', sets: '4', reps: '8' }] }], updatedAt: 10 };

test('items are checked before they are stored', () => {
  assert.throws(() => normalizeItem({ id: 'x', type: 'recipe', title: 'A' }), ItemError);
  assert.throws(() => normalizeItem({ id: 'recipe-1234', type: 'recipe', title: '  ' }), /title/);
  const r = normalizeItem({ id: 'recipe-1234', type: 'recipe', title: 'Toast', ingredients: 'bread\n\nbutter', sourceUrl: 'javascript:alert(1)', photo: { src: 'http://insecure.example/a.jpg' }, nutrition: { calories: '', protein: '' } });
  assert.deepEqual(r.ingredients, ['bread', 'butter']);
  assert.equal(r.sourceUrl, '');
  assert.equal(r.photo, undefined);
  assert.equal(r.nutrition, undefined);
  assert.equal(safePhotoSrc('/api/photo?k=abcdefghijklmnopqrstuvwx'), '/api/photo?k=abcdefghijklmnopqrstuvwx');
  assert.equal(safePhotoSrc('data:image/svg+xml;base64,PHN2Zz4='), '');
});

test('sync storage: photos move out of items, deletes clean up, favorites and revisions', async () => {
  const redis = memoryRedis();
  const first = await applyOps(redis, [{ op: 'put', item: { ...workout, photo: { src: jpeg, alt: 'bench' } } }, { op: 'save', id: 'workout-abc123', value: true }]);
  const stored = first.results[0].item;
  assert.match(stored.photo.src, /^\/api\/photo\?k=[\w-]{20,}$/);
  const token = stored.photo.src.split('k=')[1];
  assert.equal((await readPhoto(redis, token)).type, 'image/jpeg');

  const lib = await readLibrary(redis);
  assert.equal(lib.items.length, 1);
  assert.deepEqual(lib.saved, ['workout-abc123']);
  assert.deepEqual(await readLibrary(redis, lib.rev), { rev: lib.rev, unchanged: true });

  // An older copy from another device doesn't overwrite a newer one.
  const stale = await applyOps(redis, [{ op: 'put', item: { ...workout, title: 'Old', updatedAt: 5 } }]);
  assert.equal(stale.results[0].kept, 'server');
  assert.equal((await readLibrary(redis)).items[0].title, 'Push day');

  await applyOps(redis, [{ op: 'delete', id: 'workout-abc123' }]);
  assert.equal(await readPhoto(redis, token), null);
  const after = await readLibrary(redis);
  assert.deepEqual([after.items, after.saved], [[], []]);
});

function call(handler, { method = 'GET', query = {}, body, headers = {} }) {
  return new Promise(resolve => {
    const res = { headers: {}, statusCode: 200, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(d) { resolve({ status: this.statusCode, body: d }); return this; }, send(d) { resolve({ status: this.statusCode, body: d }); return this; }, end() { resolve({ status: this.statusCode }); return this; } };
    handler({ method, query, body, headers }, res);
  });
}

test('the library API needs the passcode', async () => {
  process.env.SW_DEV_MEMORY = '1';
  delete process.env.STEVIE_PASSCODE;
  assert.deepEqual((await call(libraryHandler, { query: { status: '1' } })).body, { sync: false, reason: 'no-passcode' });
  process.env.STEVIE_PASSCODE = 'open sesame';
  assert.equal((await call(libraryHandler, { query: { status: '1' } })).body.sync, true);
  assert.equal((await call(libraryHandler, { headers: { 'x-passcode': 'wrong' } })).status, 401);
  const put = await call(libraryHandler, { method: 'POST', headers: { 'x-passcode': 'open sesame' }, body: { ops: [{ op: 'put', item: workout }] } });
  assert.equal(put.status, 200);
  const bad = await call(libraryHandler, { method: 'POST', headers: { 'x-passcode': 'open sesame' }, body: { ops: [{ op: 'put', item: { id: 'no' } }] } });
  assert.equal(bad.status, 400);
  const got = await call(libraryHandler, { headers: { 'x-passcode': 'open sesame' } });
  assert.equal(got.body.items[0].title, 'Push day');
});
