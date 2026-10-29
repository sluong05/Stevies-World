import { getRedis } from '../lib/redis.js';
import { checkPasscode, passcode, passcodeFrom } from '../lib/auth.js';
import { readLibrary, applyOps } from '../lib/library.js';
import { ItemError } from '../shared/schema.js';

// GET  /api/library?status=1   → { sync, reason }
// GET  /api/library?rev=N       → { rev, items, saved } or { rev, unchanged }
// POST /api/library { ops: [...] }
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const redis = getRedis();
  const configured = Boolean(redis && passcode());
  if (req.method === 'GET' && req.query?.status) {
    return res.status(200).json({ sync: configured, reason: configured ? '' : !redis ? 'no-storage' : 'no-passcode' });
  }
  if (!configured) return res.status(503).json({ error: 'Sync isn’t set up on this site yet.', reason: !redis ? 'no-storage' : 'no-passcode' });
  if (!checkPasscode(passcodeFrom(req))) return res.status(401).json({ error: 'That passcode doesn’t match.' });
  try {
    if (req.method === 'GET') return res.status(200).json(await readLibrary(redis, req.query?.rev));
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      return res.status(200).json(await applyOps(redis, body.ops));
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    if (error instanceof ItemError || error instanceof SyntaxError) return res.status(400).json({ error: error.message });
    console.error(error);
    return res.status(500).json({ error: 'Your library couldn’t be reached. Try again in a moment.' });
  }
}
