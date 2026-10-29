import { randomBytes } from 'node:crypto';
import { normalizeItem, ItemError } from '../shared/schema.js';

const K = { items: 'sw:items', saved: 'sw:saved', rev: 'sw:rev', photo: token => `sw:photo:${token}` };
const MAX_ITEMS = 3000;
const photoToken = src => (typeof src === 'string' ? src.match(/^\/api\/photo\?k=([A-Za-z0-9_-]+)$/)?.[1] : null) || null;

export async function readLibrary(redis, knownRev) {
  const rev = Number(await redis.cmd('GET', K.rev)) || 0;
  if (knownRev !== undefined && knownRev !== null && Number(knownRev) === rev) return { rev, unchanged: true };
  const [values, saved] = await redis.pipeline([['HVALS', K.items], ['SMEMBERS', K.saved]]);
  const items = (values || []).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
  return { rev, items, saved: saved || [] };
}

export async function applyOps(redis, ops) {
  if (!Array.isArray(ops) || !ops.length || ops.length > 200) throw new ItemError('Send between 1 and 200 changes at a time.');
  const results = [];
  for (const op of ops) {
    if (op?.op === 'put') {
      const item = normalizeItem(op.item);
      const previousRaw = await redis.cmd('HGET', K.items, item.id);
      const previous = previousRaw ? JSON.parse(previousRaw) : null;
      if (!previous && Number(await redis.cmd('HLEN', K.items)) >= MAX_ITEMS) throw new ItemError('Your library is full.');
      if (previous && previous.updatedAt > item.updatedAt) { results.push({ id: item.id, item: previous, kept: 'server' }); continue; }
      const commands = [];
      if (item.photo?.src?.startsWith('data:')) {
        const token = randomBytes(18).toString('base64url');
        commands.push(['SET', K.photo(token), item.photo.src]);
        item.photo.src = `/api/photo?k=${token}`;
      }
      const oldToken = photoToken(previous?.photo?.src);
      if (oldToken && oldToken !== photoToken(item.photo?.src)) commands.push(['DEL', K.photo(oldToken)]);
      commands.push(['HSET', K.items, item.id, JSON.stringify(item)]);
      await redis.pipeline(commands);
      results.push({ id: item.id, item });
    } else if (op?.op === 'delete') {
      const id = String(op.id || '');
      const previousRaw = await redis.cmd('HGET', K.items, id);
      const token = previousRaw ? photoToken(JSON.parse(previousRaw).photo?.src) : null;
      await redis.pipeline([['HDEL', K.items, id], ['SREM', K.saved, id], ...(token ? [['DEL', K.photo(token)]] : [])]);
      results.push({ id, deleted: true });
    } else if (op?.op === 'save') {
      const id = String(op.id || '').slice(0, 120);
      if (!id) throw new ItemError('Missing item to save.');
      await redis.cmd(op.value ? 'SADD' : 'SREM', K.saved, id);
      results.push({ id, saved: Boolean(op.value) });
    } else throw new ItemError('Unknown change.');
  }
  const rev = await redis.cmd('INCR', K.rev);
  return { rev, results };
}

export async function readPhoto(redis, token) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token || '')) return null;
  const data = await redis.cmd('GET', K.photo(token));
  const m = typeof data === 'string' && data.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  return m ? { type: m[1], bytes: Buffer.from(m[2], 'base64') } : null;
}
