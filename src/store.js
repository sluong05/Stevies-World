// The library: built-in items + your items, cached on this device (IndexedDB) and synced
// to the site's storage when a passcode is set. Changes made offline are queued and sent later.
import { builtins } from './builtins.js';
import { normalizeItem, newId, searchText } from '../shared/schema.js';

const DB_NAME = 'stevies-world';
const LEGACY_KEY = 'stevies-world.library.v1';
const PASS_KEY = 'sw.passcode';

function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
  try {
    const db = await idb();
    return await new Promise((resolve, reject) => { const r = db.transaction('kv').objectStore('kv').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  } catch { return undefined; }
}
async function idbSet(key, value) {
  try {
    const db = await idb();
    await new Promise((resolve, reject) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(value, key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    return true;
  } catch { return false; }
}

const lsGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
const lsSet = (key, value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* private mode */ } };

const state = {
  mine: new Map(),     // id → your item (may shadow a built-in with the same id)
  saved: new Set(),    // favorite ids
  pending: new Map(),  // key → { op, id, value? } waiting to sync
  rev: null,
  sync: { available: false, reason: 'checking', connected: false, error: '', lastSynced: 0, busy: false },
};
const listeners = new Set();
export const onChange = fn => listeners.add(fn);
const emit = () => listeners.forEach(fn => fn());

async function persist() {
  await idbSet('library', { items: [...state.mine.values()], saved: [...state.saved], pending: [...state.pending.entries()], rev: state.rev, lastSynced: state.sync.lastSynced });
}

// ---------- reading ----------
const builtinMap = new Map(builtins.map(b => [b.id, b]));
export function allItems() {
  const map = new Map(builtinMap);
  for (const [id, item] of state.mine) map.set(id, item);
  return [...map.values()];
}
export const getItem = id => state.mine.get(id) || builtinMap.get(id) || null;
export const isBuiltIn = id => builtinMap.has(id);
export const isEditedBuiltIn = id => builtinMap.has(id) && state.mine.has(id);
export const isSaved = id => state.saved.has(id);
export const syncState = () => ({ ...state.sync, pending: state.pending.size, hasPasscode: Boolean(lsGet(PASS_KEY)) });
export const byType = type => allItems().filter(i => i.type === type);
export function search(query, items = allItems()) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter(item => { const hay = searchText(item); return words.every(w => hay.includes(w)); })
    .sort((a, b) => Number(b.title.toLowerCase().includes(words[0])) - Number(a.title.toLowerCase().includes(words[0])));
}

// ---------- writing ----------
export async function saveItem(raw) {
  const existing = state.mine.get(raw.id);
  const item = normalizeItem({ ...raw, id: raw.id || newId(raw.type), createdAt: existing?.createdAt ?? raw.createdAt ?? Date.now(), updatedAt: Date.now() });
  state.mine.set(item.id, item);
  state.pending.set(`item:${item.id}`, { op: 'put', id: item.id });
  await persist();
  emit();
  flush();
  return item;
}
export async function deleteItem(id) {
  state.mine.delete(id);
  if (!builtinMap.has(id)) state.saved.delete(id);
  state.pending.set(`item:${id}`, { op: 'delete', id });
  await persist();
  emit();
  flush();
}
export async function toggleSaved(id) {
  const value = !state.saved.has(id);
  value ? state.saved.add(id) : state.saved.delete(id);
  state.pending.set(`save:${id}`, { op: 'save', id, value });
  await persist();
  emit();
  flush();
  return value;
}

// ---------- sync ----------
const headers = () => ({ 'Content-Type': 'application/json', 'X-Passcode': lsGet(PASS_KEY) || '' });
export const passcodeHeader = () => ({ 'X-Passcode': lsGet(PASS_KEY) || '' });

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const err = new Error(data.error || `Request failed (${res.status})`); err.status = res.status; err.reason = data.reason; throw err; }
  return data;
}

export async function checkSync() {
  try {
    const status = await api('/api/library?status=1');
    state.sync.available = status.sync;
    state.sync.reason = status.reason || '';
  } catch {
    state.sync.available = false;
    state.sync.reason = navigator.onLine === false ? 'offline' : 'no-api';
  }
  emit();
  return state.sync.available;
}

export async function setPasscode(code) {
  lsSet(PASS_KEY, code ? code.trim() : null);
  state.sync.error = '';
  state.rev = null;
  if (!code) { state.sync.connected = false; emit(); return false; }
  return pull({ force: true });
}

let pulling = null;
export function pull({ force = false } = {}) {
  if (pulling) return pulling;
  if (!state.sync.available || !lsGet(PASS_KEY)) return Promise.resolve(false);
  pulling = (async () => {
    state.sync.busy = true; emit();
    try {
      await flush({ fromPull: true });
      const data = await api(`/api/library${!force && state.rev !== null ? `?rev=${state.rev}` : ''}`);
      if (!data.unchanged) {
        const local = state.mine;
        state.mine = new Map();
        for (const item of data.items) state.mine.set(item.id, item);
        // Keep anything still waiting to upload.
        for (const [, op] of state.pending) {
          if (op.op === 'put' && local.has(op.id)) state.mine.set(op.id, local.get(op.id));
          if (op.op === 'delete') state.mine.delete(op.id);
        }
        state.saved = new Set(data.saved);
        for (const [, op] of state.pending) if (op.op === 'save') op.value ? state.saved.add(op.id) : state.saved.delete(op.id);
        state.rev = data.rev;
      }
      state.sync.connected = true; state.sync.error = ''; state.sync.lastSynced = Date.now();
      await persist();
      return true;
    } catch (error) {
      state.sync.connected = false;
      state.sync.error = error.status === 401 ? 'That passcode doesn’t match the one set on the site.' : error.message;
      return false;
    } finally { state.sync.busy = false; pulling = null; emit(); }
  })();
  return pulling;
}

let flushing = null;
export function flush({ fromPull = false } = {}) {
  if (flushing) return flushing;
  if (!state.sync.available || !lsGet(PASS_KEY) || !state.pending.size) return Promise.resolve(true);
  flushing = (async () => {
    const entries = [...state.pending.entries()];
    // Batch by size so photo uploads stay under the server's request limit.
    const batches = [];
    let batch = [], size = 0;
    for (const [key, op] of entries) {
      const body = op.op === 'put' ? { op: 'put', item: state.mine.get(op.id) } : op;
      if (op.op === 'put' && !body.item) { state.pending.delete(key); continue; }
      const len = JSON.stringify(body).length;
      if (batch.length && (size + len > 3_200_000 || batch.length >= 25)) { batches.push(batch); batch = []; size = 0; }
      batch.push([key, body]); size += len;
    }
    if (batch.length) batches.push(batch);
    try {
      for (const b of batches) {
        const data = await api('/api/library', { method: 'POST', body: JSON.stringify({ ops: b.map(([, body]) => body) }) });
        b.forEach(([key, body], i) => {
          const result = data.results[i];
          // Only clear if nothing newer was queued while this was in flight.
          if (body.op === 'put' && result?.item) {
            const current = state.mine.get(body.item.id);
            if (current && current.updatedAt <= body.item.updatedAt) { state.mine.set(result.item.id, result.item); state.pending.delete(key); }
            else if (!current) state.pending.delete(key);
          } else if (JSON.stringify(state.pending.get(key)) === JSON.stringify(body)) state.pending.delete(key);
        });
      }
      state.sync.error = '';
      state.rev = null; // someone else may have written too; next pull re-reads
      await persist();
      if (!fromPull) setTimeout(() => pull(), 50);
      return true;
    } catch (error) {
      state.sync.error = error.status === 401 ? 'That passcode doesn’t match the one set on the site.' : `Saved on this device. It will sync when you’re back online (${error.message}).`;
      return false;
    } finally { flushing = null; emit(); }
  })();
  return flushing;
}

// ---------- backups ----------
export function exportLibrary() {
  return { app: 'stevies-world', version: 2, exportedAt: new Date().toISOString(), items: [...state.mine.values()], saved: [...state.saved] };
}
export async function importLibrary(data) {
  let items = [], saved = [];
  if (data?.version === 2 && Array.isArray(data.items)) { items = data.items; saved = data.saved || []; }
  else if (data?.version === 1 && Array.isArray(data.entries)) { items = data.entries.map(fromLegacy).filter(Boolean); saved = data.saved || []; }
  else throw new Error('Choose a Stevies World backup file.');
  let count = 0;
  for (const raw of items) {
    try {
      const item = normalizeItem(raw);
      const existing = state.mine.get(item.id);
      if (existing && existing.updatedAt > item.updatedAt) continue;
      state.mine.set(item.id, item);
      state.pending.set(`item:${item.id}`, { op: 'put', id: item.id });
      count++;
    } catch { /* skip broken entries */ }
  }
  for (const id of saved) if (typeof id === 'string' && !state.saved.has(id)) { state.saved.add(id); state.pending.set(`save:${id}`, { op: 'save', id, value: true }); }
  await persist(); emit(); flush();
  return count;
}

function fromLegacy(entry) {
  if (!entry || !entry.id) return null;
  const base = { id: entry.id.replace(/[^a-z0-9-]/gi, '-').slice(0, 79), title: entry.title, description: entry.description, tags: entry.tags, note: entry.note, sourceUrl: entry.sourceUrl, createdAt: Date.now(), updatedAt: Date.now() };
  if (entry.type === 'recipe') return { ...base, type: 'recipe', category: entry.category, minutes: entry.minutes, servings: entry.servings, ingredients: entry.ingredients, steps: entry.steps, nutrition: entry.nutrition, cost: entry.cost, photo: entry.photo?.src?.startsWith('/assets/') ? undefined : entry.photo };
  return { ...base, type: 'note', category: entry.category, body: (entry.sections || []).map(s => `## ${s.heading}\n${s.body}`).join('\n\n') };
}

// ---------- start ----------
export async function init() {
  const cached = await idbGet('library');
  if (cached) {
    for (const item of cached.items || []) state.mine.set(item.id, item);
    state.saved = new Set(cached.saved || []);
    state.pending = new Map(cached.pending || []);
    state.rev = cached.rev ?? null;
    state.sync.lastSynced = cached.lastSynced || 0;
  } else {
    // First run of the new app: bring over anything from the old version's browser storage.
    try {
      const legacy = JSON.parse(lsGet(LEGACY_KEY) || 'null');
      if (legacy?.version === 1) await importLibrary(legacy);
    } catch { /* nothing to migrate */ }
    await persist();
  }
  emit();
  checkSync().then(ok => ok && pull());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && state.sync.available) pull(); });
  window.addEventListener('online', () => checkSync().then(ok => ok && pull()));
}
