import { importLink, NeedsText } from '../lib/importer.js';
import { checkPasscode, passcode, passcodeFrom } from '../lib/auth.js';
import { TYPES } from '../shared/schema.js';

// POST /api/import { url, type? } → { draft, image, platform, raw }
// 422 { needsText: true, error, image } when a platform hides the caption.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  // When a passcode is set, only you can use the importer (so the site isn't an open proxy).
  if (passcode() && !checkPasscode(passcodeFrom(req))) return res.status(401).json({ error: 'Enter your passcode in Settings to import links.' });
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}; } catch { return res.status(400).json({ error: 'Send a link to import.' }); }
  const url = String(body.url || '').trim();
  if (!url) return res.status(400).json({ error: 'Paste a link to import.' });
  const type = TYPES.includes(body.type) ? body.type : undefined;
  try {
    return res.status(200).json(await importLink(url, { type }));
  } catch (error) {
    if (error instanceof NeedsText) return res.status(422).json({ needsText: true, error: error.message, platform: error.platform, image: error.image || null });
    return res.status(400).json({ error: error.message || 'That link couldn’t be imported.' });
  }
}
